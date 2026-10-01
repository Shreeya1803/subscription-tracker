import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

// Enforces: customCycleDays must be a positive integer when billingCycle is
// 'custom', and must be omitted otherwise. Closes the gap flagged in TDD
// Section 10.1, where a missing/invalid customCycleDays silently miscalculates
// as a monthly charge instead of erroring.
export function IsValidCustomCycleDays(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidCustomCycleDays',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as any;
          if (obj.billingCycle === 'custom') {
            return typeof value === 'number' && value > 0;
          }
          return value === undefined || value === null;
        },
        defaultMessage(args: ValidationArguments) {
          const obj = args.object as any;
          if (obj.billingCycle === 'custom') {
            return 'customCycleDays must be a positive number when billingCycle is custom';
          }
          return 'customCycleDays must not be set unless billingCycle is custom';
        },
      },
    });
  };
}
