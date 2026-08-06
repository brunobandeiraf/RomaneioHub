# Terraform Backend - S3 state storage for staging environment
terraform {
  backend "s3" {
    bucket         = "compras-hub-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "compras-hub-terraform-locks"
  }
}
