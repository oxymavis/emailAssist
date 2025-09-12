#!/bin/bash

# Email Assist - Quick Start Script
# This script provides a guided setup for first-time users

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# ASCII Art
show_banner() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║               📧 Email Assist Docker Setup 📧                 ║"
    echo "║                                                                ║"
    echo "║            AI-Powered Email Management System                  ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check system requirements
check_system() {
    log "Checking system requirements..."
    
    # Check OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        OS="windows"
    else
        warning "Unknown OS: $OSTYPE"
        OS="unknown"
    fi
    
    log "Detected OS: $OS"
    
    # Check available memory
    if [[ "$OS" == "linux" ]]; then
        MEMORY_MB=$(free -m | awk 'NR==2{printf "%.0f", $2}')
    elif [[ "$OS" == "macos" ]]; then
        MEMORY_BYTES=$(sysctl -n hw.memsize)
        MEMORY_MB=$((MEMORY_BYTES / 1024 / 1024))
    else
        MEMORY_MB=8192  # Assume 8GB if can't detect
    fi
    
    log "Available memory: ${MEMORY_MB}MB"
    
    if [ $MEMORY_MB -lt 4096 ]; then
        warning "Low memory detected. Minimum 4GB recommended, 8GB preferred."
    fi
    
    # Check disk space
    DISK_AVAILABLE=$(df . | awk 'NR==2 {print $4}')
    DISK_GB=$((DISK_AVAILABLE / 1024 / 1024))
    
    log "Available disk space: ${DISK_GB}GB"
    
    if [ $DISK_GB -lt 10 ]; then
        warning "Low disk space. Minimum 10GB recommended."
    fi
}

# Check Docker installation
check_docker() {
    log "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker is not running. Please start Docker service."
    fi
    
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
    log "Docker version: $DOCKER_VERSION"
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed or not available."
    fi
    
    success "Docker is ready!"
}

# Environment selection
select_environment() {
    echo ""
    echo -e "${PURPLE}Select your environment:${NC}"
    echo "1) Development (Hot reload, debug tools, sample data)"
    echo "2) Production (Full monitoring, optimized performance)"
    echo "3) Staging (Production-like testing environment)"
    echo ""
    
    read -p "Enter your choice (1-3): " ENV_CHOICE
    
    case $ENV_CHOICE in
        1)
            ENVIRONMENT="development"
            ENV_FILE=".env.development"
            COMPOSE_FILE="docker-compose.dev.yml"
            ;;
        2)
            ENVIRONMENT="production"
            ENV_FILE=".env.docker"
            COMPOSE_FILE="docker-compose.yml"
            ;;
        3)
            ENVIRONMENT="staging"
            ENV_FILE=".env.staging"
            COMPOSE_FILE="docker-compose.staging.yml"
            ;;
        *)
            warning "Invalid choice. Using development environment."
            ENVIRONMENT="development"
            ENV_FILE=".env.development"
            COMPOSE_FILE="docker-compose.dev.yml"
            ;;
    esac
    
    success "Selected environment: $ENVIRONMENT"
}

# Setup environment file
setup_environment() {
    log "Setting up environment configuration..."
    
    if [ ! -f ".env" ]; then
        if [ -f "$ENV_FILE" ]; then
            cp "$ENV_FILE" ".env"
            log "Copied $ENV_FILE to .env"
        else
            warning "Environment template not found. Creating basic .env"
            touch .env
        fi
    else
        log "Environment file already exists"
    fi
    
    # Prompt for critical configuration
    if [[ "$ENVIRONMENT" != "development" ]]; then
        echo ""
        echo -e "${YELLOW}🔐 Security Configuration Required${NC}"
        echo "Please provide secure passwords and keys for your environment:"
        echo ""
        
        read -s -p "PostgreSQL Password (leave empty for auto-generate): " POSTGRES_PASS
        echo ""
        
        if [ -z "$POSTGRES_PASS" ]; then
            POSTGRES_PASS=$(openssl rand -base64 32)
            log "Auto-generated PostgreSQL password"
        fi
        
        read -s -p "Redis Password (leave empty for auto-generate): " REDIS_PASS
        echo ""
        
        if [ -z "$REDIS_PASS" ]; then
            REDIS_PASS=$(openssl rand -base64 32)
            log "Auto-generated Redis password"
        fi
        
        read -s -p "JWT Secret (leave empty for auto-generate): " JWT_SECRET
        echo ""
        
        if [ -z "$JWT_SECRET" ]; then
            JWT_SECRET=$(openssl rand -base64 64)
            log "Auto-generated JWT secret"
        fi
        
        # Update .env file
        sed -i.bak "s/your_secure_postgres_password_here/$POSTGRES_PASS/" .env
        sed -i.bak "s/your_secure_redis_password_here/$REDIS_PASS/" .env
        sed -i.bak "s/your_super_secret_jwt_key_minimum_32_characters_long/$JWT_SECRET/" .env
        
        rm .env.bak 2>/dev/null || true
        
        success "Security configuration updated"
    fi
}

