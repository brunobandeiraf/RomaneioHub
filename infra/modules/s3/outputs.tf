output "bucket_id" {
  description = "S3 bucket ID"
  value       = aws_s3_bucket.invoices.id
}

output "bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.invoices.arn
}

output "bucket_domain_name" {
  description = "S3 bucket domain name"
  value       = aws_s3_bucket.invoices.bucket_domain_name
}
