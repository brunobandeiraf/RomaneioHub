# Staging Environment - Infrastructure Composition

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      project     = var.project
      env         = var.environment
      managed_by  = "terraform"
    }
  }
}

locals {
  tags = {
    project    = var.project
    env        = var.environment
    managed_by = "terraform"
  }
}

# --- VPC ---
module "vpc" {
  source = "../../modules/vpc"

  project     = var.project
  environment = var.environment
  region      = var.aws_region
  tags        = local.tags
}

# --- Secrets Manager ---
module "secrets" {
  source = "../../modules/secrets"

  project           = var.project
  environment       = var.environment
  database_username = "comprashub_admin"
  database_password = var.database_password
  database_host     = module.rds.rds_proxy_endpoint
  database_name     = "comprashub"

  stripe_secret_key      = var.stripe_secret_key
  stripe_publishable_key = var.stripe_publishable_key
  stripe_webhook_secret  = var.stripe_webhook_secret
  jwt_secret             = var.jwt_secret
  cognito_client_secret  = module.cognito.api_client_secret

  tags = local.tags
}

# --- Cognito ---
module "cognito" {
  source = "../../modules/cognito"

  project     = var.project
  environment = var.environment
  tags        = local.tags
}

# --- Lambda + API Gateway ---
module "lambda_api" {
  source = "../../modules/lambda-api"

  project            = var.project
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  lambda_memory_size = 512

  s3_bucket_arn         = module.s3.bucket_arn
  secrets_arns          = module.secrets.all_secret_arns
  cognito_user_pool_arn = module.cognito.user_pool_arn

  api_throttle_burst_limit = 100
  api_throttle_rate_limit  = 50
  waf_rate_limit           = 2000

  lambda_environment_variables = {
    DATABASE_URL               = module.rds.database_url
    S3_BUCKET                  = module.s3.bucket_id
    COGNITO_USER_POOL_ID       = module.cognito.user_pool_id
    COGNITO_CLIENT_ID          = module.cognito.api_client_id
    STRIPE_SECRET_ARN          = module.secrets.stripe_secret_arn
    APP_SECRET_ARN             = module.secrets.app_secret_arn
    FRONTEND_URL               = var.frontend_url
  }

  tags = local.tags
}

# --- RDS PostgreSQL ---
module "rds" {
  source = "../../modules/rds"

  project                  = var.project
  environment              = var.environment
  vpc_id                   = module.vpc.vpc_id
  private_subnet_ids       = module.vpc.private_subnet_ids
  lambda_security_group_id = module.lambda_api.lambda_security_group_id
  instance_class           = "db.t4g.micro"
  allocated_storage        = 20
  max_allocated_storage    = 100
  database_name            = "comprashub"
  database_username        = "comprashub_admin"
  database_password        = var.database_password
  db_credentials_secret_arn = module.secrets.db_credentials_secret_arn

  tags = local.tags
}

# --- S3 ---
module "s3" {
  source = "../../modules/s3"

  project         = var.project
  environment     = var.environment
  account_id      = var.aws_account_id
  allowed_origins = [var.frontend_url]

  tags = local.tags
}

# --- Amplify Hosting ---
module "amplify" {
  source = "../../modules/amplify"

  project               = var.project
  environment           = var.environment
  repository_url        = var.repository_url
  branch_name           = "staging"
  api_url               = module.lambda_api.api_gateway_url
  cognito_user_pool_id  = module.cognito.user_pool_id
  cognito_web_client_id = module.cognito.web_client_id
  domain_name           = var.domain_name

  tags = local.tags
}
