import { GlobalRole, TenantRole } from '@romaneio-hub/shared';

export interface RequestUser {
  authId: string;
  tenantId: string;
  globalRole: GlobalRole;
  tenantRole: TenantRole;
  email: string;
}
