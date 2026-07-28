terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Optional: uncomment to store state remotely in S3 (recommended for real projects)
  # backend "s3" {
  #   bucket = "your-terraform-state-bucket"
  #   key    = "three-tier-devops/terraform.tfstate"
  #   region = "ap-south-1"
  # }
}

provider "aws" {
  region = var.aws_region
}
