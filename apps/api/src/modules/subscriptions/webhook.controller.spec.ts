import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { Request } from 'express';

describe('WebhookController', () => {
  let controller: WebhookController;
  let webhookService: { handleWebhookEvent: jest.Mock };

  beforeEach(async () => {
    webhookService = {
      handleWebhookEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: WebhookService, useValue: webhookService },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
  });

  it('should process valid webhook and return { received: true }', async () => {
    const rawBody = Buffer.from('valid stripe payload');
    const req = { rawBody } as unknown as Request;
    const signature = 'whsec_valid_signature';

    const result = await controller.handleWebhook(req, signature);

    expect(webhookService.handleWebhookEvent).toHaveBeenCalledWith(
      rawBody,
      signature,
    );
    expect(result).toEqual({ received: true });
  });

  it('should return 401 when stripe-signature header is missing', async () => {
    const rawBody = Buffer.from('payload');
    const req = { rawBody } as unknown as Request;

    await expect(
      controller.handleWebhook(req, undefined as any),
    ).rejects.toThrow(UnauthorizedException);

    expect(webhookService.handleWebhookEvent).not.toHaveBeenCalled();
  });

  it('should return 401 when rawBody is not available', async () => {
    const req = {} as unknown as Request;
    const signature = 'whsec_signature';

    await expect(
      controller.handleWebhook(req, signature),
    ).rejects.toThrow(UnauthorizedException);

    expect(webhookService.handleWebhookEvent).not.toHaveBeenCalled();
  });

  it('should propagate UnauthorizedException from service on invalid signature', async () => {
    const rawBody = Buffer.from('tampered payload');
    const req = { rawBody } as unknown as Request;
    const signature = 'whsec_invalid';

    webhookService.handleWebhookEvent.mockRejectedValue(
      new UnauthorizedException('Invalid webhook signature'),
    );

    await expect(
      controller.handleWebhook(req, signature),
    ).rejects.toThrow(UnauthorizedException);
  });
});