# Download and build images
setup_images() {
    echo ""
    log "Setting up Docker images..."
    
    echo "This may take several minutes depending on your internet connection."
    echo ""
    
    if [[ "$ENVIRONMENT" == "development" ]]; then
        log "Building development environment..."
        docker-compose -f "$COMPOSE_FILE" build --parallel
    else
        log "Building production environment..."
        docker-compose -f "$COMPOSE_FILE" build --parallel
    fi
    
    success "Docker images ready!"
}

# Start services
start_services() {
    echo ""
    log "Starting Email Assist services..."
    
    docker-compose -f "$COMPOSE_FILE" up -d
    
    log "Waiting for services to start..."
    sleep 30
    
    # Wait for database
    log "Waiting for database to be ready..."
    timeout 60 bash -c "
        until docker-compose -f '$COMPOSE_FILE' exec -T postgres-* pg_isready -U postgres 2>/dev/null; do
            sleep 2
        done
    " || warning "Database health check timeout"
    
    success "Services started!"
}

# Show access information
show_access_info() {
    echo ""
    echo -e "${GREEN}🎉 Email Assist is ready!${NC}"
    echo ""
    echo -e "${CYAN}Access Information:${NC}"
    echo "==================="
    
    if [[ "$ENVIRONMENT" == "development" ]]; then
        echo "📱 Frontend (Vite Dev Server): http://localhost:5173"
        echo "⚡ Backend API: http://localhost:3001"
        echo "🗄️ Database Admin (Adminer): http://localhost:8081"
        echo "📨 Redis Admin: http://localhost:8082"
        echo "📧 Email Testing (Mailhog): http://localhost:8025"
        echo ""
        echo -e "${YELLOW}Development Credentials:${NC}"
        echo "• Admin: admin@emailassist.dev / admin123"
        echo "• User: user@emailassist.dev / admin123"
    elif [[ "$ENVIRONMENT" == "staging" ]]; then
        echo "🌐 Application: http://localhost:8080"
        echo "📊 Monitoring: http://localhost:3000 (admin/[your_grafana_password])"
    else
        echo "🌐 Application: http://localhost (or https://your-domain.com)"
        echo "📊 Grafana Monitoring: http://localhost:3000 (admin/[your_grafana_password])"
        echo "📈 Prometheus: http://localhost:9090"
    fi
    
    echo ""
    echo -e "${CYAN}Management Commands:${NC}"
    echo "==================="
    echo "• View logs: ./deploy.sh logs"
    echo "• Check status: ./deploy.sh status"
    echo "• Stop services: ./deploy.sh cleanup"
    echo "• View help: ./deploy.sh help"
    echo ""
    echo "• Or use Makefile: make help"
    echo ""
    echo -e "${GREEN}Enjoy using Email Assist! 🚀${NC}"
}

# Health check
health_check() {
    log "Performing health checks..."
    
    local services_healthy=true
    
    # Check if containers are running
    if ! docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        warning "Some services may not be running properly"
        services_healthy=false
    fi
    
    # Try to check endpoints for non-dev environments
    if [[ "$ENVIRONMENT" != "development" ]]; then
        if ! curl -f http://localhost/health &>/dev/null; then
            warning "Application health check failed"
            services_healthy=false
        fi
    fi
    
    if $services_healthy; then
        success "All services are healthy!"
    else
        warning "Some services may have issues. Check logs with: ./deploy.sh logs"
    fi
}

# Cleanup on exit
cleanup_on_exit() {
    if [ $? -ne 0 ]; then
        echo ""
        error "Setup failed. Cleaning up..."
        docker-compose -f "$COMPOSE_FILE" down &>/dev/null || true
    fi
}

# Main execution
main() {
    trap cleanup_on_exit EXIT
    
    show_banner
    
    check_system
    check_docker
    select_environment
    setup_environment
    setup_images
    start_services
    health_check
    show_access_info
    
    echo ""
    log "Quick start completed successfully!"
}

# Run main function
main "$@"