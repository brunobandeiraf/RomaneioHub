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
  description = "Private subnet IDs for RDS subnet group"
  type        = list(string)
}

variable "lambda_security_group_id" {
  description = "Security group ID of Lambda function for ingress rules"
  type        = string
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "allocated_storage" {
  description = "Initial allocated storage in GB"
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Maximum allocated storage for autoscaling in GB"
  type        = number
  default     = 100
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = "comprashub"
}

variable "database_username" {
  description = "Master database username"
  type        = string
  default     = "comprashub_admin"
  sensitive   = true
}

variable "database_password" {
  description = "Master database password"
  type        = string
  sensitive   = true
}

variable "db_credentials_secret_arn" {
  description = "ARN of the Secrets Manager secret containing DB credentials"
  type        = string
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
