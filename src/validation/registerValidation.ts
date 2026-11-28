import type { RegisterUserInput } from "../types/user.js";

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 100;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const EMAIL_MAX_LENGTH = 254;

/**
 * Deliberately conservative: one @, no whitespace, a dot-separated domain.
 * Validation is a guard against obvious mistakes, not a deliverability check.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export type FieldErrors = Partial<
  Record<"name" | "email" | "password", string>
>;

export type ValidationResult =
  | { valid: true; value: RegisterUserInput }
  | { valid: false; errors: FieldErrors };

/** Lowercases and trims so that email uniqueness is case-insensitive. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validates a password using CampusSync's registration requirements.
 *
 * Reused by:
 * - User registration
 * - CSYNC-29 password reset
 *
 * Returns undefined when the password is valid.
 * Otherwise, returns a validation error message.
 */
export function validatePassword(password: unknown): string | undefined {
  if (typeof password !== "string" || password.length === 0) {
    return "Password is required.";
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  }

  if (!/[a-z]/.test(password)) {
    return "Password must include a lowercase letter.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter.";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must include a number.";
  }

  return undefined;
}

export function validateRegisterInput(body: unknown): ValidationResult {
  const errors: FieldErrors = {};
  const input = (body ?? {}) as Record<string, unknown>;

  const rawName = input.name;
  const rawEmail = input.email;
  const rawPassword = input.password;

  if (!isNonEmptyString(rawName)) {
    errors.name = "Name is required.";
  } else if (rawName.trim().length < NAME_MIN_LENGTH) {
    errors.name = `Name must be at least ${NAME_MIN_LENGTH} characters.`;
  } else if (rawName.trim().length > NAME_MAX_LENGTH) {
    errors.name = `Name must be ${NAME_MAX_LENGTH} characters or fewer.`;
  }

  if (!isNonEmptyString(rawEmail)) {
    errors.email = "Email address is required.";
  } else if (rawEmail.trim().length > EMAIL_MAX_LENGTH) {
    errors.email = `Email address must be ${EMAIL_MAX_LENGTH} characters or fewer.`;
  } else if (!EMAIL_PATTERN.test(rawEmail.trim())) {
    errors.email = "Enter a valid email address.";
  }

  // Reuse the same password policy for registration and password reset.
  const passwordError = validatePassword(rawPassword);

  if (passwordError) {
    errors.password = passwordError;
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    value: {
      name: (rawName as string).trim(),
      email: normalizeEmail(rawEmail as string),
      password: rawPassword as string,
    },
  };
}