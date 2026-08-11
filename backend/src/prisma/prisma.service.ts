import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContext } from './tenant-context';
import { createTenantExtension } from './tenant.middleware';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private _extended: ReturnType<typeof this.withTenantExtension> | undefined;

  constructor(private readonly tenantContext: TenantContext) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Returns a Prisma client extended with tenant-scoped query filtering.
   * Use this for all queries that should respect tenant isolation.
   */
  get extended() {
    if (!this._extended) {
      this._extended = this.withTenantExtension();
    }
    return this._extended;
  }

  private withTenantExtension() {
    return this.$extends(createTenantExtension(this.tenantContext));
  }
}
