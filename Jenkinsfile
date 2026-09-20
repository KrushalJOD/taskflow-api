pipeline {
    agent any

    // Tools this pipeline expects to be configured under
    // Manage Jenkins > Tools (NodeJS plugin) and Manage Jenkins > Global
    // Tool Configuration (SonarQube Scanner plugin).
    tools {
        nodejs 'NodeJS-18'
    }

    environment {
        IMAGE_NAME        = 'taskflow-api'
        IMAGE_TAG          = "build-${env.BUILD_NUMBER}"
        RELEASE_TAG        = "v1.0.${env.BUILD_NUMBER}"
        SONARQUBE_ENV      = 'SonarQubeServer'          // Name of the SonarQube server config in Jenkins
        STAGING_URL        = 'http://localhost:3001'
        PRODUCTION_URL     = 'http://localhost:3000'
        NOTIFY_EMAIL       = 'krushalprajapati1@gmail.com'
        JWT_SECRET         = credentials('taskflow-jwt-secret') // Jenkins credential (secret text)
    }

    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '15'))
        disableConcurrentBuilds()
    }

    stages {

        stage('Checkout') {
            steps {
                echo "Checking out TaskFlow API source from GitHub"
                checkout scm
            }
        }

        // ---------------------------------------------------------------
        // 1. BUILD
        // ---------------------------------------------------------------
        stage('Build') {
            steps {
                echo "Installing dependencies and building versioned build artefact ${IMAGE_TAG}"
                sh 'npm ci'
                sh "docker build --build-arg APP_VERSION=${IMAGE_TAG} -t ${IMAGE_NAME}:${IMAGE_TAG} ."
                // Also keep a "latest" tag pointing at this build for convenience.
                sh "docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest"
            }
            post {
                success {
                    echo "Build stage succeeded: image ${IMAGE_NAME}:${IMAGE_TAG} created."
                }
            }
        }

        // ---------------------------------------------------------------
        // 2. TEST
        // ---------------------------------------------------------------
        stage('Test') {
            steps {
                echo 'Running unit and integration tests (Jest + Supertest) with coverage'
                sh 'npm test'
            }
            post {
                always {
                    junit testResults: 'test-results/junit.xml', allowEmptyResults: true
                    archiveArtifacts artifacts: 'coverage/**', allowEmptyArchive: true
                }
                failure {
                    emailext(
                        subject: "TaskFlow CI: Test stage FAILED - Build #${env.BUILD_NUMBER}",
                        body: "The Test stage failed on build #${env.BUILD_NUMBER}. See attached log.",
                        to: "${NOTIFY_EMAIL}",
                        attachLog: true
                    )
                }
            }
        }

        // ---------------------------------------------------------------
        // 3. CODE QUALITY
        // ---------------------------------------------------------------
        stage('Code Quality') {
            steps {
                echo 'Running ESLint and SonarQube static analysis'
                sh 'npm run lint'
                withSonarQubeEnv("${SONARQUBE_ENV}") {
                    sh 'npx sonar-scanner'
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'eslint-report.json', allowEmptyArchive: true
                }
            }
        }

        stage('Quality Gate') {
            steps {
                // Waits for SonarQube's webhook to report the quality gate
                // result rather than polling, so the pipeline blocks here
                // instead of racing ahead of the analysis.
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        // ---------------------------------------------------------------
        // 4. SECURITY
        // ---------------------------------------------------------------
        stage('Security') {
            steps {
                echo 'Scanning dependencies (npm audit) and the built image (Trivy)'
                sh 'npm audit --json > audit-report.json || true'
                sh '''
                    trivy image --severity HIGH,CRITICAL --exit-code 0 \
                        --format json -o trivy-report.json ${IMAGE_NAME}:${IMAGE_TAG} || true
                '''
                script {
                    def audit = readJSON file: 'audit-report.json'
                    def critical = audit.metadata?.vulnerabilities?.critical ?: 0
                    def high = audit.metadata?.vulnerabilities?.high ?: 0
                    echo "npm audit summary: ${critical} critical, ${high} high severity findings"
                    if (critical > 0) {
                        error("Aborting: ${critical} CRITICAL severity dependency vulnerabilities found. See audit-report.json.")
                    }
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'audit-report.json, trivy-report.json', allowEmptyArchive: true
                    emailext(
                        subject: "TaskFlow CI: Security scan complete - Build #${env.BUILD_NUMBER}",
                        body: "npm audit and Trivy image scan finished for build #${env.BUILD_NUMBER}. Reports attached.",
                        to: "${NOTIFY_EMAIL}",
                        attachmentsPattern: 'audit-report.json,trivy-report.json'
                    )
                }
            }
        }

        // ---------------------------------------------------------------
        // 5. DEPLOY (to staging)
        // ---------------------------------------------------------------
        stage('Deploy') {
            steps {
                echo 'Deploying build artefact to the staging environment'
                sh '''
                    IMAGE_NAME=${IMAGE_NAME} IMAGE_TAG=${IMAGE_TAG} JWT_SECRET=${JWT_SECRET} \
                        docker compose -f docker-compose.staging.yml up -d --remove-orphans
                '''
                // Smoke test: wait for the staging container to report healthy
                // before letting later stages proceed.
                sh '''
                    for i in $(seq 1 10); do
                        STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${STAGING_URL}/health || echo "000")
                        if [ "$STATUS" = "200" ]; then
                            echo "Staging is healthy (attempt $i)"
                            exit 0
                        fi
                        echo "Staging not ready yet (attempt $i), retrying..."
                        sleep 5
                    done
                    echo "Staging failed to become healthy in time"
                    exit 1
                '''
            }
            post {
                failure {
                    emailext(
                        subject: "TaskFlow CI: Staging deploy FAILED - Build #${env.BUILD_NUMBER}",
                        body: "Deployment to staging failed or the health check timed out on build #${env.BUILD_NUMBER}.",
                        to: "${NOTIFY_EMAIL}",
                        attachLog: true
                    )
                }
            }
        }

        // ---------------------------------------------------------------
        // 6. RELEASE (promote to production)
        // ---------------------------------------------------------------
        stage('Release') {
            steps {
                // Manual gate before touching production - kept short so
                // the pipeline doesn't hang indefinitely if nobody is
                // watching; it fails safe by aborting rather than deploying
                // unattended.
                timeout(time: 10, unit: 'MINUTES') {
                    input message: "Promote build ${IMAGE_TAG} (tagged as ${RELEASE_TAG}) to production?", ok: 'Release'
                }
                echo "Tagging image as release ${RELEASE_TAG} and promoting to production"
                sh "docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:${RELEASE_TAG}"
                sh """
                    git tag -a ${RELEASE_TAG} -m 'Release ${RELEASE_TAG} from build #${env.BUILD_NUMBER}'
                    git push origin ${RELEASE_TAG}
                """
                sh '''
                    IMAGE_NAME=${IMAGE_NAME} RELEASE_TAG=${RELEASE_TAG} JWT_SECRET=${JWT_SECRET} \
                        docker compose -f docker-compose.prod.yml up -d --remove-orphans
                '''
            }
            post {
                success {
                    emailext(
                        subject: "TaskFlow CI: Released ${RELEASE_TAG} to production",
                        body: "Build #${env.BUILD_NUMBER} was promoted to production as release ${RELEASE_TAG}.",
                        to: "${NOTIFY_EMAIL}"
                    )
                }
                aborted {
                    echo "Release stage aborted or timed out - production was left unchanged (rollback = no-op)."
                }
            }
        }

        // ---------------------------------------------------------------
        // 7. MONITORING & ALERTING
        // ---------------------------------------------------------------
        stage('Monitoring') {
            steps {
                echo 'Verifying production health and metrics endpoints post-release'
                sh '''
                    STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${PRODUCTION_URL}/health || echo "000")
                    echo "Production /health returned HTTP $STATUS"
                    if [ "$STATUS" != "200" ]; then
                        echo "Production health check failed after release!"
                        exit 1
                    fi
                    curl -s ${PRODUCTION_URL}/metrics | head -n 20
                '''
            }
            post {
                failure {
                    emailext(
                        subject: "ALERT: TaskFlow production health check FAILED - ${RELEASE_TAG}",
                        body: "The post-release health check against ${PRODUCTION_URL}/health failed for release ${RELEASE_TAG}. Investigate immediately; consider rolling back with the previous RELEASE_TAG via docker-compose.prod.yml.",
                        to: "${NOTIFY_EMAIL}",
                        attachLog: true
                    )
                }
                success {
                    echo "Production is healthy and exporting metrics at ${PRODUCTION_URL}/metrics."
                }
            }
        }
    }

    post {
        success {
            echo "Pipeline completed successfully for build #${env.BUILD_NUMBER} (release ${RELEASE_TAG})."
        }
        failure {
            echo "Pipeline failed. See the failing stage's logs above."
            emailext(
                subject: "TaskFlow CI: Pipeline FAILED - Build #${env.BUILD_NUMBER}",
                body: "The pipeline failed on build #${env.BUILD_NUMBER}. See attached log for details.",
                to: "${NOTIFY_EMAIL}",
                attachLog: true
            )
        }
    }
}
