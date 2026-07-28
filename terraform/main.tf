# ============================================
# Key Pair
# Generate locally first:  ssh-keygen -t rsa -b 4096 -f three-tier-devops-key
# Then Terraform uploads the PUBLIC key to AWS. Keep the PRIVATE key safe,
# never commit it to Git.
# ============================================
resource "aws_key_pair" "deployer" {
  key_name   = var.key_pair_name
  public_key = file("${path.module}/${var.key_pair_name}.pub")
}

# ============================================
# Latest Ubuntu 22.04 AMI (region-agnostic lookup)
# ============================================
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ============================================
# EC2 #1 - Kubernetes Control Plane (Master)
# ============================================
resource "aws_instance" "k8s_master" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type_master
  key_name               = aws_key_pair.deployer.key_name
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.k8s_sg.id]
  user_data              = file("${path.module}/../scripts/install-k8s-master.sh")

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  tags = {
    Name = "${var.project_name}-k8s-master"
    Role = "control-plane"
  }
}

# ============================================
# EC2 #2..N - Kubernetes Worker Node(s)
# ============================================
resource "aws_instance" "k8s_worker" {
  count                  = var.worker_node_count
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type_worker
  key_name               = aws_key_pair.deployer.key_name
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.k8s_sg.id]
  user_data              = file("${path.module}/../scripts/install-k8s-worker.sh")

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  tags = {
    Name = "${var.project_name}-k8s-worker-${count.index + 1}"
    Role = "worker-node"
  }
}

# ============================================
# EC2 #3 - Jenkins + SonarQube server (Docker-based)
# ============================================
resource "aws_instance" "jenkins" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type_jenkins
  key_name               = aws_key_pair.deployer.key_name
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.jenkins_sg.id]
  user_data              = file("${path.module}/../scripts/install-jenkins.sh")

  root_block_device {
    volume_size = 25
    volume_type = "gp3"
  }

  tags = {
    Name = "${var.project_name}-jenkins-sonarqube"
    Role = "ci-cd"
  }
}
