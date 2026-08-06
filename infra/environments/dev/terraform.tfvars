# Dev Environment - Example values
# Copy to terraform.tfvars.local and fill in real values

aws_region     = "us-east-1"
aws_account_id = "123456789012"
environment    = "dev"
project        = "compras-hub"

# Database (use a strong password in real deployments)
database_password = "CHANGE_ME_dev_password_2024"

# Stripe (use test mode keys for dev)
stripe_secret_key      = "sk_test_..."
stripe_publishable_key = "pk_test_..."
stripe_webhook_secret  = "whsec_..."

# Application
jwt_secret = "dev-jwt-secret-change-me"

# Amplify
repository_url = "https://github.com/your-org/compras-hub"
domain_name    = ""

# Frontend
frontend_url = "http://localhost:3000"
