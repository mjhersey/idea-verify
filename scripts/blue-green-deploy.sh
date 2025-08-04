#!/bin/bash

# Blue-Green Deployment Script for AI Validation Platform
# This script manages blue-green deployments using AWS ECS and ALB

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
ENVIRONMENT=""
DEPLOYMENT_TYPE="blue-green"
HEALTH_CHECK_TIMEOUT=300
ROLLBACK_ON_FAILURE=true
SKIP_TESTS=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Blue-Green Deployment Script for AI Validation Platform

OPTIONS:
    -e, --environment ENV      Target environment (dev|staging|prod)
    -t, --timeout SECONDS      Health check timeout (default: 300)
    -s, --skip-tests           Skip post-deployment tests
    -n, --no-rollback          Don't rollback on failure
    -h, --help                 Show this help message

EXAMPLES:
    $0 -e dev
    $0 -e prod -t 600 --skip-tests
    $0 --environment staging --no-rollback

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -t|--timeout)
                HEALTH_CHECK_TIMEOUT="$2"
                shift 2
                ;;
            -s|--skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            -n|--no-rollback)
                ROLLBACK_ON_FAILURE=false
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Validate required arguments
    if [[ -z "$ENVIRONMENT" ]]; then
        log_error "Environment is required"
        usage
        exit 1
    fi

    if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
        log_error "Environment must be one of: dev, staging, prod"
        exit 1
    fi
}

# AWS configuration
setup_aws_env() {
    local env_suffix=""
    case "$ENVIRONMENT" in
        dev) env_suffix="-dev" ;;
        staging) env_suffix="-staging" ;;
        prod) env_suffix="-prod" ;;
    esac

    CLUSTER_NAME="ai-validation-cluster${env_suffix}"
    ALB_ARN=$(aws elbv2 describe-load-balancers \
        --names "ai-validation-alb${env_suffix}" \
        --query 'LoadBalancers[0].LoadBalancerArn' \
        --output text)
    
    if [[ "$ALB_ARN" == "None" ]]; then
        log_error "Load balancer not found for environment: $ENVIRONMENT"
        exit 1
    fi

    log_info "AWS Environment configured:"
    log_info "  Cluster: $CLUSTER_NAME"
    log_info "  Load Balancer: $ALB_ARN"
}

# Get current service configuration
get_current_services() {
    local env_suffix=""
    case "$ENVIRONMENT" in
        dev) env_suffix="-dev" ;;
        staging) env_suffix="-staging" ;;
        prod) env_suffix="-prod" ;;
    esac

    API_SERVICE="ai-validation-api${env_suffix}"
    ORCHESTRATOR_SERVICE="ai-validation-orchestrator${env_suffix}"
    WEB_SERVICE="ai-validation-web${env_suffix}"

    # Get target group ARNs
    API_TG_ARN=$(aws elbv2 describe-target-groups \
        --names "ai-validation-api-tg${env_suffix}" \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text)
    
    WEB_TG_ARN=$(aws elbv2 describe-target-groups \
        --names "ai-validation-web-tg${env_suffix}" \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text)

    log_info "Current services:"
    log_info "  API Service: $API_SERVICE"
    log_info "  Orchestrator Service: $ORCHESTRATOR_SERVICE"
    log_info "  Web Service: $WEB_SERVICE"
}

