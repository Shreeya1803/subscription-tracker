import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  // TODO: TDD Section 12 specifies 'hashed passwords (strong algorithm)' but no
  // explicit complexity policy. 8-char minimum is a conventional default, not
  // a TDD-stated requirement -- confirm with client if a specific policy exists.
  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  displayName: string;

  // ISO 4217 currency code, e.g. USD, EUR -- per TDD 8.2 'default_currency'
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'defaultCurrency must be a 3-letter ISO 4217 code' })
  defaultCurrency: string;
}
