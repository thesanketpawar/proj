```groovy
// ============================================================
// Three-Tier DevOps Project - Multibranch CI/CD Pipeline
//
// Branch strategy:
// dev  -> three-tier-dev namespace
// test -> three-tier-test namespace
// main -> three-tier namespace
//
// Flow:
//
// GitHub
//   |
// Jenkins
//   |
// Unit Test
//   |
// SonarQube
//   |
// Docker Build
//   |
// Trivy Scan
//   |
// DockerHub Push
//   |
// Kubernetes Deploy
//
// ============================================================


pipeline {

    agent any


    environment {

        DOCKERHUB_CREDENTIALS = credentials('docker-cred')

        SONAR_TOKEN = credentials('sonarqube-token')

        DOCKERHUB_USER = "thesanketpawar"

        IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'local'}"

    }



    stages {



        stage('Checkout') {

            steps {

                checkout scm


                script {

                    env.K8S_NAMESPACE =
                    (env.BRANCH_NAME == 'main') ?
                    'three-tier' :
                    (env.BRANCH_NAME == 'test') ?
                    'three-tier-test' :
                    'three-tier-dev'


                    echo """
                    Branch    : ${env.BRANCH_NAME}
                    Namespace : ${env.K8S_NAMESPACE}
                    """

                }

            }

        }



        stage('Detect Changed Components') {

            steps {

                script {


                    def changedFiles = sh(
                        script: '''
                        git diff --name-only HEAD~1 HEAD || true
                        ''',
                        returnStdout:true
                    ).trim()



                    echo "Changed Files:\n${changedFiles}"


                    env.BUILD_FRONTEND="false"
                    env.BUILD_BACKEND="false"



                    if(changedFiles.contains("src/frontend")) {

                        env.BUILD_FRONTEND="true"

                    }



                    if(changedFiles.contains("src/backend")) {

                        env.BUILD_BACKEND="true"

                    }



                    if(changedFiles == "") {

                        env.BUILD_FRONTEND="true"
                        env.BUILD_BACKEND="true"

                    }



                    echo """
                    Frontend Build : ${env.BUILD_FRONTEND}
                    Backend Build  : ${env.BUILD_BACKEND}
                    """

                }

            }

        }




        stage('Unit Tests') {

            parallel {


                stage('Backend Test') {

                    when {

                        environment name:'BUILD_BACKEND',
                        value:'true'

                    }


                    steps {

                        dir('src/backend') {

                            sh '''
                            npm install
                            npm test
                            '''

                        }

                    }

                }




                stage('Frontend Test') {


                    when {

                        environment name:'BUILD_FRONTEND',
                        value:'true'

                    }


                    steps {

                        dir('src/frontend') {

                            sh '''
                            npm install
                            CI=true npm test
                            '''

                        }

                    }

                }

            }

        }





        stage('SonarQube Analysis') {


            steps {


                withSonarQubeEnv('sonarqube-server') {


                    sh '''

                    sonar-scanner \
                    -Dsonar.projectKey=three-tier-devops-project \
                    -Dsonar.sources=src/backend,src/frontend,terraform,k8s \
                    -Dsonar.exclusions=**/node_modules/**,**/coverage/**,**/build/**,**/*.png


                    '''

                }

            }

        }







        stage('Build Backend Image') {


            when {

                environment name:'BUILD_BACKEND',
                value:'true'

            }



            steps {


                dir('src/backend') {


                    sh '''

                    docker build \
                    -t $DOCKERHUB_USER/three-tier-backend:$IMAGE_TAG \
                    -t $DOCKERHUB_USER/three-tier-backend:$BRANCH_NAME-latest .


                    '''

                }

            }

        }







        stage('Build Frontend Image') {


            when {

                environment name:'BUILD_FRONTEND',
                value:'true'

            }



            steps {


                dir('src/frontend') {


                    sh '''

                    docker build \
                    --build-arg REACT_APP_API_URL=http://backend-service:5000 \
                    -t $DOCKERHUB_USER/three-tier-frontend:$IMAGE_TAG \
                    -t $DOCKERHUB_USER/three-tier-frontend:$BRANCH_NAME-latest .


                    '''

                }

            }

        }








        stage('Trivy Scan') {


            when {


                anyOf {

                    environment name:'BUILD_BACKEND', value:'true'

                    environment name:'BUILD_FRONTEND', value:'true'

                }

            }



            steps {


                sh '''

                if [ "$BUILD_BACKEND" = "true" ]
                then

                trivy image \
                --exit-code 0 \
                $DOCKERHUB_USER/three-tier-backend:$IMAGE_TAG

                fi



                if [ "$BUILD_FRONTEND" = "true" ]
                then

                trivy image \
                --exit-code 0 \
                $DOCKERHUB_USER/three-tier-frontend:$IMAGE_TAG

                fi


                '''

            }

        }







        stage('Push Docker Images') {


            when {


                anyOf {

                    environment name:'BUILD_BACKEND', value:'true'

                    environment name:'BUILD_FRONTEND', value:'true'

                }

            }


            steps {


                sh '''

                echo "$DOCKERHUB_CREDENTIALS_PSW" | docker login \
                -u "$DOCKERHUB_CREDENTIALS_USR" \
                --password-stdin



                if [ "$BUILD_BACKEND" = "true" ]
                then

                docker push \
                $DOCKERHUB_USER/three-tier-backend:$IMAGE_TAG

                docker push \
                $DOCKERHUB_USER/three-tier-backend:$BRANCH_NAME-latest

                fi



                if [ "$BUILD_FRONTEND" = "true" ]
                then

                docker push \
                $DOCKERHUB_USER/three-tier-frontend:$IMAGE_TAG

                docker push \
                $DOCKERHUB_USER/three-tier-frontend:$BRANCH_NAME-latest

                fi


                '''

            }

        }








        stage('Production Approval') {


            when {

                branch 'main'

            }


            steps {


                timeout(time:15, unit:'MINUTES') {


                    input(
                    message:"Deploy to Production?",
                    ok:"Deploy"
                    )

                }

            }

        }









        stage('Deploy Kubernetes') {


            when {


                anyOf {

                    environment name:'BUILD_BACKEND', value:'true'

                    environment name:'BUILD_FRONTEND', value:'true'

                }

            }



            steps {


                withCredentials([

                    file(
                    credentialsId:'kubeconfig-file',
                    variable:'KUBECONFIG'
                    )

                ]) {



                    sh '''

                    kubectl create namespace $K8S_NAMESPACE \
                    --dry-run=client -o yaml | kubectl apply -f -



                    kubectl apply \
                    -n $K8S_NAMESPACE \
                    -f k8s/



                    if [ "$BUILD_BACKEND" = "true" ]
                    then


                    kubectl set image \
                    deployment/backend-deployment \
                    backend=$DOCKERHUB_USER/three-tier-backend:$IMAGE_TAG \
                    -n $K8S_NAMESPACE


                    kubectl rollout status \
                    deployment/backend-deployment \
                    -n $K8S_NAMESPACE


                    fi




                    if [ "$BUILD_FRONTEND" = "true" ]
                    then


                    kubectl set image \
                    deployment/frontend-deployment \
                    frontend=$DOCKERHUB_USER/three-tier-frontend:$IMAGE_TAG \
                    -n $K8S_NAMESPACE



                    kubectl rollout status \
                    deployment/frontend-deployment \
                    -n $K8S_NAMESPACE


                    fi


                    '''

                }

            }

        }


    }




    post {


        success {


            echo """

            ✅ Pipeline Successful

            Branch:
            ${env.BRANCH_NAME}

            Namespace:
            ${env.K8S_NAMESPACE}

            """

        }



        failure {


            echo """

            ❌ Pipeline Failed

            Check Jenkins Logs

            """

        }




        always {


            sh '''

            docker logout || true

            rm -rf workspace@tmp || true

            '''

        }


    }


}
```