# Create green environment
create_green_environment() {
    log_info "Creating green environment services..."

    local env_suffix=""
    case "$ENVIRONMENT" in
        dev) env_suffix="-dev" ;;
        staging) env_suffix="-staging" ;;
        prod) env_suffix="-prod" ;;
    esac

    # Create green target groups
    API_GREEN_TG_ARN=$(aws elbv2 create-target-group \
        --name "ai-validation-api-tg${env_suffix}-green" \
        --protocol HTTP \
        --port 3000 \
        --vpc-id $(aws ec2 describe-vpcs --filters "Name=tag:Project,Values=AI-Validation-Platform" --query 'Vpcs[0].VpcId' --output text) \
        --health-check-path "/health" \
        --health-check-interval-seconds 30 \
        --health-check-timeout-seconds 5 \
        --healthy-threshold-count 2 \
        --unhealthy-threshold-count 3 \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text)

    WEB_GREEN_TG_ARN=$(aws elbv2 create-target-group \
        --name "ai-validation-web-tg${env_suffix}-green" \
        --protocol HTTP \
        --port 80 \
        --vpc-id $(aws ec2 describe-vpcs --filters "Name=tag:Project,Values=AI-Validation-Platform" --query 'Vpcs[0].VpcId' --output text) \
        --health-check-path "/health" \
        --health-check-interval-seconds 30 \
        --health-check-timeout-seconds 5 \
        --healthy-threshold-count 2 \
        --unhealthy-threshold-count 3 \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text)

    log_success "Green target groups created:"
    log_info "  API Green TG: $API_GREEN_TG_ARN"
    log_info "  Web Green TG: $WEB_GREEN_TG_ARN"

    # Create green services with updated task definitions
    create_green_services

    # Store green environment info for cleanup
    cat > "${SCRIPT_DIR}/green-env-${ENVIRONMENT}.json" << EOF
{
    "api_target_group": "$API_GREEN_TG_ARN",
    "web_target_group": "$WEB_GREEN_TG_ARN",
    "api_service": "${API_SERVICE}-green",
    "orchestrator_service": "${ORCHESTRATOR_SERVICE}-green",
    "web_service": "${WEB_SERVICE}-green"
}
EOF
}

# Create green services
create_green_services() {
    log_info "Creating green ECS services..."

    local env_suffix=""
    case "$ENVIRONMENT" in
        dev) env_suffix="-dev" ;;
        staging) env_suffix="-staging" ;;
        prod) env_suffix="-prod" ;;
    esac

    # Get latest task definitions
    API_TASK_DEF=$(aws ecs describe-task-definition \
        --task-definition "$API_SERVICE" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)
    
    ORCHESTRATOR_TASK_DEF=$(aws ecs describe-task-definition \
        --task-definition "$ORCHESTRATOR_SERVICE" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)
    
    WEB_TASK_DEF=$(aws ecs describe-task-definition \
        --task-definition "$WEB_SERVICE" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)

    # Create green API service
    aws ecs create-service \
        --cluster "$CLUSTER_NAME" \
        --service-name "${API_SERVICE}-green" \
        --task-definition "$API_TASK_DEF" \
        --desired-count 1 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=*Private*" --query 'Subnets[0].SubnetId' --output text)],securityGroups=[$(aws ec2 describe-security-groups --filters "Name=tag:Name,Values=*ECS*" --query 'SecurityGroups[0].GroupId' --output text)],assignPublicIp=DISABLED}" \
        --load-balancers "targetGroupArn=$API_GREEN_TG_ARN,containerName=api,containerPort=3000" \
        --deployment-configuration "maximumPercent=200,minimumHealthyPercent=50" > /dev/null

    # Create green orchestrator service (no load balancer)
    aws ecs create-service \
        --cluster "$CLUSTER_NAME" \
        --service-name "${ORCHESTRATOR_SERVICE}-green" \
        --task-definition "$ORCHESTRATOR_TASK_DEF" \
        --desired-count 1 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=*Private*" --query 'Subnets[0].SubnetId' --output text)],securityGroups=[$(aws ec2 describe-security-groups --filters "Name=tag:Name,Values=*ECS*" --query 'SecurityGroups[0].GroupId' --output text)],assignPublicIp=DISABLED}" \
        --deployment-configuration "maximumPercent=200,minimumHealthyPercent=50" > /dev/null

    # Create green web service
    aws ecs create-service \
        --cluster "$CLUSTER_NAME" \
        --service-name "${WEB_SERVICE}-green" \
        --task-definition "$WEB_TASK_DEF" \
        --desired-count 1 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=*Private*" --query 'Subnets[0].SubnetId' --output text)],securityGroups=[$(aws ec2 describe-security-groups --filters "Name=tag:Name,Values=*ECS*" --query 'SecurityGroups[0].GroupId' --output text)],assignPublicIp=DISABLED}" \
        --load-balancers "targetGroupArn=$WEB_GREEN_TG_ARN,containerName=web,containerPort=80" \
        --deployment-configuration "maximumPercent=200,minimumHealthyPercent=50" > /dev/null

    log_success "Green services created successfully"
}

