import bcrypt from "bcrypt";
import {
  findUserByEmail,
  insertUser,
} from "../repositories/userRepository.js";
import {
  DEFAULT_USER_ROLE,
  toPublicUser,
  type PublicUser,
  type RegisterUserInput,
} from "../types/user.js";

/**
 * Work factor for bcrypt. 12 is a reasonable 2020s default: slow enough to
 * make offline cracking expensive, fast enough for a request/response cycle.
 */
export const PASSWORD_SALT_ROUNDS = 12;

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("An account with this email address already exists.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

/**
 * Hashes the password, stores the user with the default `user` role, and
 * returns the user without the password hash.
 *
 * @throws EmailAlreadyRegisteredError when the email is already taken.
 */
export async function registerUser(
  input: RegisterUserInput,
): Promise<PublicUser> {
  if (findUserByEmail(input.email)) {
    throw new EmailAlreadyRegisteredError();
  }

  const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);

  const user = insertUser({
    name: input.name,
    email: input.email,
    passwordHash,
    role: DEFAULT_USER_ROLE,
  });

  return toPublicUser(user);
}
