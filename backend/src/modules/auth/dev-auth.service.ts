import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma';

/**
 * DevAuthService provides local authentication for development environments.
 * It validates credentials against bcrypt-hashed passwords stored in the DB
 * and issues JWT tokens locally (without Cognito).
 *
 * SECURITY: This service is ONLY active when NODE_ENV=development.
 * In production, authentication is handled entirely by AWS Cognito.
 */
@Injectable()
export class DevAuthService {
  private readonly logger = new Logger(DevAuthService.name);
  private readonly jwtSecret: string;
  private readonly isEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.isEnabled = this.configService.get('NODE_ENV') !== 'production';
    this.jwtSecret = this.configService.get('JWT_DEV_SECRET', 'dev-secret-do-not-use-in-production');

    if (this.isEnabled) {
      this.logger.warn('⚠️  Dev authentication is ENABLED. Do NOT use in production.');
    }
  }

  /**
   * Authenticate with email + password against local DB.
   * Returns JWT tokens mimicking Cognito's token structure.
   */
  async login(email: string, password: string) {
    if (!this.isEnabled) {
      throw new UnauthorizedException('Dev auth is disabled in production');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        tenants: {
          where: { status: 'ACCEPTED' },
          take: 1,
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    const tenantAssociation = user.tenants[0];
    const tenantId = tenantAssociation?.tenantId || null;
    const tenantRole = tenantAssociation?.role || null;

    // Generate JWT tokens (mimicking Supabase structure)
    const payload = {
      sub: user.id,
      userId: user.id,
      email: user.email,
      name: user.name,
      app_metadata: {
        tenantId,
        globalRole: user.globalRole,
        tenantRole,
      },
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ sub: user.id, type: 'refresh' }, this.jwtSecret, { expiresIn: '30d' });
    const idToken = jwt.sign({ ...payload, token_use: 'id' }, this.jwtSecret, { expiresIn: '1h' });

    this.logger.log(`Dev login successful for ${email} (role: ${user.globalRole})`);

    return {
      accessToken,
      refreshToken,
      idToken,
      expiresIn: 3600,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: tenantRole || user.globalRole,
      },
    };
  }
}
