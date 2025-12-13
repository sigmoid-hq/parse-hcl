variable "project" {
  type        = string
  description = "Project name used in tags and prefixes"
  default     = "demo"
}

variable "env" {
  type        = string
  description = "Deployment environment"
  default     = "dev"
}

variable "region" {
  type        = string
  description = "AWS region"
  default     = "us-west-2"
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR block"
  default     = "10.0.0.0/16"
}
