#!/bin/bash

# AI-Powered Business Idea Validation Platform
# Development Environment Setup Script
# 
# This script automates the initial setup process for new developers

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE} STEP: $1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check version
check_version() {
    local cmd="$1"
    local min_version="$2"
    local current_version
    
    case "$cmd" in
        "node")
            current_version=$(node --version | sed 's/v//')
            ;;
        "npm")
            current_version=$(npm --version)
            ;;
        "docker")
            current_version=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
            ;;
    esac
    
    if [ "$(printf '%s\n' "$min_version" "$current_version" | sort -V | head -n1)" = "$min_version" ]; then
        return 0
    else
        return 1
    fi
}

# Main setup function
main() {
    echo ""
    echo -e "${GREEN}🚀 AI-Powered Business Idea Validation Platform${NC}"
    echo -e "${GREEN}   Development Environment Setup${NC}"
    echo ""
    
    # Step 1: Check prerequisites
    print_step "Checking Prerequisites"
    
    # Check Node.js
    if command_exists node; then
        if check_version "node" "18.0.0"; then
            print_success "Node.js $(node --version) - ✓"
        else
            print_error "Node.js version 18.0.0+ required. Current: $(node --version)"
            print_status "Please update Node.js: https://nodejs.org/"
            exit 1
        fi
    else
        print_error "Node.js not found. Please install Node.js 18.0.0+: https://nodejs.org/"
        exit 1
    fi
    
    # Check npm
    if command_exists npm; then
        if check_version "npm" "9.0.0"; then
            print_success "npm $(npm --version) - ✓"
        else
            print_warning "npm version 9.0.0+ recommended. Current: $(npm --version)"
            print_status "Consider updating: npm install -g npm@latest"
        fi
    else
        print_error "npm not found. Please install npm."
        exit 1
    fi
    
    # Check Docker
    if command_exists docker; then
        print_success "Docker $(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1) - ✓"
    else
        print_error "Docker not found. Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Check Docker Compose
    if command_exists docker-compose || docker compose version >/dev/null 2>&1; then
        print_success "Docker Compose - ✓"
    else
        print_error "Docker Compose not found. Please install Docker Compose."
        exit 1
    fi
    
    # Check Docker daemon
    if docker info >/dev/null 2>&1; then
        print_success "Docker daemon running - ✓"
    else
        print_error "Docker daemon not running. Please start Docker."
        exit 1
    fi
    
    # Step 2: Install dependencies
    print_step "Installing Dependencies"
    
    print_status "Installing root dependencies..."
    npm install
    
    print_status "Installing workspace dependencies..."
    npm run install:all
    
    print_success "Dependencies installed successfully"
    
    # Step 3: Setup environment
    print_step "Setting Up Environment"
    
    if [ ! -f .env ]; then
        print_status "Creating default .env file..."
        cat > .env << 'EOF'
# Database (Docker service)
DATABASE_URL=postgresql://dev_user:dev_password@localhost:5432/ai_validation_platform

# Redis (Docker service)
REDIS_URL=redis://localhost:6379

# Frontend configuration
VITE_API_BASE_URL=http://localhost:3000

# Development mode - use mock services
USE_MOCK_SERVICES=true
NODE_ENV=development
EOF
        print_success ".env file created with default development settings"
    else
        print_warning ".env file already exists - skipping creation"
    fi
    
    # Step 4: Start infrastructure services
    print_step "Starting Infrastructure Services"
    
    print_status "Starting PostgreSQL, Redis, and LocalStack..."
    npm run dev:services
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 10
    
    # Check service health
    if docker-compose ps | grep -q "Up"; then
        print_success "Infrastructure services started successfully"
    else
        print_warning "Some services may not be ready yet. Check with: docker-compose ps"
    fi
    
    # Step 5: Start mock services
    print_step "Starting Mock AI Services"
    
    print_status "Starting mock OpenAI and Anthropic services..."
    npm run dev:mocks
    
    sleep 5
    
    # Test mock services
    if curl -s http://localhost:3001/v1/models >/dev/null 2>&1; then
        print_success "Mock OpenAI service is responding"
    else
        print_warning "Mock OpenAI service may not be ready yet"
    fi
    
    if curl -s http://localhost:3002/health >/dev/null 2>&1; then
        print_success "Mock Anthropic service is responding"
    else
        print_warning "Mock Anthropic service may not be ready yet"
    fi
    
    # Step 6: Test database connectivity
    print_step "Testing Database Connectivity"
    
    print_status "Testing database connection..."
    if npm run test:db >/dev/null 2>&1; then
        print_success "Database connectivity test passed"
    else
        print_warning "Database connectivity test failed. Services may still be starting up."
        print_status "You can test manually later with: npm run test:db"
    fi
    
    # Step 7: Validation
    print_step "Running Environment Validation"
    
    print_status "Running comprehensive environment validation..."
    if npm run test:offline >/dev/null 2>&1; then
        print_success "Offline development mode test passed"
    else
        print_warning "Offline development mode test failed. You may need to wait for services to fully start."
    fi
    
    # Step 8: Final instructions
    print_step "Setup Complete!"
    
    echo ""
    print_success "🎉 Development environment setup completed successfully!"
    echo ""
    print_status "Next steps:"
    echo ""
    echo "  1. Start the application services in separate terminals:"
    echo ""
    echo "     Terminal 1 (Frontend):"
    echo "     ${YELLOW}npm run dev:web${NC}     # http://localhost:5173"
    echo ""
    echo "     Terminal 2 (API):"
    echo "     ${YELLOW}npm run dev:api${NC}     # http://localhost:3000"
    echo ""
    echo "     Terminal 3 (Orchestrator):"
    echo "     ${YELLOW}npm run dev:orchestrator${NC}"
    echo ""
    echo "  2. Verify everything is working:"
    echo "     ${YELLOW}npm run test:offline${NC}"
    echo ""
    echo "  3. Open your browser to:"
    echo "     ${BLUE}http://localhost:5173${NC} (Frontend)"
    echo "     ${BLUE}http://localhost:3000${NC} (API)"
    echo ""
    print_status "📚 For detailed documentation, see:"
    echo "     - docs/DEVELOPMENT_SETUP.md (comprehensive guide)"
    echo "     - docs/DEV_QUICK_REFERENCE.md (daily commands)"
    echo "     - README.md (project overview)"
    echo ""
    print_status "🆘 If you encounter issues:"
    echo "     - Check docs/troubleshooting-runbook.md"
    echo "     - Run: npm run dev:logs (to see service logs)"
    echo "     - Run: docker-compose ps (to check service status)"
    echo ""
    print_success "Happy coding! 🚀"
    echo ""
}

# Check if running from correct directory
if [ ! -f "package.json" ] || [ ! -f "docker-compose.yml" ]; then
    print_error "This script must be run from the project root directory"
    print_status "Please cd to the idea-verify directory and run: ./scripts/setup-dev.sh"
    exit 1
fi

# Run main setup
main "$@"