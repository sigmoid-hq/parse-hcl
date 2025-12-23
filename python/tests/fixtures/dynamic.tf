resource "aws_security_group" "web" {
  name = "web"

  dynamic "ingress" {
    for_each = var.allowed_ports

    content {
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }
}

moved {
  from = aws_security_group.web
  to   = aws_security_group.web_new
}

import {
  to = aws_security_group.web_new
  id = "sg-123456"
}

check "ports" {
  assert {
    condition     = length(var.allowed_ports) > 0
    error_message = "no ports allowed"
  }
}
