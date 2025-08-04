#!/bin/bash

# Infrastructure Drift Detection Script for AI Validation Platform
# This script detects and reports configuration drift in AWS infrastructure

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
ENVIRONMENT=""
AUTO_CORRECT=false
REPORT_ONLY=false
SLACK_WEBHOOK=""
EMAIL_RECIPIENTS=""

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

Infrastructure Drift Detection Script for AI Validation Platform

OPTIONS:
    -e, --environment ENV      Target environment (dev|staging|prod)
    -a, --auto-correct         Automatically correct detected drift
    -r, --report-only          Only generate drift report, don't fix
    -s, --slack-webhook URL    Slack webhook URL for notifications
    -m, --email RECIPIENTS     Comma-separated email recipients
    -h, --help                 Show this help message

EXAMPLES:
    $0 -e dev
    $0 -e prod --auto-correct
    $0 --environment staging --report-only
    $0 -e prod -s https://hooks.slack.com/... -m admin@company.com

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
            -a|--auto-correct)
                AUTO_CORRECT=true
                shift
                ;;
            -r|--report-only)
                REPORT_ONLY=true
                shift
                ;;
            -s|--slack-webhook)
                SLACK_WEBHOOK="$2"
                shift 2
                ;;
            -m|--email)
                EMAIL_RECIPIENTS="$2"
                shift 2
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

    # Validate conflicting options
    if [[ "$AUTO_CORRECT" == true && "$REPORT_ONLY" == true ]]; then
        log_error "Cannot use --auto-correct and --report-only together"
        exit 1
    fi
}

# Initialize drift report
initialize_report() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local report_file="${SCRIPT_DIR}/drift-report-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" << EOF
{
    "scan_timestamp": "$timestamp",
    "environment": "$ENVIRONMENT",
    "scan_type": "infrastructure_drift",
    "drift_detected": false,
    "total_resources_scanned": 0,
    "resources_with_drift": 0,
    "findings": [],
    "recommendations": []
}
EOF

    echo "$report_file"
}

# Get expected infrastructure state from CDK
get_expected_state() {
    log_info "Getting expected infrastructure state from CDK..."
    
    cd "${PROJECT_ROOT}/packages/infrastructure"
    
    # Generate CDK diff to compare expected vs actual
    local diff_output
    if ! diff_output=$(npx cdk diff --context environment="$ENVIRONMENT" 2>&1); then
        if [[ $? -eq 1 ]]; then
            # Exit code 1 means differences found (expected)
            echo "$diff_output"
            return 0
        else
            # Other exit codes indicate errors
            log_error "CDK diff failed: $diff_output"
            return 1
        fi
    fi
    
    echo "$diff_output"
}

