module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.1"

  name = "${local.project}-${local.environment}-vpc"
  cidr = var.vpc_cidr

  azs             = slice(data.aws_availability_zones.available.names, 0, 3)
  private_subnets = [for k, v in slice(data.aws_availability_zones.available.names, 0, 3) : cidrsubnet(var.vpc_cidr, 4, k)]
  public_subnets  = [for k, v in slice(data.aws_availability_zones.available.names, 0, 3) : cidrsubnet(var.vpc_cidr, 4, k + 4)]

  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true
  enable_dns_support   = true

  public_subnet_tags = {
    "kubernetes.io/role/elb"                                              = 1
    "kubernetes.io/cluster/${local.project}-${local.environment}-cluster" = "shared"
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb"                                     = 1
    "kubernetes.io/cluster/${local.project}-${local.environment}-cluster" = "shared"
  }
}

resource "aws_lb" "k3s_nlb" {
  name               = "${local.project}-${local.environment}-nlb"
  internal           = false
  load_balancer_type = "network"
  subnets            = module.vpc.public_subnets

  tags = local.common_tags
}

# Target Group for K3s API (6443)
resource "aws_lb_target_group" "k3s_api" {
  name     = "${local.project}-${local.environment}-api-tg"
  port     = 6443
  protocol = "TCP"
  vpc_id   = module.vpc.vpc_id

  health_check {
    protocol            = "TCP"
    port                = 6443
    interval            = 10
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_listener" "k3s_api" {
  load_balancer_arn = aws_lb.k3s_nlb.arn
  port              = 6443
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.k3s_api.arn
  }
}

resource "aws_lb_target_group_attachment" "k3s_master" {
  count            = 3
  target_group_arn = aws_lb_target_group.k3s_api.arn
  target_id        = aws_instance.k3s_master[count.index].id
  port             = 6443
}

# Target Group for HTTP (80)
resource "aws_lb_target_group" "http" {
  name     = "${local.project}-${local.environment}-http-tg"
  port     = 80
  protocol = "TCP"
  vpc_id   = module.vpc.vpc_id

  health_check {
    protocol            = "TCP"
    port                = 80
    interval            = 10
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.k3s_nlb.arn
  port              = 80
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.http.arn
  }
}

resource "aws_lb_target_group_attachment" "k3s_worker_http" {
  count            = 2
  target_group_arn = aws_lb_target_group.http.arn
  target_id        = aws_instance.k3s_worker[count.index].id
  port             = 80
}

# Target Group for HTTPS (443)
resource "aws_lb_target_group" "https" {
  name     = "${local.project}-${local.environment}-https-tg"
  port     = 443
  protocol = "TCP"
  vpc_id   = module.vpc.vpc_id

  health_check {
    protocol            = "TCP"
    port                = 443
    interval            = 10
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.k3s_nlb.arn
  port              = 443
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.https.arn
  }
}

resource "aws_lb_target_group_attachment" "k3s_worker_https" {
  count            = 2
  target_group_arn = aws_lb_target_group.https.arn
  target_id        = aws_instance.k3s_worker[count.index].id
  port             = 443
}
