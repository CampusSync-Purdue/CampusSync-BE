import { randomUUID } from "node:crypto";
import type { User } from "../types/user.js";
import { normalizeEmail } from "../validation/registerValidation.js";

/**
 * In-memory user store. This is the only module that knows how users are
 * persisted, so replacing it with a real database table means changing this
 * file alone: the service and controller above it stay as they are.
 *
 * Data does not survive a restart.
 */
const users: User[] = [];

export type NewUserRecord = Omit<User, "id" | "createdAt">;

export function findUserByEmail(email: string): User | undefined {
  const normalizedEmail = normalizeEmail(email);

  return users.find((user) => user.email === normalizedEmail);
}

export function insertUser(record: NewUserRecord): User {
  const user: User = {
    ...record,
    email: normalizeEmail(record.email),
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };

  users.push(user);

  return user;
}

/** Test helper: drops every stored user so cases start from a clean store. */
export function clearUsers(): void {
  users.length = 0;
}
