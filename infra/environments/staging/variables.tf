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
  default     = "staging"
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
  description = "Stripe secret key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_publishable_key" {
  description = "Stripe publishable key"
  type        = string
  default     = ""
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook signing secret"
  type        = string
  sensitive   = true
  default     = ""
}

# Application
variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
  default     = ""
}

# Amplify
variable "repository_url" {
  description = "Git repository URL for Amplify"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Custom domain name (empty to skip)"
  type        = string
  default     = ""
}

# Frontend
variable "frontend_url" {
  description = "Frontend application URL for CORS"
  type        = string
  default     = ""
}
