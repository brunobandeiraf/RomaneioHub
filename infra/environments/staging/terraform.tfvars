# Staging Environment - Example values
# Copy to terraform.tfvars.local and fill in real values

aws_region     = "us-east-1"
aws_account_id = "123456789012"
environment    = "staging"
project        = "compras-hub"

# Database
database_password = "CHANGE_ME_staging_password_2024"

# Stripe (use test mode keys for staging)
stripe_secret_key      = "sk_test_..."
stripe_publishable_key = "pk_test_..."
stripe_webhook_secret  = "whsec_..."

# Application
jwt_secret = "staging-jwt-secret-change-me"

# Amplify
repository_url = "https://github.com/your-org/compras-hub"
domain_name    = ""

# Frontend
frontend_url = "https://staging.comprashub.com"
