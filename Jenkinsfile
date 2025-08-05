# FTechrx Patient Data Collection - Build, Test & Deploy DSL
# Domain Specific Language for CI/CD Pipeline

apiVersion: "dsl/v1"
kind: "Pipeline"
metadata:
  name: "ftechrx-patient-data-collection"
  description: "Build, test and deploy pipeline for FTechrx patient data collection system"
  
config:
  # Environment Configuration
  environments:
    development:
      node_version: "18"
      docker_registry: "docker.io"
      namespace: "ftechrx-dev"
    
    staging:
      node_version: "18"
      docker_registry: "docker.io"
      namespace: "ftechrx-staging"
    
    production:
      node_version: "18"
      docker_registry: "docker.io"
      namespace: "ftechrx-prod"

  # Docker Configuration
  docker:
    registry: "${DOCKER_REGISTRY:-docker.io}"
    username: "${DOCKER_USERNAME}"
    password: "${DOCKER_PASSWORD}"
    image_name: "patient-data-collection"
    tags:
      - "latest"
      - "${BUILD_NUMBER}"
      - "${GIT_COMMIT_SHORT}"

  # Application Configuration
  application:
    name: "patient-data-collection"
    type: "nodejs"
    port: 3000
    health_check: "/health"

# Pipeline Stages
stages:
  # Stage 1: Environment Setup
  - name: "setup"
    description: "Setup build environment and dependencies"
    steps:
      - name: "checkout_code"
        action: "git.checkout"
        params:
          repository: "https://github.com/shehuj/FTechrx.git"
          branch: "${GIT_BRANCH:-main}"
      
      - name: "setup_node"
        action: "node.setup"
        params:
          version: "${NODE_VERSION}"
          cache: true
      
      - name: "install_dependencies"
        action: "npm.install"
        params:
          cache: true
          production: false

  # Stage 2: Code Quality & Security
  - name: "quality"
    description: "Run code quality and security checks"
    steps:
      - name: "lint_code"
        action: "npm.run"
        params:
          script: "lint"
        on_failure: "continue"
      
      - name: "security_audit"
        action: "npm.audit"
        params:
          severity: "moderate"
        on_failure: "fail"
      
      - name: "dependency_check"
        action: "security.dependency_check"
        params:
          format: "json"
          output: "dependency-check-report.json"

  # Stage 3: Testing
  - name: "test"
    description: "Run application tests"
    parallel: true
    steps:
      - name: "unit_tests"
        action: "npm.test"
        params:
          script: "test:unit"
          coverage: true
          reporter: "json"
      
      - name: "integration_tests"
        action: "npm.test"
        params:
          script: "test:integration"
          environment: "test"
          database: "test_db"
      
      - name: "api_tests"
        action: "api.test"
        params:
          collection: "postman/patient-api.json"
          environment: "test"

  # Stage 4: Build
  - name: "build"
    description: "Build application artifacts"
    steps:
      - name: "create_env_file"
        action: "file.create"
        params:
          path: ".env"
          content: |
            NODE_ENV=production
            PORT=3000
            DB_HOST=${DB_HOST}
            DB_PORT=${DB_PORT}
            DB_NAME=${DB_NAME}
            DB_USER=${DB_USER}
            DB_PASS=${DB_PASS}
            JWT_SECRET=${JWT_SECRET}
      
      - name: "build_application"
        action: "npm.run"
        params:
          script: "build"
        conditions:
          - exists: "package.json.scripts.build"

  # Stage 5: Docker Build & Test
  - name: "containerize"
    description: "Build and test Docker container"
    steps:
      - name: "docker_build"
        action: "docker.build"
        params:
          dockerfile: "Dockerfile"
          context: "."
          tags: 
            - "${DOCKER_REGISTRY}/${DOCKER_USERNAME}/${APPLICATION_NAME}:${BUILD_NUMBER}"
            - "${DOCKER_REGISTRY}/${DOCKER_USERNAME}/${APPLICATION_NAME}:latest"
          build_args:
            NODE_ENV: "production"
            PORT: "3000"
      
      - name: "container_security_scan"
        action: "security.container_scan"
        params:
          image: "${DOCKER_REGISTRY}/${DOCKER_USERNAME}/${APPLICATION_NAME}:${BUILD_NUMBER}"
          severity: "HIGH"
      
      - name: "container_test"
        action: "docker.test"
        params:
          image: "${DOCKER_REGISTRY}/${DOCKER_USERNAME}/${APPLICATION_NAME}:${BUILD_NUMBER}"
          tests:
            - name: "health_check"
              command: "curl -f http://localhost:3000/health || exit 1"
              timeout: "30s"
            - name: "api_response"
              command: "curl -f http://localhost:3000/api/patients || exit 1"
              timeout: "30s"

  # Stage 6: Deploy to Registry
  - name: "publish"
    description: "Push container to Docker registry"
    conditions:
      - branch: ["main", "develop"]
      - tests: "passed"
    steps:
      - name: "docker_login"
        action: "docker.login"
        params:
          registry: "${DOCKER_REGISTRY}"
          username: "${DOCKER_USERNAME}"
          password: "${DOCKER_PASSWORD}"
      
      - name: "docker_push"
        action: "docker.push"
        params:
          images:
            - "${DOCKER_REGISTRY}/${DOCKER_USERNAME}/${APPLICATION_NAME}:${BUILD_NUMBER}"
            - "${DOCKER_REGISTRY}/${DOCKER_USERNAME}/${APPLICATION_NAME}:latest"

  # Stage 7: Deploy to Environment
  - name: "deploy"
    description: "Deploy to target environment"
    conditions:
      - branch: "main"
      - tests: "passed"
      - manual_approval: true
    steps:
      - name: "deploy_staging"
        action: "deploy.docker_compose"
        params:
          compose_file: "docker-compose.yml"
          environment: "staging"
          services:
            - "patient-data-collection"
            - "nginx"
            - "postgres"
        when:
          branch: "develop"
      
      - name: "deploy_production"
        action: "deploy.docker_compose"
        params:
          compose_file: "docker-compose.prod.yml"
          environment: "production"
          services:
            - "patient-data-collection"
            - "nginx"
            - "postgres"
        when:
          branch: "main"
      
      - name: "health_check_post_deploy"
        action: "http.get"
        params:
          url: "${DEPLOY_URL}/health"
          expected_status: 200
          timeout: "60s"
          retries: 5

  # Stage 8: Post-Deploy Actions
  - name: "post_deploy"
    description: "Post-deployment actions and notifications"
    steps:
      - name: "run_smoke_tests"
        action: "api.test"
        params:
          collection: "postman/smoke-tests.json"
          environment: "${DEPLOY_ENV}"
      
      - name: "update_documentation"
        action: "docs.update"
        params:
          version: "${BUILD_NUMBER}"
          changelog: true
      
      - name: "notify_team"
        action: "notification.send"
        params:
          channels: ["slack", "email"]
          message: |
            🚀 FTechrx Patient Data Collection deployed successfully!
            
            Environment: ${DEPLOY_ENV}
            Version: ${BUILD_NUMBER}
            Commit: ${GIT_COMMIT}
            
            Health Check: ${DEPLOY_URL}/health

# Triggers
triggers:
  - name: "code_push"
    event: "git.push"
    branches: ["main", "develop", "feature/*"]
    
  - name: "pull_request"
    event: "git.pull_request"
    actions: ["opened", "synchronize"]
    
  - name: "scheduled_build"
    event: "schedule"
    cron: "0 2 * * *"  # Daily at 2 AM
    branches: ["main"]

# Notifications
notifications:
  slack:
    webhook: "${SLACK_WEBHOOK_URL}"
    channels: ["#deployments", "#dev-team"]
    events: ["build_started", "build_completed", "build_failed", "deploy_completed"]
  
  email:
    recipients: ["${TEAM_EMAIL}"]
    events: ["build_failed", "deploy_completed"]

# Environment Variables Required
env_vars:
  required:
    - DOCKER_USERNAME
    - DOCKER_PASSWORD
    - DB_HOST
    - DB_USER
    - DB_PASS
    - JWT_SECRET
  optional:
    - SLACK_WEBHOOK_URL
    - TEAM_EMAIL
    - DOCKER_REGISTRY

# Cleanup Policy
cleanup:
  images:
    keep_latest: 10
    remove_untagged: true
  
  builds:
    keep_successful: 50
    keep_failed: 10
    
  logs:
    retention_days: 30
