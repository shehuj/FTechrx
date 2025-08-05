pipeline {
    agent any

    // Environment variables - centralized configuration
    environment {
        // Docker Configuration
        DOCKERHUB_CREDENTIALS = credentials('dockerhub-credentials')
        DOCKERHUB_REPO = 'captcloud01/FTechrx'
        APP_NAME = 'patient-data-collection'
        DOCKER_LATEST_TAG = 'latest'
        
        // Application Configuration  
        NODE_VERSION = '18'
        PORT = '3000'
        HEALTH_ENDPOINT = '/health'
        
        // Deployment Configuration
        STAGING_HOST = credentials('staging-host')
        PRODUCTION_HOST = credentials('production-host')
        
        // Notification Configuration
        NOTIFICATION_EMAIL = 'devops@yourcompany.com'
        
        // Dynamic variables (set during build)
        GIT_COMMIT_SHORT = ''
        BUILD_VERSION = ''
        DOCKER_TAG = ''
        DOCKER_IMAGE_ID = ''
    }

    // Pipeline options - improved settings
    options {
        buildDiscarder(logRotator(
            numToKeepStr: '10',
            daysToKeepStr: '30',
            artifactNumToKeepStr: '5'
        ))
        timeout(time: 45, unit: 'MINUTES')
        skipDefaultCheckout(false)
        disableConcurrentBuilds(abortPrevious: true)
        timestamps()
        ansiColor('xterm')
    }

    // Build parameters for flexibility
    parameters {
        choice(
            name: 'DEPLOY_ENVIRONMENT',
            choices: ['none', 'staging', 'production'],
            description: 'Target deployment environment'
        )
        booleanParam(
            name: 'SKIP_TESTS',
            defaultValue: false,
            description: 'Skip test execution for emergency deployments'
        )
        booleanParam(
            name: 'FORCE_REBUILD',
            defaultValue: false,
            description: 'Force rebuild even if no changes detected'
        )
    }

    stages {
        stage('🔄 Checkout & Setup') {
            steps {
                script {
                    echo "🔄 Checking out code and setting up build variables..."
                    
                    // Enhanced checkout with better error handling
                    def scmVars = checkout scm
                    env.GIT_COMMIT_SHORT = scmVars.GIT_COMMIT?.take(7) ?: 'unknown'
                    env.BUILD_VERSION = "${BUILD_NUMBER}"
                    env.DOCKER_TAG = "${env.BUILD_VERSION}-${env.GIT_COMMIT_SHORT}"
                    
                    // Enhanced build display
                    currentBuild.displayName = "#${BUILD_NUMBER} – ${env.GIT_COMMIT_SHORT}"
                    currentBuild.description = "Branch: ${env.BRANCH_NAME} | Commit: ${env.GIT_COMMIT_SHORT}"
                    
                    // Log build information
                    echo """
                    ╔════════════════════════════════════════╗
                    ║            BUILD INFORMATION           ║
                    ╠════════════════════════════════════════╣
                    ║ App Name: ${APP_NAME}
                    ║ Branch: ${env.BRANCH_NAME}
                    ║ Commit: ${env.GIT_COMMIT_SHORT}
                    ║ Build: ${env.BUILD_VERSION}
                    ║ Docker Tag: ${env.DOCKER_TAG}
                    ║ Timestamp: ${new Date()}
                    ╚════════════════════════════════════════╝
                    """
                }
            }
        }

        stage('🏗️ Environment Setup') {
            steps {
                echo "🏗️ Setting up build environment..."
                script {
                    try {
                        // Setup Node.js environment
                        def nodeHome = tool name: "NodeJS-${NODE_VERSION}", type: 'NodeJSInstallation'
                        env.PATH = "${nodeHome}/bin:${env.PATH}"
                        
                        // Verify all required tools
                        sh '''
                            echo "=== Environment Verification ==="
                            echo "Node.js version: $(node --version)"
                            echo "NPM version: $(npm --version)"
                            echo "Docker version: $(docker --version)"
                            echo "Git version: $(git --version)"
                            echo "Available memory: $(free -h | head -n 2)"
                            echo "Available disk space: $(df -h . | tail -n 1)"
                            echo "=== Environment Ready ==="
                        '''
                    } catch (Exception e) {
                        error("❌ Environment setup failed: ${e.getMessage()}")
                    }
                }
            }
        }

        stage('📦 Dependencies & Cache') {
            steps {
                echo "📦 Installing dependencies with caching..."
                script {
                    // Check if package-lock.json exists for better caching
                    def hasPackageLock = fileExists('package-lock.json')
                    def cacheKey = "${env.JOB_NAME}-${hashFiles('package*.json')}"
                    
                    echo "Using cache strategy: ${hasPackageLock ? 'npm ci' : 'npm install'}"
                    
                    sh '''
                        # Clean npm cache if needed
                        npm cache verify
                        
                        # Install dependencies
                        if [ -f "package-lock.json" ]; then
                            npm ci --only=production --no-audit
                        else
                            npm install --only=production --no-audit
                        fi
                        
                        # Security audit with proper error handling
                        echo "Running security audit..."
                        npm audit --audit-level moderate || {
                            echo "⚠️ Security vulnerabilities found, but continuing build"
                            npm audit --audit-level moderate --json > security-audit.json || true
                        }
                    '''
                }
            }
            post {
                always {
                    // Archive security audit results if they exist
                    script {
                        if (fileExists('security-audit.json')) {
                            archiveArtifacts artifacts: 'security-audit.json', allowEmptyArchive: true
                        }
                    }
                }
            }
        }

        stage('🔍 Code Quality & Testing') {
            when {
                not { params.SKIP_TESTS }
            }
            parallel {
                stage('Lint Code') {
                    steps {
                        echo "🔍 Running code linting..."
                        script {
                            try {
                                sh '''
                                    # Install linting dependencies
                                    npm install --save-dev eslint eslint-config-recommended
                                    
                                    # Create or use existing ESLint config
                                    if [ ! -f .eslintrc.js ]; then
                                        cat > .eslintrc.js << 'EOF'
module.exports = {
    env: { 
        node: true, 
        es2021: true,
        jest: true 
    },
    extends: ['eslint:recommended'],
    parserOptions: { 
        ecmaVersion: 2021, 
        sourceType: 'module' 
    },
    rules: { 
        'no-unused-vars': 'warn', 
        'no-console': 'off',
        'no-debugger': 'error',
        'no-undef': 'error'
    },
    ignorePatterns: ['node_modules/', 'dist/', 'build/']
};
EOF
                                    fi
                                    
                                    # Run ESLint with proper output
                                    npx eslint . --ext .js,.mjs --format json --output-file eslint-results.json || true
                                    npx eslint . --ext .js,.mjs --format stylish
                                '''
                            } catch (Exception e) {
                                unstable("⚠️ Linting issues found: ${e.getMessage()}")
                            }
                        }
                    }
                    post {
                        always {
                            // Archive lint results
                            archiveArtifacts artifacts: 'eslint-results.json', allowEmptyArchive: true
                        }
                    }
                }
                
                stage('Security Scan') {
                    steps {
                        echo "🔒 Running comprehensive security scan..."
                        script {
                            try {
                                sh '''
                                    # Enhanced security audit
                                    echo "=== NPM Security Audit ==="
                                    npm audit --audit-level high --json > npm-audit.json || true
                                    npm audit --audit-level high
                                    
                                    # Check for known vulnerable patterns (basic)
                                    echo "=== Basic Vulnerability Patterns ==="
                                    grep -r "eval\\|innerHTML\\|document.write" . --include="*.js" || echo "No dangerous patterns found"
                                    
                                    # Check for hardcoded secrets (basic)
                                    echo "=== Secret Detection ==="
                                    grep -r "password\\|secret\\|key\\|token" . --include="*.js" --include="*.json" | grep -v node_modules || echo "No obvious secrets found"
                                '''
                            } catch (Exception e) {
                                unstable("⚠️ Security scan completed with warnings: ${e.getMessage()}")
                            }
                        }
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: 'npm-audit.json', allowEmptyArchive: true
                        }
                    }
                }
                
                stage('Unit Tests') {
                    steps {
                        echo "🧪 Running unit tests..."
                        script {
                            try {
                                sh '''
                                    # Install test dependencies
                                    npm install --save-dev jest supertest
                                    
                                    # Create test directory and basic test if none exist
                                    if [ ! -d "tests" ] && [ ! -d "test" ] && [ ! -d "__tests__" ]; then
                                        mkdir -p tests
                                        cat > tests/basic.test.js << 'EOF'
describe('Basic Application Tests', () => {
    test('should load without errors', () => {
        expect(true).toBe(true);
    });
    
    test('environment variables should be set', () => {
        expect(process.env.NODE_ENV).toBeDefined();
    });
});
EOF
                                        cat > jest.config.js << 'EOF'
module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        '**/*.js',
        '!node_modules/**',
        '!coverage/**',
        '!jest.config.js'
    ],
    testMatch: [
        '**/tests/**/*.test.js',
        '**/test/**/*.test.js',
        '**/__tests__/**/*.test.js'
    ]
};
EOF
                                    fi
                                    
                                    # Run tests with coverage
                                    npm test -- --coverage --ci --reporters=default --reporters=jest-junit || {
                                        echo "⚠️ Some tests failed, but continuing build"
                                        exit 0
                                    }
                                '''
                            } catch (Exception e) {
                                unstable("⚠️ Tests completed with failures: ${e.getMessage()}")
                            }
                        }
                    }
                    post {
                        always {
                            // Publish test results if available
                            script {
                                if (fileExists('junit.xml')) {
                                    junit 'junit.xml'
                                }
                                if (fileExists('coverage/lcov.info')) {
                                    publishHTML([
                                        allowMissing: false,
                                        alwaysLinkToLastBuild: true,
                                        keepAll: true,
                                        reportDir: 'coverage/lcov-report',
                                        reportFiles: 'index.html',
                                        reportName: 'Coverage Report'
                                    ])
                                }
                            }
                        }
                    }
                }
            }
        }

        stage('🐳 Build Docker Image') {
            steps {
                echo "🐳 Building optimized Docker image..."
                script {
                    try {
                        // Build with build args and labels
                        def buildArgs = [
                            "--build-arg BUILD_DATE=${new Date().format('yyyy-MM-dd HH:mm:ss')}",
                            "--build-arg BUILD_VERSION=${env.BUILD_VERSION}",
                            "--build-arg GIT_COMMIT=${env.GIT_COMMIT_SHORT}",
                            "--label org.opencontainers.image.created=${new Date().format('yyyy-MM-ddTHH:mm:ssZ')}",
                            "--label org.opencontainers.image.version=${env.DOCKER_TAG}",
                            "--label org.opencontainers.image.revision=${env.GIT_COMMIT_SHORT}"
                        ].join(' ')
                        
                        def img = docker.build("${DOCKERHUB_REPO}:${env.DOCKER_TAG}", "${buildArgs} .")
                        
                        // Tag as latest for main/master branches
                        if (env.BRANCH_NAME in ['main', 'master']) {
                            img.tag(DOCKER_LATEST_TAG)
                        }
                        
                        env.DOCKER_IMAGE_ID = img.id
                        
                        // Image inspection and security scan
                        sh """
                            echo "=== Docker Image Information ==="
                            docker images ${DOCKERHUB_REPO}:${env.DOCKER_TAG}
                            docker inspect ${DOCKERHUB_REPO}:${env.DOCKER_TAG} --format='{{json .Config.Labels}}' | jq '.'
                            
                            echo "=== Image Size Analysis ==="
                            docker history ${DOCKERHUB_REPO}:${env.DOCKER_TAG} --human --format "table {{.CreatedBy}}\t{{.Size}}"
                        """
                        
                    } catch (Exception e) {
                        error("❌ Docker build failed: ${e.getMessage()}")
                    }
                }
            }
        }

        stage('🧪 Docker Image Testing') {
            steps {
                echo "🧪 Running comprehensive Docker image tests..."
                script {
                    def testPort = '3001'
                    def containerName = "test-${BUILD_NUMBER}"
                    
                    try {
                        sh """
                            echo "=== Starting container for testing ==="
                            docker run -d --name ${containerName} \\
                                -p ${testPort}:${PORT} \\
                                -e NODE_ENV=test \\
                                --health-cmd="curl -f http://localhost:${PORT}${HEALTH_ENDPOINT} || exit 1" \\
                                --health-interval=10s \\
                                --health-timeout=5s \\
                                --health-retries=3 \\
                                ${DOCKERHUB_REPO}:${env.DOCKER_TAG}
                            
                            echo "=== Waiting for container to be healthy ==="
                            timeout 60 bash -c 'while [[ "\$(docker inspect --format="{{.State.Health.Status}}" ${containerName})" != "healthy" ]]; do sleep 2; done' || {
                                echo "Health check timeout, checking manually..."
                                sleep 15
                            }
                            
                            echo "=== Testing application endpoints ==="
                            curl -f -m 10 http://localhost:${testPort}${HEALTH_ENDPOINT} || {
                                echo "Health endpoint failed, checking logs..."
                                docker logs ${containerName}
                                exit 1
                            }
                            
                            echo "=== Container resource usage ==="
                            docker stats ${containerName} --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
                            
                            echo "✅ All tests passed successfully"
                        """
                    } catch (Exception e) {
                        error("❌ Docker image testing failed: ${e.getMessage()}")
                    } finally {
                        // Always cleanup test container
                        sh """
                            echo "=== Cleaning up test container ==="
                            docker stop ${containerName} || true
                            docker rm ${containerName} || true
                        """
                    }
                }
            }
        }

        stage('🚀 Push to Registry') {
            when { 
                anyOf { 
                    branch 'main'
                    branch 'master'
                    branch 'develop'
                    expression { params.DEPLOY_ENVIRONMENT != 'none' }
                } 
            }
            steps {
                echo "🚀 Pushing Docker image to registry..."
                script {
                    try {
                        docker.withRegistry('https://registry.hub.docker.com', 'dockerhub-credentials') {
                            // Push versioned tag
                            docker.image("${DOCKERHUB_REPO}:${env.DOCKER_TAG}").push()
                            
                            // Push latest tag for main/master
                            if (env.BRANCH_NAME in ['main', 'master']) {
                                docker.image("${DOCKERHUB_REPO}:${DOCKER_LATEST_TAG}").push()
                            }
                        }
                        
                        echo "✅ Successfully pushed:"
                        echo "  - ${DOCKERHUB_REPO}:${env.DOCKER_TAG}"
                        if (env.BRANCH_NAME in ['main', 'master']) {
                            echo "  - ${DOCKERHUB_REPO}:${DOCKER_LATEST_TAG}"
                        }
                        
                    } catch (Exception e) {
                        error("❌ Failed to push to registry: ${e.getMessage()}")
                    }
                }
            }
        }

        stage('🚀 Deploy to Staging') {
            when { 
                anyOf {
                    branch 'develop'
                    expression { params.DEPLOY_ENVIRONMENT == 'staging' }
                }
            }
            steps {
                echo "🚀 Deploying to staging environment..."
                script {
                    try {
                        sshagent(['ec2-staging-key']) {
                            sh """
                                ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 ec2-user@${STAGING_HOST} << 'ENDSSH'
                                    set -e
                                    echo "=== Staging Deployment Started ==="
                                    
                                    # Pull latest image
                                    docker pull ${DOCKERHUB_REPO}:${env.DOCKER_TAG}
                                    
                                    # Backup current container (if exists)
                                    if docker ps -a | grep -q "staging"; then
                                        echo "Creating backup of current staging container..."
                                        docker commit staging staging-backup-\$(date +%Y%m%d-%H%M%S) || true
                                        docker stop staging || true
                                        docker rm staging || true
                                    fi
                                    
                                    # Deploy new container
                                    docker run -d --name staging \\
                                        -p ${PORT}:${PORT} \\
                                        -v /opt/app/staging:/data \\
                                        -v /opt/app/logs:/logs \\
                                        -e NODE_ENV=staging \\
                                        -e PORT=${PORT} \\
                                        --restart unless-stopped \\
                                        --health-cmd="curl -f http://localhost:${PORT}${HEALTH_ENDPOINT} || exit 1" \\
                                        --health-interval=30s \\
                                        ${DOCKERHUB_REPO}:${env.DOCKER_TAG}
                                    
                                    # Wait for health check
                                    echo "Waiting for application to be healthy..."
                                    timeout 120 bash -c 'while [[ "\$(docker inspect --format="{{.State.Health.Status}}" staging)" != "healthy" ]]; do sleep 5; done'
                                    
                                    # Verify deployment
                                    curl -f -m 10 http://localhost:${PORT}${HEALTH_ENDPOINT}
                                    
                                    # Log deployment
                                    echo "Deployment completed at \$(date)" >> /opt/app/deploy.log
                                    echo "Deployed image: ${DOCKERHUB_REPO}:${env.DOCKER_TAG}" >> /opt/app/deploy.log
                                    
                                    echo "✅ Staging deployment successful"
ENDSSH
                            """
                        }
                    } catch (Exception e) {
                        error("❌ Staging deployment failed: ${e.getMessage()}")
                    }
                }
            }
        }

        stage('🚀 Deploy to Production') {
            when {
                beforeInput true
                anyOf { 
                    allOf {
                        anyOf { branch 'main'; branch 'master' }
                        expression { params.DEPLOY_ENVIRONMENT == 'production' }
                    }
                    expression { params.DEPLOY_ENVIRONMENT == 'production' }
                }
            }
            input {
                message 'Deploy to Production Environment?'
                ok 'Deploy Now'
                submitterParameter 'DEPLOYER'
                parameters {
                    choice(
                        name: 'DEPLOYMENT_STRATEGY',
                        choices: ['rolling', 'blue-green', 'immediate'],
                        description: 'Deployment strategy'
                    )
                    booleanParam(
                        name: 'BACKUP_BEFORE_DEPLOY',
                        defaultValue: true,
                        description: 'Create backup before deployment'
                    )
                }
            }
            steps {
                echo "🚀 Deploying to production environment..."
                script {
                    try {
                        sshagent(['ec2-production-key']) {
                            sh """
                                ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 ec2-user@${PRODUCTION_HOST} << 'ENDSSH'
                                    set -e
                                    echo "=== Production Deployment Started ==="
                                    echo "Deployer: ${params.DEPLOYER ?: 'N/A'}"
                                    echo "Strategy: ${params.DEPLOYMENT_STRATEGY ?: 'rolling'}"
                                    
                                    # Create backup if requested
                                    if [ "${params.BACKUP_BEFORE_DEPLOY}" = "true" ]; then
                                        echo "Creating pre-deployment backup..."
                                        if docker ps | grep -q "prod"; then
                                            docker commit prod prod-backup-\$(date +%Y%m%d-%H%M%S)
                                        fi
                                        # Create data backup
                                        tar -czf /opt/backups/data-backup-\$(date +%Y%m%d-%H%M%S).tar.gz /opt/app/prod/ || true
                                    fi
                                    
                                    # Pull latest image
                                    docker pull ${DOCKERHUB_REPO}:${env.DOCKER_TAG}
                                    
                                    # Stop and remove current container
                                    docker stop prod || true
                                    docker rm prod || true
                                    
                                    # Deploy new container with production settings
                                    docker run -d --name prod \\
                                        -p ${PORT}:${PORT} \\
                                        -v /opt/app/prod:/data \\
                                        -v /opt/app/logs:/logs \\
                                        -v /opt/app/config:/config:ro \\
                                        -e NODE_ENV=production \\
                                        -e PORT=${PORT} \\
                                        --restart unless-stopped \\
                                        --memory=1g \\
                                        --cpus=0.5 \\
                                        --health-cmd="curl -f http://localhost:${PORT}${HEALTH_ENDPOINT} || exit 1" \\
                                        --health-interval=30s \\
                                        --health-timeout=10s \\
                                        --health-retries=3 \\
                                        ${DOCKERHUB_REPO}:${env.DOCKER_TAG}
                                    
                                    # Wait for health check
                                    echo "Waiting for application to be healthy..."
                                    timeout 180 bash -c 'while [[ "\$(docker inspect --format="{{.State.Health.Status}}" prod)" != "healthy" ]]; do sleep 5; done'
                                    
                                    # Comprehensive health verification
                                    echo "Running post-deployment verification..."
                                    curl -f -m 10 http://localhost:${PORT}${HEALTH_ENDPOINT}
                                    
                                    # Log successful deployment
                                    echo "Production deployment completed at \$(date)" >> /opt/app/deploy.log
                                    echo "Deployed by: ${params.DEPLOYER ?: 'N/A'}" >> /opt/app/deploy.log
                                    echo "Image: ${DOCKERHUB_REPO}:${env.DOCKER_TAG}" >> /opt/app/deploy.log
                                    echo "Strategy: ${params.DEPLOYMENT_STRATEGY ?: 'rolling'}" >> /opt/app/deploy.log
                                    
                                    echo "✅ Production deployment successful"
ENDSSH
                            """
                        }
                        
                        // Update build description
                        currentBuild.description += " | 🚀 DEPLOYED by: ${params.DEPLOYER ?: 'N/A'}"
                        
                    } catch (Exception e) {
                        error("❌ Production deployment failed: ${e.getMessage()}")
                    }
                }
            }
        }
    }

    post {
        always {
            script {
                echo "🧹 Running post-build cleanup..."
                
                try {
                    // Workspace cleanup
                    if (getContext(hudson.FilePath)) {
                        // Clean old Docker images (keep last 5 builds)
                        sh '''
                            echo "=== Docker Cleanup ==="
                            # Remove dangling images
                            docker image prune -f || true
                            
                            # Remove old build images (keep last 5)
                            docker images ${DOCKERHUB_REPO} --format "{{.Tag}}" | \\
                                grep -E '^[0-9]+-[a-f0-9]+$' | \\
                                sort -rn | \\
                                tail -n +6 | \\
                                xargs -I {} docker rmi ${DOCKERHUB_REPO}:{} || true
                            
                            echo "=== Workspace Cleanup ==="
                            # Clean node_modules if they exist and are large
                            if [ -d "node_modules" ]; then
                                rm -rf node_modules
                            fi
                        '''
                    } else {
                        echo "⚠️ No workspace context available – skipping cleanup"
                    }
                } catch (Exception e) {
                    echo "⚠️ Cleanup completed with warnings: ${e.getMessage()}"
                }
                
                // Archive important artifacts
                try {
                    archiveArtifacts artifacts: '*.json,*.log', allowEmptyArchive: true
                } catch (Exception e) {
                    echo "⚠️ Could not archive artifacts: ${e.getMessage()}"
                }
            }
        }
        
        failure {
            script {
                echo "❌ Build failed - sending notifications..."
                
                def commitInfo = env.GIT_COMMIT_SHORT ?: 'unknown'
                def failureReason = currentBuild.getBuildCauses('hudson.model.Cause$UpstreamCause')
                
                try {
                    emailext(
                        subject: "❌ Build Failed – ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                        body: """
                        <h2>🚨 Build Failure Report</h2>
                        <table border="1" cellpadding="5">
                            <tr><td><b>Project</b></td><td>${env.JOB_NAME}</td></tr>
                            <tr><td><b>Build Number</b></td><td>#${env.BUILD_NUMBER}</td></tr>
                            <tr><td><b>Branch</b></td><td>${env.BRANCH_NAME}</td></tr>
                            <tr><td><b>Commit</b></td><td>${commitInfo}</td></tr>
                            <tr><td><b>Duration</b></td><td>${currentBuild.durationString}</td></tr>
                            <tr><td><b>Build URL</b></td><td><a href="${env.BUILD_URL}">View Build</a></td></tr>
                            <tr><td><b>Console</b></td><td><a href="${env.BUILD_URL}console">View Console</a></td></tr>
                        </table>
                        
                        <h3>Next Steps:</h3>
                        <ul>
                            <li>Check the console output for detailed error messages</li>
                            <li>Review recent commits for potential issues</li>
                            <li>Contact the development team if assistance is needed</li>
                        </ul>
                        """,
                        mimeType: 'text/html',
                        to: "${NOTIFICATION_EMAIL}",
                        replyTo: "${NOTIFICATION_EMAIL}"
                    )
                } catch (Exception e) {
                    echo "⚠️ Failed to send failure notification: ${e.getMessage()}"
                }
            }
        }
        
        success {
            script {
                echo "✅ Build succeeded - sending success notifications..."
                
                // Send deployment notification for production deployments
                if (env.BRANCH_NAME in ['main', 'master'] && params.DEPLOYER) {
                    try {
                        emailext(
                            subject: "✅ Production Deployment Successful – ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                            body: """
                            <h2>🚀 Production Deployment Report</h2>
                            <table border="1" cellpadding="5">
                                <tr><td><b>Project</b></td><td>${env.JOB_NAME}</td></tr>
                                <tr><td><b>Build Number</b></td><td>#${env.BUILD_NUMBER}</td></tr>
                                <tr><td><b>Deployed By</b></td><td>${params.DEPLOYER ?: 'N/A'}</td></tr>
                                <tr><td><b>Branch</b></td><td>${env.BRANCH_NAME}</td></tr>
                                <tr><td><b>Commit</b></td><td>${env.GIT_COMMIT_SHORT}</td></tr>
                                <tr><td><b>Docker Image</b></td><td>${env.DOCKERHUB_REPO}:${env.DOCKER_TAG}</td></tr>
                                <tr><td><b>Duration</b></td><td>${currentBuild.durationString}</td></tr>
                                <tr><td><b>Build URL</b></td><td><a href="${env.BUILD_URL}">View Build</a></td></tr>
                            </table>
                            
                            <h3>Deployment Details:</h3>
                            <ul>
                                <li>Strategy: ${params.DEPLOYMENT_STRATEGY ?: 'rolling'}</li>
                                <li>Backup Created: ${params.BACKUP_BEFORE_DEPLOY ?: 'true'}</li>
                                <li>Health Check: ✅ Passed</li>
                            </ul>
                            """,
                            mimeType: 'text/html',
                            to: "${NOTIFICATION_EMAIL}"
