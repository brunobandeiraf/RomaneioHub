# Cognito Module - User Pool with password policy, MFA, and custom attributes

resource "aws_cognito_user_pool" "main" {
  name = "${var.project}-${var.environment}-users"

  # Username configuration
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Password policy: min 8, uppercase, lowercase, number, special char
  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  # MFA configuration - optional at pool level (enforced for Admin group)
  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Email configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # Verification message
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "ComprasHub - Verifique seu email"
    email_message        = "Seu código de verificação é: {####}"
  }

  # Custom attributes
  schema {
    name                = "tenant_id"
    attribute_data_type = "String"
    mutable             = true

    string_attribute_constraints {
      min_length = 36
      max_length = 36
    }
  }

  schema {
    name                = "tenant_role"
    attribute_data_type = "String"
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 50
    }
  }

  # User attribute update settings
  user_attribute_update_settings {
    attributes_require_verification_before_update = ["email"]
  }

  tags = merge(var.tags, {
    Name = "${var.project}-${var.environment}-cognito"
  })
}

# User Pool Client for the web application
resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project}-${var.environment}-web-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  supported_identity_providers = ["COGNITO"]

  access_token_validity  = 1   # 1 hour
  id_token_validity      = 1   # 1 hour
  refresh_token_validity = 30  # 30 days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"

  read_attributes  = ["email", "name", "custom:tenant_id", "custom:tenant_role"]
  write_attributes = ["email", "name", "custom:tenant_id", "custom:tenant_role"]
}

# User Pool Client for the API (server-side, with secret)
resource "aws_cognito_user_pool_client" "api" {
  name         = "${var.project}-${var.environment}-api-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = true

  explicit_auth_flows = [
    "ALLOW_ADMIN_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  supported_identity_providers = ["COGNITO"]

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"
}

# Admin group with enforced MFA
resource "aws_cognito_user_group" "admin" {
  name         = "Admin"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Admin group with enforced MFA"
}

# Seller group
resource "aws_cognito_user_group" "seller" {
  name         = "Seller"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Seller users"
}

# Accounting Manager group
resource "aws_cognito_user_group" "accounting_manager" {
  name         = "AccountingManager"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Accounting Manager users"
}

# Accounting Viewer group
resource "aws_cognito_user_group" "accounting_viewer" {
  name         = "AccountingViewer"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Accounting Viewer users (read-only)"
}
