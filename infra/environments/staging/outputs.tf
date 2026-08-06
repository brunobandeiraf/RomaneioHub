output "api_url" {
  description = "API Gateway URL"
  value       = module.lambda_api.api_gateway_url
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_web_client_id" {
  description = "Cognito Web Client ID"
  value       = module.cognito.web_client_id
}

output "s3_bucket_name" {
  description = "S3 invoices bucket name"
  value       = module.s3.bucket_id
}

output "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint"
  value       = module.rds.rds_proxy_endpoint
}

output "amplify_default_domain" {
  description = "Amplify default domain"
  value       = module.amplify.default_domain
}
