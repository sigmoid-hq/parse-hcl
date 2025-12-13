terraform {
  required_version = ">= 1.0.0"
}

provider "aws" {
  region = "us-east-1"
}

variable "region" {
  type        = string
  default     = "us-east-1"
  description = "Region"
}

locals {
  name_prefix = "demo"
}

resource "aws_s3_bucket" "demo" {
  bucket = "${local.name_prefix}-bucket"
  count  = 2
}

output "bucket_name" {
  value     = aws_s3_bucket.demo[0].bucket
  sensitive = false
}
