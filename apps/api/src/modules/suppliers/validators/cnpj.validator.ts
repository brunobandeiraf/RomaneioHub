import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { validateCnpj } from '@romaneio-hub/shared';

@ValidatorConstraint({ name: 'isCnpj', async: false })
export class IsCnpjConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return validateCnpj(value);
  }

  defaultMessage(): string {
    return 'CNPJ is invalid. Must be a valid 14-digit CNPJ with correct check digits.';
  }
}

/**
 * Custom class-validator decorator that validates CNPJ format and check digits.
 * Uses validateCnpj from @romaneio-hub/shared.
 */
export function IsCnpj(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCnpjConstraint,
    });
  };
}
