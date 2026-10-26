import type { UserRecord, UserRole } from "../db/schema.js";

export type { UserRole } from "../db/schema.js";

/**
 * A user as it is stored. `passwordHash` must never leave the backend:
 * use `PublicUser` for anything that is sent in a response.
 */
export type User = UserRecord;

/** The user shape that is safe to return in an API response. */
export type PublicUser = Omit<User, "passwordHash">;

export type RegisterUserInput = {
  name: string;
  email: string;
  password: string;
};

export const DEFAULT_USER_ROLE: UserRole = "user";

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;

  return publicUser;
}
