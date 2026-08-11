import { GlobalRole, TenantRole } from '../../shared/index';

export interface RequestUser {
  authId: string;
  tenantId: string;
  globalRole: GlobalRole;
  tenantRole: TenantRole;
  email: string;
}
