output "user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "user_pool_endpoint" {
  description = "Cognito User Pool endpoint"
  value       = aws_cognito_user_pool.main.endpoint
}

output "web_client_id" {
  description = "Web application client ID"
  value       = aws_cognito_user_pool_client.web.id
}

output "api_client_id" {
  description = "API client ID"
  value       = aws_cognito_user_pool_client.api.id
}

output "api_client_secret" {
  description = "API client secret"
  value       = aws_cognito_user_pool_client.api.client_secret
  sensitive   = true
}
