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

  if (typeof rawPassword !== "string" || rawPassword.length === 0) {
    errors.password = "Password is required.";
  } else if (rawPassword.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  } else if (rawPassword.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  } else if (!/[a-z]/.test(rawPassword)) {
    errors.password = "Password must include a lowercase letter.";
  } else if (!/[A-Z]/.test(rawPassword)) {
    errors.password = "Password must include an uppercase letter.";
  } else if (!/[0-9]/.test(rawPassword)) {
    errors.password = "Password must include a number.";
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
