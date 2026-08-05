import { describe, it, expect } from 'vitest';
import {
  MAX_INVOICE_FILE_SIZE,
  ALLOWED_INVOICE_CONTENT_TYPES,
  MAX_INVOICES_PER_ORDER,
  MAX_ORDER_ITEMS,
  MIN_ORDER_ITEMS,
  VALID_ORDER_TRANSITIONS,
  VALID_SUBSCRIPTION_TRANSITIONS,
} from './index';
import { OrderStatus, SubscriptionStatus } from '../types';

describe('constants', () => {
  it('MAX_INVOICE_FILE_SIZE should be 10MB', () => {
    expect(MAX_INVOICE_FILE_SIZE).toBe(10 * 1024 * 1024);
  });

  it('ALLOWED_INVOICE_CONTENT_TYPES should include PDF, PNG, and JPEG', () => {
    expect(ALLOWED_INVOICE_CONTENT_TYPES).toContain('application/pdf');
    expect(ALLOWED_INVOICE_CONTENT_TYPES).toContain('image/png');
    expect(ALLOWED_INVOICE_CONTENT_TYPES).toContain('image/jpeg');
  });

  it('MAX_INVOICES_PER_ORDER should be 10', () => {
    expect(MAX_INVOICES_PER_ORDER).toBe(10);
  });

  it('MAX_ORDER_ITEMS should be 50', () => {
    expect(MAX_ORDER_ITEMS).toBe(50);
  });

  it('MIN_ORDER_ITEMS should be 1', () => {
    expect(MIN_ORDER_ITEMS).toBe(1);
  });
});

describe('VALID_ORDER_TRANSITIONS', () => {
  it('DRAFT can transition to CONFIRMED and CANCELLED', () => {
    expect(VALID_ORDER_TRANSITIONS[OrderStatus.DRAFT]).toContain(OrderStatus.CONFIRMED);
    expect(VALID_ORDER_TRANSITIONS[OrderStatus.DRAFT]).toContain(OrderStatus.CANCELLED);
    expect(VALID_ORDER_TRANSITIONS[OrderStatus.DRAFT]).toHaveLength(2);
  });

  it('CONFIRMED can transition to DELIVERED and CANCELLED', () => {
    expect(VALID_ORDER_TRANSITIONS[OrderStatus.CONFIRMED]).toContain(OrderStatus.DELIVERED);
    expect(VALID_ORDER_TRANSITIONS[OrderStatus.CONFIRMED]).toContain(OrderStatus.CANCELLED);
    expect(VALID_ORDER_TRANSITIONS[OrderStatus.CONFIRMED]).toHaveLength(2);
  });

  it('DELIVERED is a terminal state', () => {
    expect(VALID_ORDER_TRANSITIONS[OrderStatus.DELIVERED]).toHaveLength(0);
  });

  it('CANCELLED is a terminal state', () => {
    expect(VALID_ORDER_TRANSITIONS[OrderStatus.CANCELLED]).toHaveLength(0);
  });
});

describe('VALID_SUBSCRIPTION_TRANSITIONS', () => {
  it('TRIAL can transition to ACTIVE and CANCELLED', () => {
    expect(VALID_SUBSCRIPTION_TRANSITIONS[SubscriptionStatus.TRIAL]).toContain(SubscriptionStatus.ACTIVE);
    expect(VALID_SUBSCRIPTION_TRANSITIONS[SubscriptionStatus.TRIAL]).toContain(SubscriptionStatus.CANCELLED);
  });

  it('ACTIVE can transition to PAST_DUE and CANCELLED', () => {
    expect(VALID_SUBSCRIPTION_TRANSITIONS[SubscriptionStatus.ACTIVE]).toContain(SubscriptionStatus.PAST_DUE);
    expect(VALID_SUBSCRIPTION_TRANSITIONS[SubscriptionStatus.ACTIVE]).toContain(SubscriptionStatus.CANCELLED);
  });

  it('PAST_DUE can transition to GRACE_PERIOD and CANCELLED', () => {
    expect(VALID_SUBSCRIPTION_TRANSITIONS[SubscriptionStatus.PAST_DUE]).toContain(SubscriptionStatus.GRACE_PERIOD);
    expect(VALID_SUBSCRIPTION_TRANSITIONS[SubscriptionStatus.PAST_DUE]).toContain(SubscriptionStatus.CANCELLED);
  });

  it('GRACE_PERIOD can transition to BLOCKED, ACTIVE (renewal), and CANCELLED', () => {
    expect(VALID_SUBSCRIPTION_TRANSITIONS[SubscriptionStatus.GRACE_PERIOD]).toContain(SubscriptionStatus.BLOCKED);
    expect(VALID_SUBSCRIPTION_TRANSITIONS[SubscriptionStatus.GRACE_PERIOD]).toContain(SubscriptionStatus.ACTIVE);
    expect(VALID_SUBSCRIPTION_TRANSITIONS[SubscriptionStatus.GRACE_PERIOD]).toContain(SubscriptionStatus.CANCELLED);
  });

  it('BLOCKED can transition to CANCELLED', () => {
    expect(VALID_SUBSCRIPTION_TRANSITIONS[SubscriptionStatus.BLOCKED]).toContain(SubscriptionStatus.CANCELLED);
    expect(VALID_SUBSCRIPTION_TRANSITIONS[SubscriptionStatus.BLOCKED]).toHaveLength(1);
  });

  it('CANCELLED is a terminal state', () => {
    expect(VALID_SUBSCRIPTION_TRANSITIONS[SubscriptionStatus.CANCELLED]).toHaveLength(0);
  });
});
