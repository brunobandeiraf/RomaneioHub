variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "project" {
  description = "Project name"
  type        = string
  default     = "compras-hub"
}

# Database
variable "database_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

# Stripe
variable "stripe_secret_key" {
  description = "Stripe secret key (live mode)"
  type        = string
  sensitive   = true
}

variable "stripe_publishable_key" {
  description = "Stripe publishable key (live mode)"
  type        = string
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook signing secret"
  type        = string
  sensitive   = true
}

# Application
variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

# Amplify
variable "repository_url" {
  description = "Git repository URL for Amplify"
  type        = string
}

variable "domain_name" {
  description = "Custom domain name"
  type        = string
}

# Frontend
variable "frontend_url" {
  description = "Frontend application URL for CORS"
  type        = string
}
