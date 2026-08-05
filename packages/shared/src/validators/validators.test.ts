import { describe, it, expect } from 'vitest';
import { validateCnpj, validatePasswordStrength, formatCnpj } from './index';

describe('validateCnpj', () => {
  it('should accept a valid CNPJ with formatting', () => {
    // Known valid CNPJs (check digits verified)
    expect(validateCnpj('11.222.333/0001-81')).toBe(true);
    expect(validateCnpj('11.444.777/0001-61')).toBe(true);
  });

  it('should accept a valid CNPJ without formatting', () => {
    expect(validateCnpj('11222333000181')).toBe(true);
    expect(validateCnpj('11444777000161')).toBe(true);
  });

  it('should reject a CNPJ with wrong check digits', () => {
    expect(validateCnpj('11.222.333/0001-82')).toBe(false);
    expect(validateCnpj('11.222.333/0001-00')).toBe(false);
  });

  it('should reject a CNPJ with all repeated digits', () => {
    expect(validateCnpj('11.111.111/1111-11')).toBe(false);
    expect(validateCnpj('00.000.000/0000-00')).toBe(false);
    expect(validateCnpj('99.999.999/9999-99')).toBe(false);
  });

  it('should reject a CNPJ with wrong length', () => {
    expect(validateCnpj('123')).toBe(false);
    expect(validateCnpj('1234567890123')).toBe(false);
    expect(validateCnpj('123456789012345')).toBe(false);
    expect(validateCnpj('')).toBe(false);
  });

  it('should reject a CNPJ with non-numeric characters after cleaning', () => {
    expect(validateCnpj('AB.CDE.FGH/IJKL-MN')).toBe(false);
  });
});

describe('validatePasswordStrength', () => {
  it('should accept a valid password meeting all criteria', () => {
    const result = validatePasswordStrength('Abc12345!');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept password at minimum length (8 chars)', () => {
    const result = validatePasswordStrength('Aa1!xxxx');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept password at maximum length (128 chars)', () => {
    const password = 'Aa1!' + 'x'.repeat(124);
    const result = validatePasswordStrength(password);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject password shorter than 8 characters', () => {
    const result = validatePasswordStrength('Aa1!xxx');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters long');
  });

  it('should reject password longer than 128 characters', () => {
    const password = 'Aa1!' + 'x'.repeat(125);
    const result = validatePasswordStrength(password);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at most 128 characters long');
  });

  it('should reject password without uppercase letter', () => {
    const result = validatePasswordStrength('abc12345!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
  });

  it('should reject password without lowercase letter', () => {
    const result = validatePasswordStrength('ABC12345!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one lowercase letter');
  });

  it('should reject password without number', () => {
    const result = validatePasswordStrength('Abcdefgh!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one number');
  });

  it('should reject password without special character', () => {
    const result = validatePasswordStrength('Abcdefg1');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one special character');
  });

  it('should return multiple errors for password missing multiple criteria', () => {
    const result = validatePasswordStrength('abc');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe('formatCnpj', () => {
  it('should format a 14-digit numeric string to CNPJ format', () => {
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('should return the original string if not 14 digits', () => {
    expect(formatCnpj('123')).toBe('123');
    expect(formatCnpj('')).toBe('');
  });

  it('should handle already formatted input by reformatting', () => {
    expect(formatCnpj('11.222.333/0001-81')).toBe('11.222.333/0001-81');
  });
});
