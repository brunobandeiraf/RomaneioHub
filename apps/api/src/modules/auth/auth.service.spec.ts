import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import {
  CognitoService,
  CognitoEmailAlreadyExistsError,
  CognitoInvalidCodeError,
  CognitoExpiredCodeError,
  CognitoInvalidCredentialsError,
  CognitoUserNotConfirmedError,
} from './cognito.service';
import { PrismaService } from '../../prisma';
import { TenantRole } from '@compras-hub/shared';

describe('AuthService', () => {
  let service: AuthService;
  let cognitoService: jest.Mocked<CognitoService>;
  let prismaService: any;

  beforeEach(async () => {
    const mockCognitoService = {
      signUp: jest.fn(),
      confirmSignUp: jest.fn(),
      initiateAuth: jest.fn(),
      forgotPassword: jest.fn(),
      confirmForgotPassword: jest.fn(),
    };

    const mockPrismaService: Record<string, any> = {
      $transaction: jest.fn(),
      tenant: { create: jest.fn() },
      user: { create: jest.fn(), findUnique: jest.fn() },
      userTenant: { create: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };
    mockPrismaService.$transaction = jest.fn((fn: any) => fn(mockPrismaService));

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'FRONTEND_URL') return 'http://localhost:3000';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: CognitoService, useValue: mockCognitoService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    cognitoService = module.get(CognitoService);
    prismaService = module.get(PrismaService);
  });

  describe('register', () => {
    const validDto = {
      email: 'seller@example.com',
      password: 'StrongP@ss1',
      name: 'John Seller',
      companyName: 'Seller Inc.',
    };

    it('should register a new seller successfully', async () => {
      cognitoService.signUp.mockResolvedValue({
        userSub: 'cognito-sub-123',
        codeDeliveryDestination: 's***@example.com',
      });
      prismaService.tenant.create.mockResolvedValue({ id: 'tenant-1', name: 'Seller Inc.' });
      prismaService.user.create.mockResolvedValue({ id: 'user-1', email: 'seller@example.com' });
      prismaService.userTenant.create.mockResolvedValue({});

      const result = await service.register(validDto);

      expect(result.message).toContain('Registration successful');
      expect(result.userId).toBe('user-1');
      expect(result.tenantId).toBe('tenant-1');
      expect(cognitoService.signUp).toHaveBeenCalledWith(
        validDto.email,
        validDto.password,
        validDto.name,
      );
    });

    it('should throw ConflictException when email already exists', async () => {
      cognitoService.signUp.mockRejectedValue(
        new CognitoEmailAlreadyExistsError('Email exists'),
      );

      await expect(service.register(validDto)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for weak password', async () => {
      const weakDto = { ...validDto, password: 'weak' };

      await expect(service.register(weakDto)).rejects.toThrow(BadRequestException);
      expect(cognitoService.signUp).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for password without uppercase', async () => {
      const dto = { ...validDto, password: 'nouppercas3!' };

      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for password without special character', async () => {
      const dto = { ...validDto, password: 'NoSpecial1A' };

      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirm', () => {
    const confirmDto = { email: 'seller@example.com', code: '123456' };

    it('should confirm and activate the user account', async () => {
      cognitoService.confirmSignUp.mockResolvedValue(undefined);
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        tenants: [{ id: 'ut-1', status: 'PENDING' }],
      });
      prismaService.userTenant.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.confirm(confirmDto);

      expect(result.message).toContain('confirmed successfully');
      expect(cognitoService.confirmSignUp).toHaveBeenCalledWith(
        confirmDto.email,
        confirmDto.code,
      );
      expect(prismaService.userTenant.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'PENDING' },
        data: { status: 'ACCEPTED', acceptedAt: expect.any(Date) },
      });
    });

    it('should throw BadRequestException for invalid code', async () => {
      cognitoService.confirmSignUp.mockRejectedValue(
        new CognitoInvalidCodeError('Invalid code'),
      );

      await expect(service.confirm(confirmDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired code', async () => {
      cognitoService.confirmSignUp.mockRejectedValue(
        new CognitoExpiredCodeError('Expired code'),
      );

      await expect(service.confirm(confirmDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    const loginDto = { email: 'seller@example.com', password: 'StrongP@ss1' };

    it('should return tokens on successful login', async () => {
      cognitoService.initiateAuth.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        idToken: 'id-token',
        expiresIn: 3600,
      });

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.idToken).toBe('id-token');
      expect(result.expiresIn).toBe(3600);
      expect(result.tokenType).toBe('Bearer');
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      cognitoService.initiateAuth.mockRejectedValue(
        new CognitoInvalidCredentialsError('Invalid credentials'),
      );

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for unconfirmed user', async () => {
      cognitoService.initiateAuth.mockRejectedValue(
        new CognitoUserNotConfirmedError('Not confirmed'),
      );

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should return a generic message regardless of email existence', async () => {
      cognitoService.forgotPassword.mockResolvedValue(undefined);

      const result = await service.forgotPassword({ email: 'unknown@example.com' });

      expect(result.message).toContain('If an account with this email exists');
      expect(cognitoService.forgotPassword).toHaveBeenCalledWith('unknown@example.com');
    });

    it('should return same message when email exists', async () => {
      cognitoService.forgotPassword.mockResolvedValue('s***@example.com');

      const result = await service.forgotPassword({ email: 'seller@example.com' });

      expect(result.message).toContain('If an account with this email exists');
      expect(cognitoService.forgotPassword).toHaveBeenCalledWith('seller@example.com');
    });
  });

  describe('resetPassword', () => {
    const resetDto = {
      email: 'seller@example.com',
      code: '123456',
      newPassword: 'NewStr0ng!Pass',
    };

    it('should reset password successfully', async () => {
      cognitoService.confirmForgotPassword.mockResolvedValue(undefined);

      const result = await service.resetPassword(resetDto);

      expect(result.message).toContain('Password reset successfully');
      expect(cognitoService.confirmForgotPassword).toHaveBeenCalledWith(
        resetDto.email,
        resetDto.code,
        resetDto.newPassword,
      );
    });

    it('should throw BadRequestException for weak new password', async () => {
      const weakDto = { ...resetDto, newPassword: 'weak' };

      await expect(service.resetPassword(weakDto)).rejects.toThrow(BadRequestException);
      expect(cognitoService.confirmForgotPassword).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for password without uppercase', async () => {
      const dto = { ...resetDto, newPassword: 'nouppercase1!' };

      await expect(service.resetPassword(dto)).rejects.toThrow(BadRequestException);
      expect(cognitoService.confirmForgotPassword).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for password without special character', async () => {
      const dto = { ...resetDto, newPassword: 'NoSpecial1A' };

      await expect(service.resetPassword(dto)).rejects.toThrow(BadRequestException);
      expect(cognitoService.confirmForgotPassword).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException with "Verification code is invalid or expired" for invalid code', async () => {
      cognitoService.confirmForgotPassword.mockRejectedValue(
        new CognitoInvalidCodeError('Invalid code'),
      );

      await expect(service.resetPassword(resetDto)).rejects.toThrow(BadRequestException);
      await expect(service.resetPassword(resetDto)).rejects.toThrow(
        'Verification code is invalid or expired',
      );
    });

    it('should throw BadRequestException with "Verification code is invalid or expired" for expired code', async () => {
      cognitoService.confirmForgotPassword.mockRejectedValue(
        new CognitoExpiredCodeError('Expired code'),
      );

      await expect(service.resetPassword(resetDto)).rejects.toThrow(BadRequestException);
      await expect(service.resetPassword(resetDto)).rejects.toThrow(
        'Verification code is invalid or expired',
      );
    });
  });

  describe('inviteAccountant', () => {
    const sellerId = 'seller-user-1';
    const tenantId = 'tenant-1';
    const inviteDto = {
      email: 'accountant@example.com',
      role: TenantRole.ACCOUNTING_MANAGER,
    };

    it('should invite an accountant successfully when user does not exist', async () => {
      prismaService.userTenant.findFirst.mockResolvedValue({
        id: 'ut-1',
        userId: sellerId,
        tenantId,
        role: 'SELLER',
        status: 'ACCEPTED',
      });
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue({
        id: 'new-user-1',
        email: 'accountant@example.com',
        name: 'accountant',
      });
      prismaService.userTenant.findUnique.mockResolvedValue(null);
      prismaService.userTenant.create.mockResolvedValue({
        id: 'ut-new-1',
        status: 'PENDING',
      });

      const result = await service.inviteAccountant(sellerId, tenantId, inviteDto);

      expect(result.message).toBe('Invitation sent successfully.');
      expect(result.invitationLink).toContain('accept-invite?token=');
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(prismaService.userTenant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'new-user-1',
          tenantId,
          role: TenantRole.ACCOUNTING_MANAGER,
          status: 'PENDING',
          invitationToken: expect.any(String),
          invitationExpiresAt: expect.any(Date),
        }),
      });
    });

    it('should invite an accountant successfully when user already exists', async () => {
      prismaService.userTenant.findFirst.mockResolvedValue({
        id: 'ut-1',
        userId: sellerId,
        tenantId,
        role: 'SELLER',
        status: 'ACCEPTED',
      });
      prismaService.user.findUnique.mockResolvedValue({
        id: 'existing-user-1',
        email: 'accountant@example.com',
        name: 'Existing User',
      });
      prismaService.userTenant.findUnique.mockResolvedValue(null);
      prismaService.userTenant.create.mockResolvedValue({
        id: 'ut-new-1',
        status: 'PENDING',
      });

      const result = await service.inviteAccountant(sellerId, tenantId, inviteDto);

      expect(result.message).toBe('Invitation sent successfully.');
      expect(prismaService.user.create).not.toHaveBeenCalled();
      expect(prismaService.userTenant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'existing-user-1',
          tenantId,
        }),
      });
    });

    it('should update existing association when re-inviting', async () => {
      prismaService.userTenant.findFirst.mockResolvedValue({
        id: 'ut-1',
        userId: sellerId,
        tenantId,
        role: 'SELLER',
        status: 'ACCEPTED',
      });
      prismaService.user.findUnique.mockResolvedValue({
        id: 'existing-user-1',
        email: 'accountant@example.com',
      });
      prismaService.userTenant.findUnique.mockResolvedValue({
        id: 'ut-existing',
        userId: 'existing-user-1',
        tenantId,
        role: 'ACCOUNTING_VIEWER',
        status: 'REVOKED',
      });
      prismaService.userTenant.update.mockResolvedValue({
        id: 'ut-existing',
        status: 'PENDING',
      });

      const result = await service.inviteAccountant(sellerId, tenantId, inviteDto);

      expect(result.message).toBe('Invitation sent successfully.');
      expect(prismaService.userTenant.update).toHaveBeenCalledWith({
        where: { id: 'ut-existing' },
        data: expect.objectContaining({
          role: TenantRole.ACCOUNTING_MANAGER,
          status: 'PENDING',
          invitationToken: expect.any(String),
          invitationExpiresAt: expect.any(Date),
          acceptedAt: null,
        }),
      });
    });

    it('should throw ForbiddenException if inviter is not a SELLER', async () => {
      prismaService.userTenant.findFirst.mockResolvedValue(null);

      await expect(
        service.inviteAccountant(sellerId, tenantId, inviteDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for invalid role', async () => {
      const invalidDto = { email: 'test@example.com', role: TenantRole.SELLER };

      prismaService.userTenant.findFirst.mockResolvedValue({
        id: 'ut-1',
        userId: sellerId,
        tenantId,
        role: 'SELLER',
        status: 'ACCEPTED',
      });

      await expect(
        service.inviteAccountant(sellerId, tenantId, invalidDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate token with 48-hour expiry', async () => {
      prismaService.userTenant.findFirst.mockResolvedValue({
        id: 'ut-1',
        userId: sellerId,
        tenantId,
        role: 'SELLER',
        status: 'ACCEPTED',
      });
      prismaService.user.findUnique.mockResolvedValue({
        id: 'existing-user-1',
        email: 'accountant@example.com',
      });
      prismaService.userTenant.findUnique.mockResolvedValue(null);
      prismaService.userTenant.create.mockResolvedValue({ id: 'ut-new' });

      const before = Date.now();
      const result = await service.inviteAccountant(sellerId, tenantId, inviteDto);
      const after = Date.now();

      const expiresAt = result.expiresAt.getTime();
      const expectedMin = before + 48 * 60 * 60 * 1000;
      const expectedMax = after + 48 * 60 * 60 * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('acceptInvitation', () => {
    it('should accept a valid invitation', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      prismaService.userTenant.findFirst.mockResolvedValue({
        id: 'ut-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        status: 'PENDING',
        invitationToken: 'valid-token',
        invitationExpiresAt: futureDate,
      });
      prismaService.userTenant.update.mockResolvedValue({
        id: 'ut-1',
        status: 'ACCEPTED',
      });

      const result = await service.acceptInvitation({ token: 'valid-token' });

      expect(result.message).toBe('Invitation accepted successfully.');
      expect(prismaService.userTenant.update).toHaveBeenCalledWith({
        where: { id: 'ut-1' },
        data: {
          status: 'ACCEPTED',
          acceptedAt: expect.any(Date),
          invitationToken: null,
          invitationExpiresAt: null,
        },
      });
    });

    it('should throw BadRequestException for non-existent token', async () => {
      prismaService.userTenant.findFirst.mockResolvedValue(null);

      await expect(
        service.acceptInvitation({ token: 'invalid-token' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.acceptInvitation({ token: 'invalid-token' }),
      ).rejects.toThrow('Invitation link is no longer valid');
    });

    it('should throw BadRequestException for expired token', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      prismaService.userTenant.findFirst.mockResolvedValue({
        id: 'ut-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        status: 'PENDING',
        invitationToken: 'expired-token',
        invitationExpiresAt: pastDate,
      });

      await expect(
        service.acceptInvitation({ token: 'expired-token' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.acceptInvitation({ token: 'expired-token' }),
      ).rejects.toThrow('Invitation link is no longer valid');
    });

    it('should throw BadRequestException for already-used invitation', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      prismaService.userTenant.findFirst.mockResolvedValue({
        id: 'ut-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        status: 'ACCEPTED',
        invitationToken: 'used-token',
        invitationExpiresAt: futureDate,
      });

      await expect(
        service.acceptInvitation({ token: 'used-token' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.acceptInvitation({ token: 'used-token' }),
      ).rejects.toThrow('Invitation has already been used');
    });

    it('should clear the token after accepting', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      prismaService.userTenant.findFirst.mockResolvedValue({
        id: 'ut-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        status: 'PENDING',
        invitationToken: 'some-token',
        invitationExpiresAt: futureDate,
      });
      prismaService.userTenant.update.mockResolvedValue({
        id: 'ut-1',
        status: 'ACCEPTED',
      });

      await service.acceptInvitation({ token: 'some-token' });

      expect(prismaService.userTenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invitationToken: null,
            invitationExpiresAt: null,
          }),
        }),
      );
    });
  });
});
