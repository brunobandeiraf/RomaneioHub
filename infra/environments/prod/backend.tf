# Terraform Backend - S3 state storage for prod environment
terraform {
  backend "s3" {
    bucket         = "compras-hub-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "compras-hub-terraform-locks"
  }
}
