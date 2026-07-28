variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-south-1" # Mumbai
}

variable "project_name" {
  description = "Prefix used for naming all resources"
  type        = string
  default     = "three-tier-devops"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  type    = string
  default = "10.0.1.0/24"
}

variable "availability_zone" {
  type    = string
  default = "ap-south-1a"
}

variable "key_pair_name" {
  description = "Name of an existing EC2 key pair, or the one this Terraform will create"
  type        = string
  default     = "three-tier-devops-key"
}

variable "my_ip" {
  description = "Your local/public IP in CIDR form, e.g. 49.36.xx.xx/32 - used to restrict SSH access"
  type        = string
}

variable "instance_type_master" {
  type    = string
  default = "t2.medium" # K8s control plane needs >= 2 vCPU / 2GB RAM
}

variable "instance_type_worker" {
  type    = string
  default = "t2.medium"
}

variable "instance_type_jenkins" {
  type    = string
  default = "t2.medium" # Jenkins + SonarQube together need more RAM
}

variable "worker_node_count" {
  type    = number
  default = 1
}
