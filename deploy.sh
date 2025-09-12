#!/bin/bash

# Email Assist - Docker Deployment Script
# This script handles deployment of the Email Assist application using Docker

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="email-assist"
DOCKER_COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
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

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed or not available"
    fi
    
    success "Prerequisites check passed"
}

# Check environment file
check_environment() {
    log "Checking environment configuration..."
    
    if [ ! -f "$ENV_FILE" ]; then
        warning "Environment file $ENV_FILE not found"
        if [ -f ".env.docker" ]; then
            log "Copying .env.docker to $ENV_FILE"
            cp .env.docker "$ENV_FILE"
        else
            error "No environment template found. Please create $ENV_FILE"
        fi
    fi
    
    # Check required environment variables
    required_vars=(
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "JWT_SECRET"
    )
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$ENV_FILE" || grep -q "^${var}=$" "$ENV_FILE" || grep -q "^${var}=your_" "$ENV_FILE"; then
            error "Environment variable $var is not set or has default value in $ENV_FILE"
        fi
    done
    
    success "Environment configuration is valid"
}

# Build images
build_images() {
    log "Building Docker images..."
    
    # Build frontend
    log "Building frontend image..."
    docker build -f Dockerfile.frontend -t "$PROJECT_NAME-frontend:latest" .
    
    # Build backend
    log "Building backend image..."
    docker build -f Dockerfile.backend -t "$PROJECT_NAME-backend:latest" .
    
    success "Docker images built successfully"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Wait for database to be ready
    log "Waiting for database to be ready..."
    timeout 60 bash -c 'until docker-compose exec -T postgres pg_isready -U postgres; do sleep 2; done' || {
        error "Database failed to start within 60 seconds"
    }
    
    # Run migrations
    if docker-compose exec -T backend npm run db:migrate; then
        success "Database migrations completed"
    else
        warning "Database migrations failed or not configured"
    fi
}

# Health check
health_check() {
    log "Performing health checks..."
    
    local services=("frontend" "backend" "postgres" "redis")
    local max_attempts=30
    local attempt=1
    
    for service in "${services[@]}"; do
        log "Checking health of $service..."
        
        while [ $attempt -le $max_attempts ]; do
            if docker-compose exec -T "$service" sh -c 'exit 0' &>/dev/null; then
                success "$service is healthy"
                break
            fi
            
            if [ $attempt -eq $max_attempts ]; then
                error "$service failed health check after $max_attempts attempts"
            fi
            
            sleep 2
            ((attempt++))
        done
        attempt=1
    done
    
    # Test API endpoint
    log "Testing API endpoint..."
    if curl -f http://localhost/health &>/dev/null; then
        success "API endpoint is responding"
    else
        warning "API endpoint health check failed"
    fi
}

# Backup data
backup_data() {
    log "Creating backup..."
    
    local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup database
    if docker-compose exec -T postgres pg_dump -U postgres email_assist > "$backup_dir/database.sql"; then
        success "Database backup created: $backup_dir/database.sql"
    else
        warning "Database backup failed"
    fi
    
    # Backup uploads
    if [ -d "uploads" ]; then
        cp -r uploads "$backup_dir/"
        success "Uploads backup created: $backup_dir/uploads"
    fi
}

# Deploy function
deploy() {
    local environment=${1:-production}
    log "Starting deployment for environment: $environment"
    
    check_prerequisites
    check_environment
    
    if [ "$environment" = "production" ]; then
        backup_data
    fi
    
    # Stop existing containers
    log "Stopping existing containers..."
    docker-compose down --remove-orphans
    
    # Build images
    build_images
    
    # Start services
    log "Starting services..."
    docker-compose up -d
    
    # Wait for services to start
    sleep 30
    
    # Run migrations
    run_migrations
    
    # Health checks
    health_check
    
    success "Deployment completed successfully!"
    
    # Show status
    docker-compose ps
}

# Development setup
dev_setup() {
    log "Setting up development environment..."
    
    check_prerequisites
    
    # Use development environment file
    if [ -f ".env.development" ]; then
        cp .env.development .env
        log "Using development environment configuration"
    fi
    
    # Start development services
    docker-compose -f docker-compose.dev.yml up -d
    
    success "Development environment is ready!"
    success "Frontend: http://localhost:5173"
    success "Backend API: http://localhost:3001"
    success "Database Admin: http://localhost:8081"
    success "Redis Admin: http://localhost:8082"
    success "Mailhog: http://localhost:8025"
}

# Cleanup function
cleanup() {
    log "Cleaning up..."
    
    # Stop all containers
    docker-compose down --remove-orphans
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes (ask for confirmation)
    read -p "Remove unused volumes? This will delete all data! (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker volume prune -f
        warning "All unused volumes have been removed"
    fi
    
    success "Cleanup completed"
}

# Log monitoring
logs() {
    local service=${1:-""}
    
    if [ -n "$service" ]; then
        docker-compose logs -f "$service"
    else
        docker-compose logs -f
    fi
}

# Show status
status() {
    log "Service Status:"
    docker-compose ps
    
    echo ""
    log "Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
}

# Update function
update() {
    log "Updating Email Assist..."
    
    # Pull latest code
    if [ -d ".git" ]; then
        git pull origin main
        log "Code updated from repository"
    fi
    
    # Rebuild and deploy
    deploy production
}

# Show help
show_help() {
    echo "Email Assist Docker Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy [env]     Deploy the application (env: production|staging, default: production)"
    echo "  dev              Start development environment"
    echo "  build            Build Docker images"
    echo "  logs [service]   Show logs for all services or specific service"
    echo "  status           Show service status and resource usage"
    echo "  backup           Create backup of data"
    echo "  update           Update and redeploy the application"
    echo "  cleanup          Stop services and clean up resources"
    echo "  help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy production"
    echo "  $0 dev"
    echo "  $0 logs backend"
    echo "  $0 status"
}

# Main script logic
case "$1" in
    "deploy")
        deploy "$2"
        ;;
    "dev")
        dev_setup
        ;;
    "build")
        check_prerequisites
        build_images
        ;;
    "logs")
        logs "$2"
        ;;
    "status")
        status
        ;;
    "backup")
        backup_data
        ;;
    "update")
        update
        ;;
    "cleanup")
        cleanup
        ;;
    "help"|"--help"|"-h"|"")
        show_help
        ;;
    *)
        error "Unknown command: $1. Use '$0 help' for available commands."
        ;;
esac