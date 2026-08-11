# Configuration & Secrets Management

## Secrets Management

All application secrets are managed via **AWS Secrets Manager** in production environments.
In development, secrets are loaded from `.env` files (gitignored).

### Managed Secrets

| Key | Description |
|-----|-------------|
| `DATABASE_URL` | PostgreSQL connection string (RDS) |
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `COGNITO_USER_POOL_ID` | AWS Cognito User Pool identifier |
| `COGNITO_CLIENT_ID` | AWS Cognito app client identifier |

### How It Works

1. **Production**: The `SecretsModule` runs `onModuleInit` and fetches all secrets from
   AWS Secrets Manager using the secret name configured in `AWS_SECRET_NAME`
   (defaults to `romaneio-hub/production`). Secrets are injected into `process.env` before
   other modules initialize.

2. **Development**: The `SecretsModule` detects `NODE_ENV !== 'production'` and skips
   the AWS call. Secrets come from `.env` via NestJS `ConfigModule`.

### Security Rules

- **Never** log secret values. Only log key names.
- **Never** commit `.env` files. The `.gitignore` excludes `.env`, `.env.local`, and `.env.*.local`.
- **Never** include secrets in API responses or error messages.
- CI/CD pipelines retrieve secrets at deploy time from Secrets Manager.

---

## MFA Enforcement for Admin Accounts

Multi-Factor Authentication (MFA) is **enforced for all Admin accounts** at the AWS Cognito level.

### Architecture

MFA enforcement is handled entirely by Cognito — not at the application layer.
This ensures that even if the application code is compromised, MFA cannot be bypassed.

### Configuration

| Setting | Value | Scope |
|---------|-------|-------|
| `MfaConfiguration` | `MFA_ON` | Cognito User Pool (Admin group) |
| `PreferredMfa` | `SOFTWARE_TOKEN_MFA` | TOTP-based authenticator apps |
| Admin `mfaEnabled` | `true` | Database flag (seed script) |

### Implementation Details

1. **Cognito User Pool (Terraform/IaC)**:
   - The User Pool is configured with `MfaConfiguration = "OPTIONAL"` at pool level
   - The **Admin group** has an IAM policy enforcing MFA via a custom Pre-Authentication Lambda trigger
   - Alternatively, Admin users are created with MFA enforced via `AdminSetUserMFAPreference`

2. **Seed Script** (`packages/db/prisma/seed.ts`):
   - The Admin user is created with `mfaEnabled: true`
   - This flag records that the user has completed MFA setup

3. **Production Deployment (Terraform)**:
   ```hcl
   resource "aws_cognito_user_pool" "main" {
     name = "romaneio-hub-${var.environment}"

     mfa_configuration = "OPTIONAL"

     software_token_mfa_configuration {
       enabled = true
     }
   }

   # Enforce MFA for Admin users via Pre-Authentication trigger
   resource "aws_cognito_user_pool" "main" {
     lambda_config {
       pre_authentication = aws_lambda_function.enforce_admin_mfa.arn
     }
   }
   ```

4. **Pre-Authentication Lambda** (enforces MFA for Admin group):
   - Checks if the authenticating user belongs to the Admin group
   - If yes, verifies that MFA is configured; denies authentication if not
   - Non-Admin users are allowed through without MFA requirement

### Why Cognito-Level Enforcement?

- **Defense in depth**: Application code bugs cannot disable MFA
- **Standards compliance**: Cognito handles TOTP verification securely
- **Audit trail**: All MFA events are logged in CloudWatch
- **Separation of concerns**: Auth infrastructure is managed via IaC, not application code
