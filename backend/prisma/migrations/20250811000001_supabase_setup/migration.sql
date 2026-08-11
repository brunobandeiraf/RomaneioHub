-- =============================================================================
-- Supabase Setup: Storage bucket + Auth Hook for custom JWT claims
-- =============================================================================

-- ─── 1. Create Storage bucket 'invoices' ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  false,
  10485760,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Auth Hook: inject custom claims into JWT ──────────────────────────────
-- This function is called by Supabase Auth before issuing a JWT.
-- It reads the UserTenant association and injects tenantId, globalRole,
-- and tenantRole into the app_metadata of the JWT payload.
--
-- Configuration required (Supabase Dashboard):
--   Authentication → Hooks → "Customize Access Token (JWT) Claim"
--   → Enable → Select function: public.custom_access_token_hook
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_tenant_record record;
BEGIN
  claims := event -> 'claims';

  -- Find the active UserTenant association for the authenticated user
  SELECT
    ut.tenant_id,
    u.global_role,
    ut.role AS tenant_role
  INTO user_tenant_record
  FROM "UserTenant" ut
  INNER JOIN "User" u ON u.id = ut.user_id
  WHERE u."authId" = (event->>'user_id')
    AND ut.status = 'ACCEPTED'
  ORDER BY ut.accepted_at DESC
  LIMIT 1;

  -- Inject claims into app_metadata if tenant association exists
  IF user_tenant_record IS NOT NULL THEN
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      COALESCE(claims->'app_metadata', '{}'::jsonb) || jsonb_build_object(
        'tenantId',   user_tenant_record.tenant_id,
        'globalRole', user_tenant_record.global_role,
        'tenantRole', user_tenant_record.tenant_role
      )
    );
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute permission to Supabase Auth service
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
