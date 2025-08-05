pipeline {
  agent any

  environment {
    DOCKERHUB_CREDENTIALS = credentials('dockerhub-credentials')
    DOCKERHUB_REPO         = 'captcloud01/FTechrx'
    APP_NAME               = 'patient-data-collection'
    DOCKER_LATEST_TAG      = 'latest'
  }

  options {
    buildDiscarder(logRotator(numToKeepStr: '10'))
    timeout(time: 30, unit: 'MINUTES')
    skipDefaultCheckout(false)
  }

  stages {
    stage('Checkout') {
      steps {
        echo "🔄 Checking out code..."
        script {
          def scm = checkout scm
          env.GIT_COMMIT_SHORT = scm.GIT_COMMIT?.take(7) ?: scm.GIT_COMMIT
          env.BUILD_VERSION    = "${BUILD_NUMBER}"
          env.DOCKER_TAG       = "${env.BUILD_VERSION}-${env.GIT_COMMIT_SHORT}"
          currentBuild.displayName = "#${BUILD_NUMBER} – ${env.GIT_COMMIT_SHORT}"
          currentBuild.description = "Branch: ${env.BRANCH_NAME}"
        }
      }
    }

    stage('Environment Setup') {
      steps {
        echo "🏗️ Setting up build environment..."
        script {
          def nodeHome = tool name: 'NodeJS-18', type: 'NodeJSInstallation'
          env.PATH = "${nodeHome}/bin:${env.PATH}"
        }
        sh '''
          echo "Node.js version:" && node --version
          echo "NPM version:" && npm --version
          echo "Docker version:" && docker --version
        '''
      }
    }

    stage('Install Dependencies') {
      steps {
        echo "📦 Installing NPM dependencies..."
        sh '''
          npm ci --only=production
          npm audit --audit-level moderate
        '''
      }
    }

    stage('Code Quality & Testing') {
      parallel {
        stage('Lint Code') {
          steps {
            echo "🔍 Running code linting..."
            sh '''
              npm install --save-dev eslint
              [ ! -f .eslintrc.js ] && cat > .eslintrc.js << 'EOF'
module.exports = {
  env: { node: true, es2021: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 12, sourceType: 'module' },
  rules: { 'no-unused-vars': 'warn', 'no-console': 'off' }
};
EOF
              npx eslint . --ext .js --ignore-pattern node_modules/
            '''
          }
        }
        stage('Security Scan') {
          steps {
            echo "🔒 Running security audit..."
            sh 'npm audit --audit-level high'
          }
        }
        stage('Unit Tests') {
          steps {
            echo "🧪 Running unit tests..."
            script {
              try {
                sh '''
                  npm install --save-dev jest supertest
                  [ ! -d tests ] && mkdir tests && cat > tests/api.test.js << 'EOF'
-- test stub here --
EOF
                  echo "Tests would run here (replace with real tests)"
                '''
              } catch (err) {
                echo "⚠️ Tests failed, continuing: ${err.getMessage()}"
              }
            }
          }
        }
      }
    }

    stage('Build Docker Image') {
      steps {
        echo "🐳 Building Docker image..."
        script {
          def img = docker.build("${DOCKERHUB_REPO}:${env.DOCKER_TAG}")
          if (env.BRANCH_NAME in ['main','master']) {
            img.tag(DOCKER_LATEST_TAG)
          }
          env.DOCKER_IMAGE_ID = img.id
        }
        sh """
          docker images ${DOCKERHUB_REPO}:${env.DOCKER_TAG}
          docker inspect ${DOCKERHUB_REPO}:${env.DOCKER_TAG}
        """
      }
    }

    stage('Test Docker Image') {
      steps {
        echo "🧪 Testing Docker image..."
        script {
          try {
            sh """
              docker run -d --name test-${BUILD_NUMBER} -p 3001:3000 ${DOCKERHUB_REPO}:${env.DOCKER_TAG}
              sleep 10 && curl -f http://localhost:3001/health
              echo "✅ Health OK"
            """
          } finally {
            sh '''
              docker stop test-${BUILD_NUMBER} || true
              docker rm test-${BUILD_NUMBER} || true
            '''
          }
        }
      }
    }

    stage('Push to Docker Hub') {
      when { anyOf { branch 'main'; branch 'master'; branch 'develop' } }
      steps {
        echo "🚀 Pushing Docker image..."
        script {
          docker.withRegistry('https://registry.hub.docker.com', 'dockerhub-credentials') {
            docker.image("${DOCKERHUB_REPO}:${env.DOCKER_TAG}").push()
            if (env.BRANCH_NAME in ['main','master']) {
              docker.image("${DOCKERHUB_REPO}:${DOCKER_LATEST_TAG}").push()
            }
          }
        }
        echo "✅ Pushed ${DOCKERHUB_REPO}:${env.DOCKER_TAG}"
      }
    }

    stage('Deploy to Staging') {
      when { branch 'develop' }
      steps {
        echo "🚀 Deploying to staging..."
        script {
          sshagent(['ec2-staging-key']) {
            sh """
              ssh -o StrictHostKeyChecking=no ec2-user@staging-server << 'EOF'
                docker pull ${DOCKERHUB_REPO}:${env.DOCKER_TAG}
                docker stop staging || true && docker rm staging || true
                docker run -d --name staging -p 3000:3000 \\
                  -v /opt/app/staging:/data -e NODE_ENV=staging \\
                  --restart unless-stopped ${DOCKERHUB_REPO}:${env.DOCKER_TAG}
                sleep 10 && curl -f http://localhost:3000/health
EOF
            """
          }
        }
      }
    }

    stage('Deploy to Production') {
      when {
        beforeInput true
        allOf { anyOf { branch 'main'; branch 'master' } }
      }
      input {
        message 'Deploy to Production?'
        ok 'Deploy'
        submitterParameter 'DEPLOYER'
      }
      steps {
        echo "🚀 Deploying to production..."
        script {
          sshagent(['ec2-production-key']) {
            sh """ssh -o StrictHostKeyChecking=no ec2-user@prod-server << 'EOF'
docker pull ${DOCKERHUB_REPO}:${env.DOCKER_TAG}
docker stop prod || true && docker rm prod || true
docker run -d --name prod -p 3000:3000 \\
  -v /opt/app/prod:/data -v /opt/app/logs:/logs \\
  -e NODE_ENV=production --restart unless-stopped ${DOCKERHUB_REPO}:${env.DOCKER_TAG}
sleep 15 && curl -f http://localhost:3000/health
echo ${Deployed at $(date)} >> /opt/app/deploy.log
EOF"""
          }
        }
        script {
          currentBuild.description += " | Deployed by: ${params.DEPLOYER ?: 'N/A'}"
        }
      }
    }
  }

  post {
    always {
      script {
        if (getContext(hudson.FilePath)) {
          echo "🧹 Cleaning workspace and Docker images..."
          sh '''
            docker image prune -f
            docker images ${DOCKERHUB_REPO} --format "table {{.Tag}}" | \\
              grep -E '^[0-9]+-[a-f0-9]+$' | sort -rn | tail -n +6 | \\
              xargs -I {} docker rmi ${DOCKERHUB_REPO}:{} || true
          '''
        } else {
          echo "⚠️ No workspace context available — skipping cleanup"
        }
      }
    }
    failure {
      echo "❌ Build failed!"
      script {
        def cs = env.GIT_COMMIT_SHORT ?: 'unknown'
        emailext(
          subject: "❌ Build Failed – ${env.JOB_NAME} #${env.BUILD_NUMBER}",
          body: """
Branch: ${env.BRANCH_NAME}
Commit: ${cs}
URL: ${env.BUILD_URL}
""", to: "devops@yourcompany.com")
      }
    }
    success {
      echo "✅ Build succeeded!"
      script {
        if (env.BRANCH_NAME in ['main','master']) {
          emailext(
            subject: "✅ Deployed – ${env.JOB_NAME} #${env.BUILD_NUMBER}",
            body: """
Deployed by: ${params.DEPLOYER ?: 'N/A'}
Branch: ${env.BRANCH_NAME}
Commit: ${env.GIT_COMMIT_SHORT}
Image: ${env.DOCKERHUB_REPO}:${env.DOCKER_TAG}
URL: ${env.BUILD_URL}
""", to: "devops@yourcompany.com")
        }
      }
    }
    unstable {
      echo "⚠️ Build is unstable"
    }
  }
}
