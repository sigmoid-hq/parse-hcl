terraform {
  required_version = ">= 1.4.0"
}

provider "aws" {
  region = var.region
}

locals {
  name_prefix = "${var.project}-${var.env}"
}

module "network" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "${local.name_prefix}-network"
  cidr = var.vpc_cidr
}

resource "aws_s3_bucket" "artifact" {
  bucket = "${local.name_prefix}-artifact"

  tags = {
    Project = var.project
    Env     = var.env
  }
}
