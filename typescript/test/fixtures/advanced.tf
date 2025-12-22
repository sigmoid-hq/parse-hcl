# Advanced Terraform configuration for comprehensive testing

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "my-terraform-state"
    key    = "state.tfstate"
    region = "us-east-1"
  }
}

# Variable with complex type constraint
variable "instance_config" {
  type = object({
    name          = string
    instance_type = optional(string, "t3.micro")
    tags          = map(string)
    ebs_volumes   = list(object({
      size        = number
      type        = optional(string, "gp3")
      encrypted   = optional(bool, true)
    }))
  })
  description = "Configuration for EC2 instances"
  nullable    = false

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*$", var.instance_config.name))
    error_message = "Instance name must start with a letter and contain only lowercase letters, numbers, and hyphens."
  }
}

variable "environment" {
  type        = string
  default     = "development"
  description = "Environment name"
  sensitive   = false
}

# Locals with various expression types
locals {
  # Simple literal
  app_name = "myapp"

  # Template expression
  full_name = "${local.app_name}-${var.environment}"

  # Conditional expression
  is_production = var.environment == "production" ? true : false

  # For expression
  volume_names = [for idx, vol in var.instance_config.ebs_volumes : "${local.app_name}-vol-${idx}"]

  # Object with references
  common_tags = {
    Environment = var.environment
    Application = local.app_name
    ManagedBy   = "terraform"
  }

  # Splat expression result
  ebs_sizes = var.instance_config.ebs_volumes[*].size
}

# Provider with alias
provider "aws" {
  region = "us-east-1"
}

provider "aws" {
  alias  = "west"
  region = "us-west-2"
}

# Data source
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Resource with count and references
resource "aws_instance" "web" {
  count         = local.is_production ? 3 : 1
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_config.instance_type

  tags = merge(local.common_tags, {
    Name = "${local.full_name}-${count.index}"
  })

  lifecycle {
    create_before_destroy = true
    prevent_destroy       = false
  }
}

# Resource with for_each and dynamic blocks
resource "aws_security_group" "web" {
  for_each = toset(["http", "https", "ssh"])

  name        = "${local.full_name}-${each.key}"
  description = "Allow ${each.value} traffic"

  dynamic "ingress" {
    for_each = each.key == "ssh" ? [22] : (each.key == "http" ? [80] : [443])
    iterator = port
    content {
      from_port   = port.value
      to_port     = port.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  tags = local.common_tags
}

# Resource with depends_on
resource "aws_ebs_volume" "data" {
  count             = length(var.instance_config.ebs_volumes)
  availability_zone = aws_instance.web[0].availability_zone
  size              = var.instance_config.ebs_volumes[count.index].size
  type              = var.instance_config.ebs_volumes[count.index].type
  encrypted         = var.instance_config.ebs_volumes[count.index].encrypted

  depends_on = [aws_instance.web]

  tags = merge(local.common_tags, {
    Name = local.volume_names[count.index]
  })
}

# Module call
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = local.full_name
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = local.is_production
  single_nat_gateway = !local.is_production

  tags = local.common_tags
}

# Output with splat expression
output "instance_ids" {
  description = "IDs of created instances"
  value       = aws_instance.web[*].id
}

output "security_group_ids" {
  description = "Map of security group IDs"
  value       = { for k, v in aws_security_group.web : k => v.id }
  sensitive   = false
}

output "vpc_id" {
  description = "VPC ID from module"
  value       = module.vpc.vpc_id
}

# Moved block
moved {
  from = aws_instance.old_web
  to   = aws_instance.web
}

# Import block
import {
  to = aws_instance.legacy
  id = "i-1234567890abcdef0"
}

# Check block
check "instance_health" {
  data "http" "health" {
    url = "http://${aws_instance.web[0].public_ip}/health"
  }

  assert {
    condition     = data.http.health.status_code == 200
    error_message = "Instance health check failed"
  }
}
