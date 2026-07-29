// ============================================================
// Three-Tier DevOps Project - Multibranch CI/CD Pipeline
//
// Branch strategy:
//   dev    -> auto deploy to "three-tier-dev"  namespace  (dev K8s env)
//   test   -> auto deploy to "three-tier-test" namespace  (QA/test env)
//   main   -> deploy to "three-tier"           namespace  (prod, needs approval)
//
// Key idea ("jaha par change hoga wahi run hoga"):
//   We detect WHICH folder changed (src/frontend vs src/backend) using
//   git diff against the previous commit, and only build/push/deploy
//   the component(s) that actually changed. This avoids rebuilding the
//   whole app for a one-line frontend fix.
// ============================================================

pipeline {
    agent any

    environment {
        DOCKERHUB_CREDENTIALS = credentials('docker-creds')     // Jenkins credential ID
        KUBECONFIG_CRED       = credentials('kubeconfig-file')     // Secret file credential
        SONAR_TOKEN            = credentials('sonarqube-token')     // Secret text credential
        IMAGE_TAG              = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'local'}"
        DOCKERHUB_USER         = "your-dockerhub-username"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                script {
                    // Namespace depends on which branch triggered this build
                    env.K8S_NAMESPACE = (env.BRANCH_NAME == 'main') ? 'three-tier' :
                                        (env.BRANCH_NAME == 'test') ? 'three-tier-test' :
                                        'three-tier-dev'
                    echo "Branch: ${env.BRANCH_NAME} -> Namespace: ${env.K8S_NAMESPACE}"
                }
            }
        }

        stage('Detect Changed Components') {
            steps {
                script {
                    def changedFiles = sh(
                        script: "git diff --name-only HEAD~1 HEAD || git diff --name-only HEAD",
                        returnStdout: true
                    ).trim()
                    echo "Changed files:\n${changedFiles}"

                    env.BUILD_FRONTEND = changedFiles.contains('src/frontend/') ? 'true' : 'false'
                    env.BUILD_BACKEND  = changedFiles.contains('src/backend/')  ? 'true' : 'false'
                    env.BUILD_DATABASE = changedFiles.contains('src/database/') ? 'true' : 'false'

                    // First-ever build (no HEAD~1) or infra/k8s-only changes -> build everything once
                    if (changedFiles == '' ) {
                        env.BUILD_FRONTEND = 'true'
                        env.BUILD_BACKEND  = 'true'
                    }
                    echo "BUILD_FRONTEND=${env.BUILD_FRONTEND} BUILD_BACKEND=${env.BUILD_BACKEND}"
                }
            }
        }

        stage('Unit Tests') {
            parallel {
                stage('Backend Tests') {
                    when { environment name: 'BUILD_BACKEND', value: 'true' }
                    steps {
                        dir('src/backend') {
                            sh 'npm install'
                            sh 'npm test'
                        }
                    }
                }
                stage('Frontend Tests') {
                    when { environment name: 'BUILD_FRONTEND', value: 'true' }
                    steps {
                        dir('src/frontend') {
                            sh 'npm install'
                            sh 'CI=true npm test'
                        }
                    }
                }
            }
        }

        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('sonarqube-server') {   // name configured in Jenkins > Configure System
                    sh """
                        sonar-scanner \
                          -Dsonar.projectKey=three-tier-devops-project \
                          -Dsonar.sources=src \
                          -Dsonar.branch.name=${env.BRANCH_NAME} \
                          -Dsonar.javascript.lcov.reportPaths=src/backend/coverage/lcov.info,src/frontend/coverage/lcov.info
                    """
                }
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Build & Push Backend Image') {
            when { environment name: 'BUILD_BACKEND', value: 'true' }
            steps {
                dir('src/backend') {
                    sh """
                        echo "${DOCKERHUB_CREDENTIALS_PSW}" | docker login -u "${DOCKERHUB_CREDENTIALS_USR}" --password-stdin
                        docker build -t ${DOCKERHUB_USER}/three-tier-backend:${IMAGE_TAG} -t ${DOCKERHUB_USER}/three-tier-backend:${BRANCH_NAME}-latest .
                    """
                }
            }
        }

        stage('Build & Push Frontend Image') {
            when { environment name: 'BUILD_FRONTEND', value: 'true' }
            steps {
                dir('src/frontend') {
                    sh """
                        docker build --build-arg REACT_APP_API_URL=${env.BACKEND_PUBLIC_URL ?: 'http://backend-service:5000'} \
                          -t ${DOCKERHUB_USER}/three-tier-frontend:${IMAGE_TAG} \
                          -t ${DOCKERHUB_USER}/three-tier-frontend:${BRANCH_NAME}-latest .
                    """
                }
            }
        }

        stage('Trivy Security Scan') {
            steps {
                sh """
                    trivy image --exit-code 0 --severity HIGH,CRITICAL ${DOCKERHUB_USER}/three-tier-backend:${IMAGE_TAG} || true
                    trivy image --exit-code 0 --severity HIGH,CRITICAL ${DOCKERHUB_USER}/three-tier-frontend:${IMAGE_TAG} || true
                """
            }
        }

        stage('Push Images to DockerHub') {
            steps {
                script {
                    if (env.BUILD_BACKEND == 'true') {
                        sh "docker push ${DOCKERHUB_USER}/three-tier-backend:${IMAGE_TAG}"
                        sh "docker push ${DOCKERHUB_USER}/three-tier-backend:${BRANCH_NAME}-latest"
                    }
                    if (env.BUILD_FRONTEND == 'true') {
                        sh "docker push ${DOCKERHUB_USER}/three-tier-frontend:${IMAGE_TAG}"
                        sh "docker push ${DOCKERHUB_USER}/three-tier-frontend:${BRANCH_NAME}-latest"
                    }
                }
            }
        }

        stage('Approval for Production') {
            when { branch 'main' }
            steps {
                timeout(time: 15, unit: 'MINUTES') {
                    input message: "Deploy to PRODUCTION namespace 'three-tier'?", ok: 'Deploy'
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                withCredentials([file(credentialsId: 'kubeconfig-file', variable: 'KUBECONFIG')]) {
                    sh """
                        kubectl create namespace ${K8S_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
                        kubectl apply -n ${K8S_NAMESPACE} -f k8s/configmap.yml
                        kubectl apply -n ${K8S_NAMESPACE} -f k8s/secret.yml
                        kubectl apply -n ${K8S_NAMESPACE} -f k8s/mysql-pv.yml
                        kubectl apply -n ${K8S_NAMESPACE} -f k8s/mysql-pvc.yml
                        kubectl apply -n ${K8S_NAMESPACE} -f k8s/mysql-deployment.yml
                        kubectl apply -n ${K8S_NAMESPACE} -f k8s/mysql-service.yml
                        kubectl apply -n ${K8S_NAMESPACE} -f k8s/backend-configmap.yml
                        kubectl apply -n ${K8S_NAMESPACE} -f k8s/backend-service.yml
                        kubectl apply -n ${K8S_NAMESPACE} -f k8s/frontend-configmap.yml
                        kubectl apply -n ${K8S_NAMESPACE} -f k8s/frontend-service.yml
                        kubectl apply -n ${K8S_NAMESPACE} -f k8s/ingress.yml

                        if [ "${BUILD_BACKEND}" = "true" ]; then
                          kubectl set image deployment/backend-deployment backend=${DOCKERHUB_USER}/three-tier-backend:${IMAGE_TAG} -n ${K8S_NAMESPACE} --record || kubectl apply -n ${K8S_NAMESPACE} -f k8s/backend-deployment.yml
                          kubectl rollout status deployment/backend-deployment -n ${K8S_NAMESPACE} --timeout=120s
                        fi

                        if [ "${BUILD_FRONTEND}" = "true" ]; then
                          kubectl set image deployment/frontend-deployment frontend=${DOCKERHUB_USER}/three-tier-frontend:${IMAGE_TAG} -n ${K8S_NAMESPACE} --record || kubectl apply -n ${K8S_NAMESPACE} -f k8s/frontend-deployment.yml
                          kubectl rollout status deployment/frontend-deployment -n ${K8S_NAMESPACE} --timeout=120s
                        fi
                    """
                }
            }
        }
    }

    post {
        success {
            echo "✅ Pipeline succeeded for branch ${env.BRANCH_NAME} -> namespace ${env.K8S_NAMESPACE}"
        }
        failure {
            echo "❌ Pipeline failed for branch ${env.BRANCH_NAME}. Check logs above."
        }
        always {
            sh 'docker logout || true'
        }
    }
}