# Wait for green services to be healthy
wait_for_green_health() {
    log_info "Waiting for green services to become healthy..."

    local timeout=$HEALTH_CHECK_TIMEOUT
    local start_time=$(date +%s)

    while [[ $timeout -gt 0 ]]; do
        local api_healthy=false
        local web_healthy=false

        # Check API service health
        api_healthy_count=$(aws elbv2 describe-target-health \
            --target-group-arn "$API_GREEN_TG_ARN" \
            --query 'length(TargetHealthDescriptions[?TargetHealth.State==`healthy`])' \
            --output text)
        
        if [[ "$api_healthy_count" -gt 0 ]]; then
            api_healthy=true
        fi

        # Check web service health
        web_healthy_count=$(aws elbv2 describe-target-health \
            --target-group-arn "$WEB_GREEN_TG_ARN" \
            --query 'length(TargetHealthDescriptions[?TargetHealth.State==`healthy`])' \
            --output text)
        
        if [[ "$web_healthy_count" -gt 0 ]]; then
            web_healthy=true
        fi

        if [[ "$api_healthy" == true && "$web_healthy" == true ]]; then
            log_success "All green services are healthy"
            return 0
        fi

        log_info "Waiting for services to become healthy... (${timeout}s remaining)"
        sleep 30
        timeout=$((timeout - 30))
    done

    log_error "Green services failed to become healthy within timeout"
    return 1
}

# Run tests against green environment
test_green_environment() {
    if [[ "$SKIP_TESTS" == true ]]; then
        log_warning "Skipping tests as requested"
        return 0
    fi

    log_info "Running tests against green environment..."

    # Get ALB DNS name for testing
    local alb_dns=$(aws elbv2 describe-load-balancers \
        --load-balancer-arns "$ALB_ARN" \
        --query 'LoadBalancers[0].DNSName' \
        --output text)

    # Test API health endpoint (using green target group)
    if ! curl -f -s "http://$alb_dns/health" > /dev/null; then
        log_error "Green environment health check failed"
        return 1
    fi

    # Test basic API functionality
    if ! curl -f -s "http://$alb_dns/api/status" > /dev/null; then
        log_error "Green environment API test failed"
        return 1
    fi

    # Test web application
    if ! curl -f -s "http://$alb_dns/" > /dev/null; then
        log_error "Green environment web test failed"
        return 1
    fi

    log_success "Green environment tests passed"
    return 0
}

# Switch traffic to green
switch_to_green() {
    log_info "Switching traffic to green environment..."

    # Get listener ARNs
    local api_listener=$(aws elbv2 describe-listeners \
        --load-balancer-arn "$ALB_ARN" \
        --query 'Listeners[?Port==`80`].ListenerArn' \
        --output text)

    # Update listener rules to point to green target groups
    local api_rule_arn=$(aws elbv2 describe-rules \
        --listener-arn "$api_listener" \
        --query 'Rules[?Conditions[0].Values[0]==`/api/*`].RuleArn' \
        --output text)

    local web_rule_arn=$(aws elbv2 describe-rules \
        --listener-arn "$api_listener" \
        --query 'Rules[?Priority==`1`].RuleArn' \
        --output text)

    # Switch API traffic
    if [[ "$api_rule_arn" != "None" ]]; then
        aws elbv2 modify-rule \
            --rule-arn "$api_rule_arn" \
            --actions "Type=forward,TargetGroupArn=$API_GREEN_TG_ARN" > /dev/null
        log_info "API traffic switched to green"
    fi

    # Switch web traffic (default rule)
    aws elbv2 modify-listener \
        --listener-arn "$api_listener" \
        --default-actions "Type=forward,TargetGroupArn=$WEB_GREEN_TG_ARN" > /dev/null
    
    log_success "Traffic successfully switched to green environment"
}