# Check CDK stack drift
check_cdk_drift() {
    local report_file="$1"
    local findings=()
    
    log_info "Checking CDK stack drift..."
    
    local env_suffix=""
    case "$ENVIRONMENT" in
        dev) env_suffix="Dev" ;;
        staging) env_suffix="Staging" ;;
        prod) env_suffix="Prod" ;;
    esac
    
    # List of stacks to check
    local stacks=(
        "AiValidationParameters$env_suffix"
        "AiValidationPlatform$env_suffix"
        "AiValidationEcs$env_suffix"
        "AiValidationMonitoring$env_suffix"
        "AiValidationSecurity$env_suffix"
    )
    
    for stack in "${stacks[@]}"; do
        log_info "Checking stack: $stack"
        
        # Check if stack exists
        if ! aws cloudformation describe-stacks --stack-name "$stack" &>/dev/null; then
            local finding=$(cat << EOF
{
    "resource_type": "CloudFormation Stack",
    "resource_id": "$stack",
    "drift_type": "MISSING",
    "severity": "HIGH",
    "description": "Expected stack $stack is missing",
    "expected_state": "EXISTS",
    "actual_state": "NOT_FOUND",
    "recommended_action": "Deploy missing stack using CDK"
}
EOF
            )
            findings+=("$finding")
            continue
        fi
        
        # Initiate drift detection
        local drift_detection_id
        if drift_detection_id=$(aws cloudformation detect-stack-drift --stack-name "$stack" --query 'StackDriftDetectionId' --output text 2>/dev/null); then
            log_info "Drift detection initiated for $stack (ID: $drift_detection_id)"
            
            # Wait for drift detection to complete
            local max_wait=300
            local wait_time=0
            while [[ $wait_time -lt $max_wait ]]; do
                local status
                if status=$(aws cloudformation describe-stack-drift-detection-status --stack-drift-detection-id "$drift_detection_id" --query 'DetectionStatus' --output text 2>/dev/null); then
                    if [[ "$status" == "DETECTION_COMPLETE" ]]; then
                        break
                    elif [[ "$status" == "DETECTION_FAILED" ]]; then
                        log_warning "Drift detection failed for $stack"
                        break
                    fi
                fi
                sleep 10
                wait_time=$((wait_time + 10))
            done
            
            # Get drift results
            local drift_status
            if drift_status=$(aws cloudformation describe-stack-drift-detection-status --stack-drift-detection-id "$drift_detection_id" --query 'StackDriftStatus' --output text 2>/dev/null); then
                if [[ "$drift_status" == "DRIFTED" ]]; then
                    log_warning "Drift detected in stack: $stack"
                    
                    # Get detailed drift information
                    local drifted_resources
                    if drifted_resources=$(aws cloudformation describe-stack-resource-drifts --stack-name "$stack" --query 'StackResourceDrifts[?StackResourceDriftStatus==`MODIFIED` || StackResourceDriftStatus==`DELETED`]' --output json 2>/dev/null); then
                        # Process each drifted resource
                        echo "$drifted_resources" | jq -r '.[] | @base64' | while read -r resource; do
                            local resource_data=$(echo "$resource" | base64 -d)
                            local resource_type=$(echo "$resource_data" | jq -r '.ResourceType')
                            local logical_id=$(echo "$resource_data" | jq -r '.LogicalResourceId')
                            local drift_status=$(echo "$resource_data" | jq -r '.StackResourceDriftStatus')
                            local property_diffs=$(echo "$resource_data" | jq -r '.PropertyDifferences // []')
                            
                            local finding=$(cat << EOF
{
    "resource_type": "$resource_type",
    "resource_id": "$logical_id",
    "stack": "$stack",
    "drift_type": "$drift_status",
    "severity": "MEDIUM",
    "description": "Resource has drifted from expected configuration",
    "property_differences": $property_diffs,
    "recommended_action": "Review and update infrastructure configuration"
}
EOF
                            )
                            findings+=("$finding")
                        done
                    fi
                else
                    log_success "No drift detected in stack: $stack"
                fi
            fi
        else
            log_warning "Could not initiate drift detection for $stack"
        fi
    done
    
    # Update report with findings
    if [[ ${#findings[@]} -gt 0 ]]; then
        local findings_json="["
        for i in "${!findings[@]}"; do
            if [[ $i -gt 0 ]]; then
                findings_json+=","
            fi
            findings_json+="${findings[$i]}"
        done
        findings_json+="]"
        
        # Update report file
        jq --argjson findings "$findings_json" '.drift_detected = true | .resources_with_drift = ($findings | length) | .findings += $findings' "$report_file" > "${report_file}.tmp" && mv "${report_file}.tmp" "$report_file"
    fi
}

# Check ECS service drift
check_ecs_drift() {
    local report_file="$1"
    local findings=()
    
    log_info "Checking ECS service drift..."
    
    local env_suffix=""
    case "$ENVIRONMENT" in
        dev) env_suffix="-dev" ;;
        staging) env_suffix="-staging" ;;
        prod) env_suffix="-prod" ;;
    esac
    
    local cluster_name="ai-validation-cluster$env_suffix"
    local services=(
        "ai-validation-api$env_suffix"
        "ai-validation-orchestrator$env_suffix"
        "ai-validation-web$env_suffix"
    )
    
    for service in "${services[@]}"; do
        log_info "Checking ECS service: $service"
        
        # Get current service configuration
        local service_config
        if service_config=$(aws ecs describe-services --cluster "$cluster_name" --services "$service" --query 'services[0]' --output json 2>/dev/null); then
            # Check desired vs running task count
            local desired_count=$(echo "$service_config" | jq -r '.desiredCount')
            local running_count=$(echo "$service_config" | jq -r '.runningCount')
            
            if [[ "$desired_count" != "$running_count" ]]; then
                local finding=$(cat << EOF
{
    "resource_type": "ECS Service",
    "resource_id": "$service",
    "drift_type": "TASK_COUNT_MISMATCH",
    "severity": "MEDIUM",
    "description": "ECS service task count mismatch",
    "expected_state": "desired: $desired_count, running: $desired_count",
    "actual_state": "desired: $desired_count, running: $running_count",
    "recommended_action": "Check service health and scaling policies"
}
EOF
                )
                findings+=("$finding")
            fi
            
            # Check service status
            local service_status=$(echo "$service_config" | jq -r '.status')
            if [[ "$service_status" != "ACTIVE" ]]; then
                local finding=$(cat << EOF
{
    "resource_type": "ECS Service",
    "resource_id": "$service",
    "drift_type": "INACTIVE_SERVICE",
    "severity": "HIGH",
    "description": "ECS service is not in ACTIVE status",
    "expected_state": "ACTIVE",
    "actual_state": "$service_status",
    "recommended_action": "Investigate service issues and restart if necessary"
}
EOF
                )
                findings+=("$finding")
            fi
            
            # Check task definition consistency
            local current_task_def=$(echo "$service_config" | jq -r '.taskDefinition')
            local latest_task_def=$(aws ecs describe-task-definition --task-definition "$service" --query 'taskDefinition.taskDefinitionArn' --output text 2>/dev/null || echo "UNKNOWN")
            
            if [[ "$current_task_def" != "$latest_task_def" && "$latest_task_def" != "UNKNOWN" ]]; then
                local finding=$(cat << EOF
{
    "resource_type": "ECS Service",
    "resource_id": "$service",
    "drift_type": "OUTDATED_TASK_DEFINITION",
    "severity": "LOW",
    "description": "ECS service is not using the latest task definition",
    "expected_state": "$latest_task_def",
    "actual_state": "$current_task_def",
    "recommended_action": "Update service to use latest task definition"
}
EOF
                )
                findings+=("$finding")
            fi
        else
            local finding=$(cat << EOF
{
    "resource_type": "ECS Service",
    "resource_id": "$service",
    "drift_type": "MISSING",
    "severity": "HIGH",
    "description": "Expected ECS service is missing",
    "expected_state": "EXISTS",
    "actual_state": "NOT_FOUND",
    "recommended_action": "Deploy missing ECS service"
}
EOF
            )
            findings+=("$finding")
        fi
    done
    
    # Update report with ECS findings
    if [[ ${#findings[@]} -gt 0 ]]; then
        local findings_json="["
        for i in "${!findings[@]}"; do
            if [[ $i -gt 0 ]]; then
                findings_json+=","
            fi
            findings_json+="${findings[$i]}"
        done
        findings_json+="]"
        
        # Update report file
        jq --argjson findings "$findings_json" '.drift_detected = true | .resources_with_drift += ($findings | length) | .findings += $findings' "$report_file" > "${report_file}.tmp" && mv "${report_file}.tmp" "$report_file"
    fi
}

# Check security group drift
check_security_groups_drift() {
    local report_file="$1"
    local findings=()
    
    log_info "Checking security group drift..."
    
    # Get all security groups with AI Validation Platform tag
    local security_groups
    if security_groups=$(aws ec2 describe-security-groups --filters "Name=tag:Project,Values=AI-Validation-Platform" --query 'SecurityGroups' --output json 2>/dev/null); then
        echo "$security_groups" | jq -r '.[] | @base64' | while read -r sg; do
            local sg_data=$(echo "$sg" | base64 -d)
            local group_id=$(echo "$sg_data" | jq -r '.GroupId')
            local group_name=$(echo "$sg_data" | jq -r '.GroupName')
            
            # Check for overly permissive rules
            local ingress_rules=$(echo "$sg_data" | jq -r '.IpPermissions[]?')
            
            # Check for 0.0.0.0/0 access on sensitive ports
            if echo "$sg_data" | jq -e '.IpPermissions[] | select(.IpRanges[]?.CidrIp == "0.0.0.0/0" and (.FromPort <= 22 and .ToPort >= 22))' >/dev/null 2>&1; then
                local finding=$(cat << EOF
{
    "resource_type": "Security Group",
    "resource_id": "$group_id",
    "resource_name": "$group_name",
    "drift_type": "OVERLY_PERMISSIVE",
    "severity": "HIGH",
    "description": "Security group allows SSH access from anywhere (0.0.0.0/0)",
    "expected_state": "Restricted SSH access",
    "actual_state": "SSH open to internet",
    "recommended_action": "Restrict SSH access to specific IP ranges or remove rule"
}
EOF
                )
                findings+=("$finding")
            fi
            
            # Check for open HTTP/HTTPS to internet (should only be on ALB security group)
            if echo "$sg_data" | jq -e '.IpPermissions[] | select(.IpRanges[]?.CidrIp == "0.0.0.0/0" and (.FromPort == 80 or .FromPort == 443))' >/dev/null 2>&1; then
                if [[ "$group_name" != *"alb"* && "$group_name" != *"load-balancer"* ]]; then
                    local finding=$(cat << EOF
{
    "resource_type": "Security Group",
    "resource_id": "$group_id",
    "resource_name": "$group_name",
    "drift_type": "OVERLY_PERMISSIVE",
    "severity": "MEDIUM",
    "description": "Non-ALB security group allows HTTP/HTTPS from anywhere",
    "recommended_action": "Review if internet access is necessary for this resource"
}
EOF
                    )
                    findings+=("$finding")
                fi
            fi
        done
    fi
    
    # Update report with security group findings
    if [[ ${#findings[@]} -gt 0 ]]; then
        local findings_json="["
        for i in "${!findings[@]}"; do
            if [[ $i -gt 0 ]]; then
                findings_json+=","
            fi
            findings_json+="${findings[$i]}"
        done
        findings_json+="]"
        
        # Update report file
        jq --argjson findings "$findings_json" '.drift_detected = true | .resources_with_drift += ($findings | length) | .findings += $findings' "$report_file" > "${report_file}.tmp" && mv "${report_file}.tmp" "$report_file"
    fi
}

# Check parameter store drift
check_parameter_store_drift() {
    local report_file="$1"
    local findings=()
    
    log_info "Checking Parameter Store drift..."
    
    # Get expected parameters from CDK
    local expected_params=(
        "/ai-validation/$ENVIRONMENT/database/host"
        "/ai-validation/$ENVIRONMENT/database/port"
        "/ai-validation/$ENVIRONMENT/database/name"
        "/ai-validation/$ENVIRONMENT/redis/host"
        "/ai-validation/$ENVIRONMENT/redis/port"
        "/ai-validation/$ENVIRONMENT/api/port"
        "/ai-validation/$ENVIRONMENT/api/jwt-expiry"
        "/ai-validation/$ENVIRONMENT/rate-limiting/window-ms"
        "/ai-validation/$ENVIRONMENT/rate-limiting/max-requests"
    )
    
    for param in "${expected_params[@]}"; do
        if ! aws ssm get-parameter --name "$param" >/dev/null 2>&1; then
            local finding=$(cat << EOF
{
    "resource_type": "SSM Parameter",
    "resource_id": "$param",
    "drift_type": "MISSING",
    "severity": "MEDIUM",
    "description": "Expected SSM parameter is missing",
    "expected_state": "EXISTS",
    "actual_state": "NOT_FOUND",
    "recommended_action": "Deploy parameter store configuration"
}
EOF
            )
            findings+=("$finding")
        fi
    done
    
    # Update report with parameter store findings
    if [[ ${#findings[@]} -gt 0 ]]; then
        local findings_json="["
        for i in "${!findings[@]}"; do
            if [[ $i -gt 0 ]]; then
                findings_json+=","
            fi
            findings_json+="${findings[$i]}"
        done
        findings_json+="]"
        
        # Update report file
        jq --argjson findings "$findings_json" '.drift_detected = true | .resources_with_drift += ($findings | length) | .findings += $findings' "$report_file" > "${report_file}.tmp" && mv "${report_file}.tmp" "$report_file"
    fi
}

# Auto-correct detected drift
auto_correct_drift() {
    local report_file="$1"
    
    if [[ "$AUTO_CORRECT" != true ]]; then
        return 0
    fi
    
    log_info "Auto-correcting detected drift..."
    
    local corrections_made=0
    
    # Process each finding and attempt to correct
    jq -r '.findings[] | @base64' "$report_file" | while read -r finding; do
        local finding_data=$(echo "$finding" | base64 -d)
        local resource_type=$(echo "$finding_data" | jq -r '.resource_type')
        local drift_type=$(echo "$finding_data" | jq -r '.drift_type')
        local resource_id=$(echo "$finding_data" | jq -r '.resource_id')
        
        case "$resource_type" in
            "CloudFormation Stack")
                if [[ "$drift_type" == "MISSING" ]]; then
                    log_info "Deploying missing stack: $resource_id"
                    cd "${PROJECT_ROOT}/packages/infrastructure"
                    if npx cdk deploy "$resource_id" --context environment="$ENVIRONMENT" --require-approval never; then
                        log_success "Successfully deployed missing stack: $resource_id"
                        corrections_made=$((corrections_made + 1))
                    else
                        log_error "Failed to deploy missing stack: $resource_id"
                    fi
                fi
                ;;
            "ECS Service")
                if [[ "$drift_type" == "TASK_COUNT_MISMATCH" ]]; then
                    log_info "Correcting ECS service task count: $resource_id"
                    # Force new deployment to resolve task count issues
                    local cluster_name="ai-validation-cluster-$ENVIRONMENT"
                    if aws ecs update-service --cluster "$cluster_name" --service "$resource_id" --force-new-deployment >/dev/null 2>&1; then
                        log_success "Triggered ECS service update: $resource_id"
                        corrections_made=$((corrections_made + 1))
                    else
                        log_error "Failed to update ECS service: $resource_id"
                    fi
                fi
                ;;
            "SSM Parameter")
                if [[ "$drift_type" == "MISSING" ]]; then
                    log_info "Deploying missing parameter: $resource_id"
                    cd "${PROJECT_ROOT}/packages/infrastructure"
                    local param_stack="AiValidationParameters${ENVIRONMENT^}"
                    if npx cdk deploy "$param_stack" --context environment="$ENVIRONMENT" --require-approval never; then
                        log_success "Successfully deployed missing parameter: $resource_id"
                        corrections_made=$((corrections_made + 1))
                    else
                        log_error "Failed to deploy missing parameter: $resource_id"
                    fi
                fi
                ;;
        esac
    done
    
    if [[ $corrections_made -gt 0 ]]; then
        log_success "Auto-corrected $corrections_made drift issues"
        
        # Update report with correction status
        jq --argjson corrections "$corrections_made" '.corrections_applied = $corrections' "$report_file" > "${report_file}.tmp" && mv "${report_file}.tmp" "$report_file"
    else
        log_info "No automatic corrections could be applied"
    fi
}

# Generate recommendations
generate_recommendations() {
    local report_file="$1"
    
    log_info "Generating recommendations..."
    
    local recommendations=()
    
    # Check if drift was detected
    local drift_detected=$(jq -r '.drift_detected' "$report_file")
    if [[ "$drift_detected" == "true" ]]; then
        recommendations+=("\"Regularly run drift detection to catch configuration changes early\"")
        recommendations+=("\"Implement Infrastructure as Code practices to prevent manual changes\"")
        recommendations+=("\"Set up CloudTrail to audit infrastructure changes\"")
        recommendations+=("\"Consider using AWS Config rules for continuous compliance monitoring\"")
        
        # Specific recommendations based on findings
        local high_severity_count=$(jq -r '[.findings[] | select(.severity == "HIGH")] | length' "$report_file")
        if [[ "$high_severity_count" -gt 0 ]]; then
            recommendations+=("\"High severity drift detected - immediate attention required\"")
            recommendations+=("\"Review change management processes to prevent critical drift\"")
        fi
        
        local security_issues=$(jq -r '[.findings[] | select(.resource_type == "Security Group" and .drift_type == "OVERLY_PERMISSIVE")] | length' "$report_file")
        if [[ "$security_issues" -gt 0 ]]; then
            recommendations+=("\"Review and tighten security group rules\"")
            recommendations+=("\"Implement least privilege access principles\"")
        fi
    else
        recommendations+=("\"No drift detected - infrastructure is aligned with expected state\"")
        recommendations+=("\"Continue regular drift detection scans\"")
    fi
    
    # Update report with recommendations
    local recommendations_json="[$(IFS=','; echo "${recommendations[*]}")]"
    jq --argjson recs "$recommendations_json" '.recommendations = $recs' "$report_file" > "${report_file}.tmp" && mv "${report_file}.tmp" "$report_file"
}

# Send notifications
send_notifications() {
    local report_file="$1"
    
    local drift_detected=$(jq -r '.drift_detected' "$report_file")
    if [[ "$drift_detected" != "true" ]]; then
        log_info "No drift detected - skipping notifications"
        return 0
    fi
    
    log_info "Sending drift notifications..."
    
    local resources_with_drift=$(jq -r '.resources_with_drift' "$report_file")
    local high_severity_count=$(jq -r '[.findings[] | select(.severity == "HIGH")] | length' "$report_file")
    
    # Prepare notification message
    local message="🚨 Infrastructure Drift Detected\n"
    message+="Environment: $ENVIRONMENT\n"
    message+="Resources with drift: $resources_with_drift\n"
    message+="High severity issues: $high_severity_count\n"
    message+="Report: $(basename "$report_file")\n"
    message+="Time: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    
    # Send Slack notification
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        log_info "Sending Slack notification..."
        local slack_payload=$(cat << EOF
{
    "text": "Infrastructure Drift Alert",
    "attachments": [
        {
            "color": "danger",
            "fields": [
                {
                    "title": "Environment",
                    "value": "$ENVIRONMENT",
                    "short": true
                },
                {
                    "title": "Resources with Drift",
                    "value": "$resources_with_drift",
                    "short": true
                },
                {
                    "title": "High Severity Issues",
                    "value": "$high_severity_count",
                    "short": true
                },
                {
                    "title": "Report File",
                    "value": "$(basename "$report_file")",
                    "short": true
                }
            ]
        }
    ]
}
EOF
        )
        
        if curl -X POST -H 'Content-type: application/json' --data "$slack_payload" "$SLACK_WEBHOOK" >/dev/null 2>&1; then
            log_success "Slack notification sent"
        else
            log_error "Failed to send Slack notification"
        fi
    fi
    
    # Send email notification (using AWS SES)
    if [[ -n "$EMAIL_RECIPIENTS" ]]; then
        log_info "Sending email notification..."
        
        local email_body="Infrastructure drift has been detected in the $ENVIRONMENT environment.\n\n"
        email_body+="Summary:\n"
        email_body+="- Resources with drift: $resources_with_drift\n"
        email_body+="- High severity issues: $high_severity_count\n\n"
        email_body+="Please review the detailed report: $(basename "$report_file")\n\n"
        email_body+="Scan completed at: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
        
        # Split email recipients
        IFS=',' read -ra ADDR <<< "$EMAIL_RECIPIENTS"
        for email in "${ADDR[@]}"; do
            if aws ses send-email \
                --source "noreply@aivalidation.com" \
                --destination "ToAddresses=[$email]" \
                --message "Subject={Data='Infrastructure Drift Alert - $ENVIRONMENT'},Body={Text={Data='$email_body'}}" >/dev/null 2>&1; then
                log_success "Email sent to $email"
            else
                log_error "Failed to send email to $email"
            fi
        done
    fi
}

# Display drift report summary
display_summary() {
    local report_file="$1"
    
    echo
    log_info "=== DRIFT DETECTION SUMMARY ==="
    
    local drift_detected=$(jq -r '.drift_detected' "$report_file")
    local resources_scanned=$(jq -r '.total_resources_scanned' "$report_file")
    local resources_with_drift=$(jq -r '.resources_with_drift' "$report_file")
    
    echo "Environment: $ENVIRONMENT"
    echo "Scan timestamp: $(jq -r '.scan_timestamp' "$report_file")"
    echo "Drift detected: $drift_detected"
    echo "Resources with drift: $resources_with_drift"
    echo
    
    if [[ "$drift_detected" == "true" ]]; then
        log_warning "DRIFT DETECTED - Review the findings below:"
        echo
        
        # Display findings by severity
        local high_count=$(jq -r '[.findings[] | select(.severity == "HIGH")] | length' "$report_file")
        local medium_count=$(jq -r '[.findings[] | select(.severity == "MEDIUM")] | length' "$report_file")
        local low_count=$(jq -r '[.findings[] | select(.severity == "LOW")] | length' "$report_file")
        
        if [[ "$high_count" -gt 0 ]]; then
            log_error "HIGH SEVERITY ISSUES: $high_count"
            jq -r '.findings[] | select(.severity == "HIGH") | "  - \(.resource_type): \(.resource_id) - \(.description)"' "$report_file"
            echo
        fi
        
        if [[ "$medium_count" -gt 0 ]]; then
            log_warning "MEDIUM SEVERITY ISSUES: $medium_count"
            jq -r '.findings[] | select(.severity == "MEDIUM") | "  - \(.resource_type): \(.resource_id) - \(.description)"' "$report_file"
            echo
        fi
        
        if [[ "$low_count" -gt 0 ]]; then
            log_info "LOW SEVERITY ISSUES: $low_count"
            jq -r '.findings[] | select(.severity == "LOW") | "  - \(.resource_type): \(.resource_id) - \(.description)"' "$report_file"
            echo
        fi
        
        log_info "RECOMMENDATIONS:"
        jq -r '.recommendations[] | "  - \(.)"' "$report_file"
        echo
    else
        log_success "NO DRIFT DETECTED - Infrastructure is aligned with expected state"
        echo
    fi
    
    log_info "Full report saved to: $report_file"
    echo
}

# Main function
main() {
    log_info "Starting infrastructure drift detection for environment: $ENVIRONMENT"
    
    # Initialize report
    local report_file
    report_file=$(initialize_report)
    
    # Run drift checks
    check_cdk_drift "$report_file"
    check_ecs_drift "$report_file"
    check_security_groups_drift "$report_file"
    check_parameter_store_drift "$report_file"
    
    # Update total resources scanned
    local total_scanned=4  # Number of resource types checked
    jq --argjson total "$total_scanned" '.total_resources_scanned = $total' "$report_file" > "${report_file}.tmp" && mv "${report_file}.tmp" "$report_file"
    
    # Auto-correct if requested
    if [[ "$REPORT_ONLY" != true ]]; then
        auto_correct_drift "$report_file"
    fi
    
    # Generate recommendations
    generate_recommendations "$report_file"
    
    # Send notifications
    send_notifications "$report_file"
    
    # Display summary
    display_summary "$report_file"
    
    # Exit with appropriate code
    local drift_detected=$(jq -r '.drift_detected' "$report_file")
    if [[ "$drift_detected" == "true" ]]; then
        exit 1
    else
        exit 0
    fi
}

# Parse arguments and run
parse_args "$@"
main