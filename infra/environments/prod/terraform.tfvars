# Production Environment - Example values
# NEVER commit real production values to git
# Use CI/CD environment variables or a secrets manager

aws_region     = "us-east-1"
aws_account_id = "123456789012"
environment    = "prod"
project        = "compras-hub"

# Database (use a strong, unique password)
database_password = "CHANGE_ME_prod_password_2024"

# Stripe (use live mode keys)
stripe_secret_key      = "sk_live_..."
stripe_publishable_key = "pk_live_..."
stripe_webhook_secret  = "whsec_..."

# Application
jwt_secret = "CHANGE_ME_prod_jwt_secret"

# Amplify
repository_url = "https://github.com/your-org/compras-hub"
domain_name    = "comprashub.com"

# Frontend
frontend_url = "https://comprashub.com"
