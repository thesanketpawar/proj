#!/bin/bash
# ============================================
# Runs automatically on first boot of the Jenkins/CI-CD EC2 instance.
# Installs: Docker, Jenkins, SonarQube (as a Docker container), kubectl, Trivy
# ============================================
set -e
exec > /var/log/user-data.log 2>&1

echo ">>> Updating packages"
apt-get update -y
apt-get install -y ca-certificates curl gnupg unzip

echo ">>> Installing Docker"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | tee /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
usermod -aG docker ubuntu
systemctl enable docker
systemctl start docker

echo ">>> Installing Java (required by Jenkins)"
apt-get install -y openjdk-17-jdk

echo ">>> Installing Jenkins"
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | gpg --dearmor -o /usr/share/keyrings/jenkins-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.gpg] https://pkg.jenkins.io/debian-stable binary/" | tee /etc/apt/sources.list.d/jenkins.list
apt-get update -y
apt-get install -y jenkins
usermod -aG docker jenkins
systemctl enable jenkins
systemctl start jenkins

echo ">>> Installing kubectl (so Jenkins can deploy to the K8s cluster)"
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

echo ">>> Installing Trivy (image vulnerability scanning in pipeline)"
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

echo ">>> Starting SonarQube as a Docker container (port 9000)"
sysctl -w vm.max_map_count=262144
echo "vm.max_map_count=262144" >> /etc/sysctl.conf
docker run -d --name sonarqube --restart unless-stopped \
  -p 9000:9000 \
  -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true \
  sonarqube:lts-community

echo ">>> Jenkins initial admin password will be at: /var/lib/jenkins/secrets/initialAdminPassword"
echo ">>> Setup complete. Jenkins on :8080, SonarQube on :9000"
