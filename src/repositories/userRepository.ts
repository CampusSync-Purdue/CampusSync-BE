import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import type { User, UserRole } from "../types/user.js";
import { isUuid } from "../validation/uuid.js";
import { normalizeEmail } from "../validation/registerValidation.js";

/**
 * Postgres-backed user store. This is the only module that knows how users
 * are persisted; services and controllers depend on these functions only.
 */

export type NewUser = {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
};

export async function findUserByEmail(email: string): Promise<User | undefined> {
  // Matches the lower(email) unique index, so the lookup is case-insensitive.
  const [user] = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, normalizeEmail(email)))
    .limit(1);

  return user;
}

export async function findUserById(id: string): Promise<User | undefined> {
  // Tokens issued before the move to Postgres carry non-UUID ids; treat them
  // as unknown users rather than letting Postgres raise a cast error.
  if (!isUuid(id)) {
    return undefined;
  }

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return user;
}

/**
 * @throws the driver error (SQLSTATE 23505) when the email is already taken.
 */
export async function insertUser(record: NewUser): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({ ...record, email: normalizeEmail(record.email) })
    .returning();

  return user;
}
