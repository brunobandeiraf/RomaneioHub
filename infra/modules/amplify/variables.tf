variable "project" {
  description = "Project name"
  type        = string
  default     = "compras-hub"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "repository_url" {
  description = "Git repository URL"
  type        = string
}

variable "branch_name" {
  description = "Git branch to deploy"
  type        = string
  default     = "main"
}

variable "api_url" {
  description = "Backend API URL for frontend"
  type        = string
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "cognito_web_client_id" {
  description = "Cognito Web Client ID"
  type        = string
}

variable "domain_name" {
  description = "Custom domain name (empty string to skip)"
  type        = string
  default     = ""
}

variable "amplify_environment_variables" {
  description = "Additional environment variables for Amplify build"
  type        = map(string)
  default     = {}
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