# Monitor production traffic
monitor_production() {
    log_info "Monitoring production traffic for 5 minutes..."

    local monitor_duration=300
    local check_interval=30
    local checks=$((monitor_duration / check_interval))

    for ((i=1; i<=checks; i++)); do
        # Check error rates
        local error_rate=$(aws logs filter-log-events \
            --log-group-name "/ecs/ai-validation-api-${ENVIRONMENT}" \
            --start-time $(($(date +%s) - check_interval)) \
            --filter-pattern "[timestamp, request_id, level=\"ERROR\"]" \
            --query 'length(events)' \
            --output text 2>/dev/null || echo "0")

        # Check target group health
        local unhealthy_targets=$(aws elbv2 describe-target-health \
            --target-group-arn "$API_GREEN_TG_ARN" \
            --query 'length(TargetHealthDescriptions[?TargetHealth.State!=`healthy`])' \
            --output text)

        log_info "Check $i/$checks: Error rate: $error_rate, Unhealthy targets: $unhealthy_targets"

        # Alert if error rate is too high or targets are unhealthy
        if [[ "$error_rate" -gt 10 || "$unhealthy_targets" -gt 0 ]]; then
            log_warning "High error rate or unhealthy targets detected"
            if [[ "$ROLLBACK_ON_FAILURE" == true ]]; then
                log_error "Rolling back due to production issues"
                rollback_to_blue
                return 1
            fi
        fi

        sleep $check_interval
    done

    log_success "Production monitoring completed successfully"
    return 0
}

# Rollback to blue environment
rollback_to_blue() {
    log_warning "Rolling back to blue environment..."

    # Get listener ARN
    local api_listener=$(aws elbv2 describe-listeners \
        --load-balancer-arn "$ALB_ARN" \
        --query 'Listeners[?Port==`80`].ListenerArn' \
        --output text)

    # Switch back to original target groups
    local api_rule_arn=$(aws elbv2 describe-rules \
        --listener-arn "$api_listener" \
        --query 'Rules[?Conditions[0].Values[0]==`/api/*`].RuleArn' \
        --output text)

    # Restore API traffic
    if [[ "$api_rule_arn" != "None" ]]; then
        aws elbv2 modify-rule \
            --rule-arn "$api_rule_arn" \
            --actions "Type=forward,TargetGroupArn=$API_TG_ARN" > /dev/null
    fi

    # Restore web traffic
    aws elbv2 modify-listener \
        --listener-arn "$api_listener" \
        --default-actions "Type=forward,TargetGroupArn=$WEB_TG_ARN" > /dev/null

    log_success "Traffic rolled back to blue environment"
    
    # Clean up green environment
    cleanup_green_environment
}

# Clean up blue environment (after successful deployment)
cleanup_blue_environment() {
    log_info "Cleaning up blue environment..."

    # Scale down blue services to 0
    aws ecs update-service \
        --cluster "$CLUSTER_NAME" \
        --service "$API_SERVICE" \
        --desired-count 0 > /dev/null

    aws ecs update-service \
        --cluster "$CLUSTER_NAME" \
        --service "$ORCHESTRATOR_SERVICE" \
        --desired-count 0 > /dev/null

    aws ecs update-service \
        --cluster "$CLUSTER_NAME" \
        --service "$WEB_SERVICE" \
        --desired-count 0 > /dev/null

    # Wait for services to scale down
    sleep 60

    # Delete blue services
    aws ecs delete-service --cluster "$CLUSTER_NAME" --service "$API_SERVICE" > /dev/null
    aws ecs delete-service --cluster "$CLUSTER_NAME" --service "$ORCHESTRATOR_SERVICE" > /dev/null
    aws ecs delete-service --cluster "$CLUSTER_NAME" --service "$WEB_SERVICE" > /dev/null

    # Delete original target groups
    aws elbv2 delete-target-group --target-group-arn "$API_TG_ARN" > /dev/null
    aws elbv2 delete-target-group --target-group-arn "$WEB_TG_ARN" > /dev/null

    log_success "Blue environment cleaned up"
}

