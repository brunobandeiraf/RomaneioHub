import { GlobalRole, TenantRole } from '@romaneio-hub/shared';

export interface RequestUser {
  userId: string;
  tenantId: string;
  globalRole: GlobalRole;
  tenantRole: TenantRole;
  email: string;
}
