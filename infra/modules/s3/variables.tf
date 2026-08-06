variable "project" {
  description = "Project name"
  type        = string
  default     = "compras-hub"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "account_id" {
  description = "AWS account ID for globally unique bucket naming"
  type        = string
}

variable "allowed_origins" {
  description = "Allowed CORS origins for presigned URL uploads"
  type        = list(string)
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