# Clean up green environment (on rollback or failure)
cleanup_green_environment() {
    log_info "Cleaning up green environment..."

    if [[ -f "${SCRIPT_DIR}/green-env-${ENVIRONMENT}.json" ]]; then
        local green_config=$(cat "${SCRIPT_DIR}/green-env-${ENVIRONMENT}.json")
        local api_green_tg=$(echo "$green_config" | jq -r '.api_target_group')
        local web_green_tg=$(echo "$green_config" | jq -r '.web_target_group')
        local api_green_service=$(echo "$green_config" | jq -r '.api_service')
        local orchestrator_green_service=$(echo "$green_config" | jq -r '.orchestrator_service')
        local web_green_service=$(echo "$green_config" | jq -r '.web_service')

        # Scale down green services
        aws ecs update-service --cluster "$CLUSTER_NAME" --service "$api_green_service" --desired-count 0 > /dev/null || true
        aws ecs update-service --cluster "$CLUSTER_NAME" --service "$orchestrator_green_service" --desired-count 0 > /dev/null || true
        aws ecs update-service --cluster "$CLUSTER_NAME" --service "$web_green_service" --desired-count 0 > /dev/null || true

        sleep 60

        # Delete green services
        aws ecs delete-service --cluster "$CLUSTER_NAME" --service "$api_green_service" > /dev/null || true
        aws ecs delete-service --cluster "$CLUSTER_NAME" --service "$orchestrator_green_service" > /dev/null || true
        aws ecs delete-service --cluster "$CLUSTER_NAME" --service "$web_green_service" > /dev/null || true

        # Delete green target groups
        aws elbv2 delete-target-group --target-group-arn "$api_green_tg" > /dev/null || true
        aws elbv2 delete-target-group --target-group-arn "$web_green_tg" > /dev/null || true

        # Clean up config file
        rm -f "${SCRIPT_DIR}/green-env-${ENVIRONMENT}.json"
    fi

    log_success "Green environment cleaned up"
}

# Rename green to blue (after successful deployment)
promote_green_to_blue() {
    log_info "Promoting green environment to blue..."

    if [[ -f "${SCRIPT_DIR}/green-env-${ENVIRONMENT}.json" ]]; then
        local green_config=$(cat "${SCRIPT_DIR}/green-env-${ENVIRONMENT}.json")
        
        # Remove "-green" suffix from target groups and services
        local api_green_tg=$(echo "$green_config" | jq -r '.api_target_group')
        local web_green_tg=$(echo "$green_config" | jq -r '.web_target_group')
        
        # The green target groups are now the primary ones
        # Clean up the old blue environment first
        cleanup_blue_environment
        
        # Update target group names (this is cosmetic, ARNs remain the same)
        log_info "Green environment is now the active blue environment"
        
        # Clean up config file
        rm -f "${SCRIPT_DIR}/green-env-${ENVIRONMENT}.json"
    fi

    log_success "Green environment promoted to blue successfully"
}

# Trap to cleanup on exit
cleanup_on_exit() {
    if [[ -f "${SCRIPT_DIR}/green-env-${ENVIRONMENT}.json" ]]; then
        log_warning "Cleaning up on script exit..."
        cleanup_green_environment
    fi
}

trap cleanup_on_exit EXIT

# Main deployment function
main() {
    log_info "Starting blue-green deployment for environment: $ENVIRONMENT"
    
    # Setup
    setup_aws_env
    get_current_services
    
    # Create and test green environment
    if ! create_green_environment; then
        log_error "Failed to create green environment"
        exit 1
    fi
    
    if ! wait_for_green_health; then
        log_error "Green environment health check failed"
        cleanup_green_environment
        exit 1
    fi
    
    if ! test_green_environment; then
        log_error "Green environment tests failed"
        if [[ "$ROLLBACK_ON_FAILURE" == true ]]; then
            cleanup_green_environment
            exit 1
        fi
    fi
    
    # Switch traffic and monitor
    switch_to_green
    
    if ! monitor_production; then
        log_error "Production monitoring failed"
        exit 1
    fi
    
    # Success - promote green to blue
    promote_green_to_blue
    
    log_success "Blue-green deployment completed successfully!"
}

# Parse arguments and run
parse_args "$@"
main