# Secrets Manager Module - Application secrets with managed keys

# Database credentials secret
resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${var.project}/${var.environment}/db-credentials"
  description = "RDS database credentials for ${var.project} ${var.environment}"

  recovery_window_in_days = var.environment == "prod" ? 30 : 7

  tags = merge(var.tags, {
    Name = "${var.project}-${var.environment}-db-credentials"
  })
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id

  secret_string = jsonencode({
    username = var.database_username
    password = var.database_password
    host     = var.database_host
    port     = 5432
    dbname   = var.database_name
  })
}

# Stripe API keys secret
resource "aws_secretsmanager_secret" "stripe" {
  name        = "${var.project}/${var.environment}/stripe-keys"
  description = "Stripe API keys for ${var.project} ${var.environment}"

  recovery_window_in_days = var.environment == "prod" ? 30 : 7

  tags = merge(var.tags, {
    Name = "${var.project}-${var.environment}-stripe-keys"
  })
}

resource "aws_secretsmanager_secret_version" "stripe" {
  secret_id = aws_secretsmanager_secret.stripe.id

  secret_string = jsonencode({
    secret_key      = var.stripe_secret_key
    publishable_key = var.stripe_publishable_key
    webhook_secret  = var.stripe_webhook_secret
  })
}

# Application secrets (JWT secret, etc.)
resource "aws_secretsmanager_secret" "app" {
  name        = "${var.project}/${var.environment}/app-secrets"
  description = "Application secrets for ${var.project} ${var.environment}"

  recovery_window_in_days = var.environment == "prod" ? 30 : 7

  tags = merge(var.tags, {
    Name = "${var.project}-${var.environment}-app-secrets"
  })
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id

  secret_string = jsonencode({
    jwt_secret         = var.jwt_secret
    cognito_client_secret = var.cognito_client_secret
  })
}
