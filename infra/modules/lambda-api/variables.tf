variable "project" {
  description = "Project name"
  type        = string
  default     = "compras-hub"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for Lambda VPC config"
  type        = list(string)
}

variable "lambda_memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 512
}

variable "lambda_zip_path" {
  description = "Path to the Lambda deployment package zip"
  type        = string
  default     = "placeholder.zip"
}

variable "lambda_source_hash" {
  description = "Base64-encoded SHA256 hash of the deployment package"
  type        = string
  default     = ""
}

variable "lambda_environment_variables" {
  description = "Environment variables for the Lambda function"
  type        = map(string)
  default     = {}
}

variable "s3_bucket_arn" {
  description = "ARN of the invoices S3 bucket"
  type        = string
}

variable "secrets_arns" {
  description = "ARNs of Secrets Manager secrets the Lambda needs access to"
  type        = list(string)
  default     = []
}

variable "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN for IAM permissions"
  type        = string
}

variable "api_throttle_burst_limit" {
  description = "API Gateway throttle burst limit (requests)"
  type        = number
  default     = 100
}

variable "api_throttle_rate_limit" {
  description = "API Gateway throttle rate limit (requests per second)"
  type        = number
  default     = 50
}

variable "waf_rate_limit" {
  description = "WAF rate limit per IP (requests per 5 minutes)"
  type        = number
  default     = 2000
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
