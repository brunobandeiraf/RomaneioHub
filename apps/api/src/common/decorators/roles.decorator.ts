import { SetMetadata } from '@nestjs/common';
import { TenantRole } from '@romaneio-hub/shared';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: TenantRole[]) => SetMetadata(ROLES_KEY, roles);
