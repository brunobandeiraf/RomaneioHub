# Amplify Hosting Module - Next.js frontend deployment

resource "aws_iam_role" "amplify" {
  name = "${var.project}-${var.environment}-amplify-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "amplify.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "amplify_admin" {
  role       = aws_iam_role.amplify.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess-Amplify"
}

resource "aws_amplify_app" "frontend" {
  name       = "${var.project}-${var.environment}-web"
  repository = var.repository_url

  iam_service_role_arn = aws_iam_role.amplify.arn

  platform = "WEB_COMPUTE"

  build_spec = <<-EOT
    version: 1
    applications:
      - appRoot: apps/web
        frontend:
          phases:
            preBuild:
              commands:
                - npm ci
            build:
              commands:
                - npm run build
          artifacts:
            baseDirectory: .next
            files:
              - '**/*'
          cache:
            paths:
              - node_modules/**/*
              - .next/cache/**/*
  EOT

  environment_variables = merge(var.amplify_environment_variables, {
    AMPLIFY_MONOREPO_APP_ROOT = "apps/web"
    _CUSTOM_IMAGE             = "amplify:al2023"
  })

  # Auto branch creation settings
  enable_auto_branch_creation   = false
  enable_branch_auto_build      = true
  enable_branch_auto_deletion   = var.environment != "prod"

  custom_rule {
    source = "/<*>"
    status = "404-200"
    target = "/index.html"
  }

  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>"
    status = "200"
    target = "/index.html"
  }

  tags = merge(var.tags, {
    Name = "${var.project}-${var.environment}-amplify"
  })
}

# Branch configuration
resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = var.branch_name

  framework = "Next.js - SSR"
  stage     = var.environment == "prod" ? "PRODUCTION" : "DEVELOPMENT"

  environment_variables = {
    NEXT_PUBLIC_API_URL       = var.api_url
    NEXT_PUBLIC_COGNITO_POOL  = var.cognito_user_pool_id
    NEXT_PUBLIC_COGNITO_CLIENT = var.cognito_web_client_id
  }

  tags = merge(var.tags, {
    Name = "${var.project}-${var.environment}-branch"
  })
}

# Custom domain (optional, only if domain is provided)
resource "aws_amplify_domain_association" "main" {
  count = var.domain_name != "" ? 1 : 0

  app_id      = aws_amplify_app.frontend.id
  domain_name = var.domain_name

  sub_domain {
    branch_name = aws_amplify_branch.main.branch_name
    prefix      = var.environment == "prod" ? "" : var.environment
  }
}
