import { pool } from "../config/database.js";
import type { User } from "../types/user.js";
import { normalizeEmail } from "../validation/registerValidation.js";

/**
 * Database access for users. This is the only module that knows how users are
 * persisted, so the services above it never build SQL.
 *
 * Registration, sign-in, and the administrator bootstrap all read and write
 * this one table. They previously used three separate stores, which meant a
 * registered user could not sign in and the bootstrapped administrator could
 * not either.
 */

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: User["role"];
  created_at: Date;
};

const USER_COLUMNS = "id, name, email, password_hash, role, created_at";

/** Matches the uuid the users table uses for its primary key. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at.toISOString(),
  };
}

export type NewUserRecord = Omit<User, "id" | "createdAt">;

/**
 * Looks a user up by email, case-insensitively.
 *
 * The comparison uses `lower(email)`, which matches the
 * `users_email_lower_unique` index, so someone who registered as
 * `Varun@example.com` can sign in as `varun@example.com`.
 */
export async function findUserByEmail(
  email: string,
): Promise<User | undefined> {
  const result = await pool.query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE lower(email) = $1`,
    [normalizeEmail(email)],
  );

  return result.rows[0] ? toUser(result.rows[0]) : undefined;
}

/**
 * Looks a user up by id.
 *
 * A non-uuid id would make PostgreSQL raise a type error, so it is treated as
 * "no such user" instead. That can happen with a token issued before users
 * moved onto the database.
 */
export async function findUserById(id: string): Promise<User | undefined> {
  if (!UUID_PATTERN.test(id)) {
    return undefined;
  }

  const result = await pool.query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
    [id],
  );

  return result.rows[0] ? toUser(result.rows[0]) : undefined;
}

/**
 * Inserts a user and returns it.
 *
 * The email is normalized on the way in so that what is stored matches what
 * the unique index compares.
 */
export async function insertUser(record: NewUserRecord): Promise<User> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${USER_COLUMNS}`,
    [
      record.name,
      normalizeEmail(record.email),
      record.passwordHash,
      record.role,
    ],
  );

  return toUser(result.rows[0]);
}

/** Test helper: removes one user by email, so a case leaves nothing behind. */
export async function deleteUserByEmail(email: string): Promise<void> {
  await pool.query("DELETE FROM users WHERE lower(email) = $1", [
    normalizeEmail(email),
  ]);
}
