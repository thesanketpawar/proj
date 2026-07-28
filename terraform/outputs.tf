output "k8s_master_public_ip" {
  value = aws_instance.k8s_master.public_ip
}

output "k8s_worker_public_ips" {
  value = aws_instance.k8s_worker[*].public_ip
}

output "jenkins_public_ip" {
  value = aws_instance.jenkins.public_ip
}

output "jenkins_url" {
  value = "http://${aws_instance.jenkins.public_ip}:8080"
}

output "sonarqube_url" {
  value = "http://${aws_instance.jenkins.public_ip}:9000"
}

output "ssh_master" {
  value = "ssh -i ${var.key_pair_name}.pem ubuntu@${aws_instance.k8s_master.public_ip}"
}
