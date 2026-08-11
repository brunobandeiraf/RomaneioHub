'use client';

import { forwardRef, useCallback, InputHTMLAttributes } from 'react';
import { Input } from './input';

export interface CnpjInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Applies the CNPJ mask: XX.XXX.XXX/XXXX-XX
 */
export function applyCnpjMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  let masked = digits;

  if (digits.length > 2) {
    masked = `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }
  if (digits.length > 5) {
    masked = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }
  if (digits.length > 8) {
    masked = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  if (digits.length > 12) {
    masked = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }

  return masked;
}

export const CnpjInput = forwardRef<HTMLInputElement, CnpjInputProps>(
  ({ value, onChange, label = 'CNPJ *', error, ...props }, ref) => {
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const masked = applyCnpjMask(e.target.value);
        onChange(masked);
      },
      [onChange]
    );

    return (
      <Input
        ref={ref}
        label={label}
        name="cnpj"
        placeholder="XX.XXX.XXX/XXXX-XX"
        value={value}
        onChange={handleChange}
        error={error}
        {...props}
      />
    );
  }
);

CnpjInput.displayName = 'CnpjInput';
