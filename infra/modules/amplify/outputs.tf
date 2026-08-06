output "app_id" {
  description = "Amplify App ID"
  value       = aws_amplify_app.frontend.id
}

output "app_arn" {
  description = "Amplify App ARN"
  value       = aws_amplify_app.frontend.arn
}

output "default_domain" {
  description = "Amplify default domain"
  value       = aws_amplify_app.frontend.default_domain
}

output "branch_name" {
  description = "Deployed branch name"
  value       = aws_amplify_branch.main.branch_name
}
