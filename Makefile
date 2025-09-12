# Email Assist - Docker Development Makefile
# Provides convenient commands for development and deployment

.PHONY: help dev prod staging test build clean logs status backup

# Default target
help: ## Show this help message
	@echo "Email Assist Docker Commands"
	@echo "============================"
	@echo ""
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Development environment
dev: ## Start development environment
	@echo "🚀 Starting development environment..."
	docker-compose -f docker-compose.dev.yml up -d
	@echo "✅ Development environment started"
	@echo "📱 Frontend: http://localhost:5173"
	@echo "⚡ Backend API: http://localhost:3001"
	@echo "🗄️ Database Admin: http://localhost:8081"
	@echo "📧 Mailhog: http://localhost:8025"

dev-build: ## Build and start development environment
	@echo "🔨 Building development environment..."
	docker-compose -f docker-compose.dev.yml build
	docker-compose -f docker-compose.dev.yml up -d

dev-stop: ## Stop development environment
	@echo "⏹️ Stopping development environment..."
	docker-compose -f docker-compose.dev.yml down

dev-logs: ## Show development environment logs
	docker-compose -f docker-compose.dev.yml logs -f

# Production environment
prod: ## Start production environment
	@echo "🚀 Starting production environment..."
	docker-compose up -d
	@echo "✅ Production environment started"
	@echo "🌐 Application: http://localhost"
	@echo "📊 Grafana: http://localhost:3000"

prod-build: ## Build and start production environment
	@echo "🔨 Building production environment..."
	docker-compose build
	docker-compose up -d

prod-stop: ## Stop production environment
	@echo "⏹️ Stopping production environment..."
	docker-compose down

prod-logs: ## Show production environment logs
	docker-compose logs -f

# Staging environment
staging: ## Start staging environment
	@echo "🚀 Starting staging environment..."
	docker-compose -f docker-compose.staging.yml up -d
	@echo "✅ Staging environment started"
	@echo "🌐 Application: http://localhost:8080"

staging-stop: ## Stop staging environment
	@echo "⏹️ Stopping staging environment..."
	docker-compose -f docker-compose.staging.yml down

staging-logs: ## Show staging environment logs
	docker-compose -f docker-compose.staging.yml logs -f

# Test environment
test: ## Run test suite
	@echo "🧪 Running test suite..."
	docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
	docker-compose -f docker-compose.test.yml down

test-unit: ## Run unit tests only
	@echo "🧪 Running unit tests..."
	docker-compose exec backend npm test
	docker-compose exec frontend npm test

test-integration: ## Run integration tests
	@echo "🧪 Running integration tests..."
	docker-compose exec backend npm run test:integration

# Build commands
build: ## Build all Docker images
	@echo "🔨 Building all images..."
	docker build -f Dockerfile.frontend -t email-assist-frontend:latest .
	docker build -f Dockerfile.backend -t email-assist-backend:latest .

build-frontend: ## Build frontend image only
	@echo "🔨 Building frontend image..."
	docker build -f Dockerfile.frontend -t email-assist-frontend:latest .

build-backend: ## Build backend image only
	@echo "🔨 Building backend image..."
	docker build -f Dockerfile.backend -t email-assist-backend:latest .

# Database operations
db-migrate: ## Run database migrations
	@echo "🗄️ Running database migrations..."
	docker-compose exec backend npm run db:migrate

db-seed: ## Seed database with test data
	@echo "🌱 Seeding database..."
	docker-compose exec backend npm run db:seed

db-reset: ## Reset database (DESTRUCTIVE!)
	@echo "⚠️  Resetting database..."
	@read -p "This will destroy all data. Continue? (y/N): " confirm && [ "$$confirm" = "y" ]
	docker-compose exec postgres dropdb -U postgres email_assist
	docker-compose exec postgres createdb -U postgres email_assist
	$(MAKE) db-migrate
	$(MAKE) db-seed

db-backup: ## Create database backup
	@echo "💾 Creating database backup..."
	mkdir -p backups
	docker-compose exec postgres pg_dump -U postgres email_assist > backups/db-backup-$(shell date +%Y%m%d_%H%M%S).sql
	@echo "✅ Backup created in backups/"

db-console: ## Connect to database console
	docker-compose exec postgres psql -U postgres email_assist

# Monitoring and logs
logs: ## Show logs for all services
	docker-compose logs -f

logs-backend: ## Show backend logs only
	docker-compose logs -f backend

logs-frontend: ## Show frontend logs only
	docker-compose logs -f frontend

logs-db: ## Show database logs only
	docker-compose logs -f postgres

logs-redis: ## Show Redis logs only
	docker-compose logs -f redis

status: ## Show service status
	@echo "📊 Service Status:"
	docker-compose ps
	@echo ""
	@echo "📈 Resource Usage:"
	docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

health: ## Check service health
	@echo "🏥 Health Check Results:"
	@echo "Frontend: $$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health || echo "FAIL")"
	@echo "Backend:  $$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health || echo "FAIL")"

# Maintenance
clean: ## Clean up containers, images, and volumes
	@echo "🧹 Cleaning up..."
	docker-compose down --remove-orphans
	docker-compose -f docker-compose.dev.yml down --remove-orphans
	docker-compose -f docker-compose.staging.yml down --remove-orphans
	docker image prune -f
	docker container prune -f

clean-all: ## Clean everything including volumes (DESTRUCTIVE!)
	@echo "⚠️  This will remove all containers, images, and volumes!"
	@read -p "Continue? (y/N): " confirm && [ "$$confirm" = "y" ]
	docker-compose down -v --remove-orphans
	docker-compose -f docker-compose.dev.yml down -v --remove-orphans
	docker-compose -f docker-compose.staging.yml down -v --remove-orphans
	docker system prune -a -f --volumes

backup: ## Create full backup
	@echo "💾 Creating full backup..."
	./deploy.sh backup

restore: ## Restore from backup
	@echo "📦 Available backups:"
	@ls -la backups/
	@read -p "Enter backup directory name: " backup_name && \
	docker-compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS email_assist;" && \
	docker-compose exec postgres createdb -U postgres email_assist && \
	docker-compose exec postgres psql -U postgres email_assist < backups/$$backup_name/database.sql

# Security
security-scan: ## Run security scan on images
	@echo "🔒 Running security scans..."
	docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
		aquasec/trivy:latest image email-assist-frontend:latest
	docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
		aquasec/trivy:latest image email-assist-backend:latest

# Setup
setup: ## Initial project setup
	@echo "🔧 Setting up Email Assist..."
	@if [ ! -f .env ]; then \
		cp .env.docker .env; \
		echo "📄 Created .env file from template"; \
		echo "⚠️  Please edit .env with your configuration"; \
	fi
	@echo "✅ Setup complete. Run 'make dev' to start development environment."

# Quick commands for common tasks
up: dev ## Alias for dev (start development)
down: dev-stop ## Alias for dev-stop
restart: dev-stop dev ## Restart development environment
rebuild: dev-stop dev-build ## Rebuild and restart development