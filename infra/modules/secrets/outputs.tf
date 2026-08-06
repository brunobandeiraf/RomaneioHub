output "db_credentials_secret_arn" {
  description = "ARN of the database credentials secret"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "stripe_secret_arn" {
  description = "ARN of the Stripe keys secret"
  value       = aws_secretsmanager_secret.stripe.arn
}

output "app_secret_arn" {
  description = "ARN of the application secrets"
  value       = aws_secretsmanager_secret.app.arn
}

output "all_secret_arns" {
  description = "List of all secret ARNs (for IAM policies)"
  value = [
    aws_secretsmanager_secret.db_credentials.arn,
    aws_secretsmanager_secret.stripe.arn,
    aws_secretsmanager_secret.app.arn,
  ]
}
