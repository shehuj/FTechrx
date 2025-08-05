pipeline {
  agent any

  environment {
    DOCKERHUB_CREDENTIALS = credentials('dockerhub-credentials')
    DOCKERHUB_REPO         = 'captcloud01/dataSets'
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
          currentBuild.displayName = "#${BUILD_NUMBER} - ${env.GIT_COMMIT_SHORT}"
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

    stage('Install Dependencies') { /* unchanged */ }

    stage('Code Quality & Testing') { /* unchanged */ }

    stage('Build Docker Image') { /* unchanged */ }

    stage('Test Docker Image') { /* unchanged */ }

    stage('Push to Docker Hub') { /* unchanged */ }

    stage('Deploy to Staging') { /* unchanged */ }

    stage('Deploy to Production') {
      when {
        beforeInput true
        allOf {
          anyOf { branch 'main'; branch 'master' }
        }
      }
      input {
        message 'Deploy to Production?'
        ok 'Deploy'
        submitterParameter 'DEPLOYER'
      }
      steps {
        echo "🚀 Deploying to production environment..."
        script { /* deployment logic */ }
        script { currentBuild.description += " | Deployed by: ${params.DEPLOYER ?: 'N/A'}" }
      }
    }
  }

  post {
    always {
      script {
        if (getContext(hudson.FilePath)) {
          echo "🧹 Cleaning up workspace and Docker images..."
          sh '''
            docker image prune -f
            docker images ${DOCKERHUB_REPO} --format "table {{.Tag}}" | \
              grep -E '^[0-9]+-[a-f0-9]+$' | sort -rn | tail -n +6 | xargs -I {} docker rmi ${DOCKERHUB_REPO}:{} || true
          '''
        } else {
          echo "⚠️ No workspace context available — skipping cleanup"
        }
      }
    }

    failure {
      echo "❌ Pipeline failed!"
      script {
        def cs = env.GIT_COMMIT_SHORT ?: 'unknown'
        emailext(
          subject: "❌ Build Failed – ${env.JOB_NAME} #${env.BUILD_NUMBER}",
          body: """
            Build failed.
            Branch: ${env.BRANCH_NAME}
            Commit (short): ${cs}
            Build URL: ${env.BUILD_URL}
          """,
          to: "devops@yourcompany.com"
        )
      }
    }

    success {
      echo "✅ Pipeline completed successfully!"
      script {
        if (env.BRANCH_NAME in ['main','master']) {
          emailext(
            subject: "✅ Production Deployment Successful – ${env.JOB_NAME} #${env.BUILD_NUMBER}",
            body: """
              Deployed by: ${params.DEPLOYER ?: 'N/A'}
              Branch: ${env.BRANCH_NAME}
              Commit (short): ${env.GIT_COMMIT_SHORT}
              Docker Image: ${env.DOCKERHUB_REPO}:${env.DOCKER_TAG}
              Build URL: ${env.BUILD_URL}
            """,
            to: "devops@yourcompany.com"
          )
        }
      }
    }

    unstable {
      echo "⚠️ Build is unstable"
    }
  }
}
