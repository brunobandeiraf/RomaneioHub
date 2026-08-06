# ComprasHub Infrastructure

Terraform modules and environment configurations for the ComprasHub platform.

## Structure

```
infra/
├── modules/                    # Reusable Terraform modules
│   ├── vpc/                    # VPC with public/private subnets
│   ├── rds/                    # PostgreSQL RDS + RDS Proxy
│   ├── s3/                     # Invoice storage with lifecycle rules
│   ├── cognito/                # User Pool with MFA and password policy
│   ├── lambda-api/             # Lambda + API Gateway + WAF
│   ├── amplify/                # Next.js frontend hosting
│   └── secrets/                # Secrets Manager
├── environments/               # Environment-specific compositions
│   ├── dev/                    # Development environment
│   ├── staging/                # Staging environment
│   └── prod/                   # Production environment
└── README.md
```

## Prerequisites

- Terraform >= 1.5.0
- AWS CLI configured with appropriate credentials
- S3 bucket for state: `compras-hub-terraform-state`
- DynamoDB table for locks: `compras-hub-terraform-locks`

## Bootstrap State Backend

Before deploying any environment, create the state backend:

```bash
aws s3 mb s3://compras-hub-terraform-state --region us-east-1
aws s3api put-bucket-versioning \
  --bucket compras-hub-terraform-state \
  --versioning-configuration Status=Enabled

aws dynamodb create-table \
  --table-name compras-hub-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

## Deploying an Environment

```bash
cd infra/environments/dev

# Copy and fill in real values
cp terraform.tfvars terraform.tfvars.local

# Initialize
terraform init

# Plan
terraform plan -var-file=terraform.tfvars.local

# Apply
terraform apply -var-file=terraform.tfvars.local
```

## Module Details

### VPC
- Public subnets (2 AZs) with Internet Gateway
- Private subnets (2 AZs) for RDS and Lambda
- VPC Endpoints for S3 and Secrets Manager (no NAT Gateway to save cost)

### RDS
- PostgreSQL 16 on db.t4g.micro (single-AZ)
- RDS Proxy for connection pooling (Lambda-friendly)
- Encrypted storage with gp3
- Automated backups (7 days prod, 1 day dev)

### S3
- Private bucket with SSE-KMS encryption
- Lifecycle: transition to Glacier Instant Retrieval after 90 days
- CORS configured for presigned URL uploads
- SSL-only bucket policy

### Cognito
- Password policy: min 8 chars, uppercase, lowercase, number, special
- MFA optional (enforced for Admin group)
- Custom attributes: tenant_id, tenant_role
- Token validity: access 1h, refresh 30d

### Lambda + API Gateway
- NestJS bundled with @codegenie/serverless-express
- API Gateway REST API with proxy integration
- Rate limiting: 100 req/s burst, 50 req/s steady
- WAF with AWS managed rules (Common, Bad Inputs, SQLi) + rate limiting

### Amplify
- Next.js SSR hosting with monorepo support
- Auto-build on branch push
- Environment-specific branch mapping (develop/staging/main)

### Secrets Manager
- Database credentials
- Stripe API keys
- Application secrets (JWT, Cognito client secret)
- Recovery window: 30 days (prod), 7 days (dev/staging)

## Tags

All resources are tagged with:
- `project`: compras-hub
- `env`: dev / staging / prod
- `managed_by`: terraform
