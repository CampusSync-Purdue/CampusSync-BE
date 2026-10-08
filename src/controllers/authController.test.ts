import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, afterEach, before, describe, it } from "node:test";
import bcrypt from "bcrypt";
import app from "../app.js";
import { clearUsers, findUserByEmail } from "../repositories/userRepository.js";

type RegisterResponse = {
  status: number;
  body: {
    message?: string;
    errors?: Record<string, string>;
    user?: Record<string, unknown>;
  };
  rawBody: string;
};

let baseUrl = "";
let server: ReturnType<typeof app.listen>;

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });

  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

afterEach(() => {
  clearUsers();
});

async function postRegister(payload: unknown): Promise<RegisterResponse> {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const rawBody = await response.text();

  return {
    status: response.status,
    body: rawBody ? JSON.parse(rawBody) : {},
    rawBody,
  };
}

const validPayload = {
  name: "Varun Teja",
  email: "varun@campussync.edu",
  password: "Password1",
};

describe("POST /api/auth/register", () => {
  it("creates an account and returns 201", async () => {
    const response = await postRegister(validPayload);

    assert.equal(response.status, 201);
    assert.equal(response.body.user?.name, "Varun Teja");
    assert.equal(response.body.user?.email, "varun@campussync.edu");
    assert.ok(response.body.message);
  });

  it("assigns the default user role", async () => {
    const response = await postRegister(validPayload);

    assert.equal(response.body.user?.role, "user");
  });

  it("returns an id and createdAt timestamp", async () => {
    const response = await postRegister(validPayload);

    assert.equal(typeof response.body.user?.id, "string");
    assert.ok(
      !Number.isNaN(Date.parse(String(response.body.user?.createdAt))),
      "createdAt should be a parseable date",
    );
  });

  it("never returns password data in the response", async () => {
    const response = await postRegister(validPayload);

    assert.equal(response.body.user?.password, undefined);
    assert.equal(response.body.user?.passwordHash, undefined);
    assert.ok(
      !response.rawBody.includes("Password1"),
      "raw response body must not contain the plaintext password",
    );
    assert.ok(
      !response.rawBody.toLowerCase().includes("passwordhash"),
      "raw response body must not contain the password hash field",
    );
  });

  it("stores a bcrypt hash rather than the plaintext password", async () => {
    await postRegister(validPayload);

    const stored = findUserByEmail(validPayload.email);

    assert.ok(stored, "user should have been stored");
    assert.notEqual(stored.passwordHash, validPayload.password);
    assert.match(stored.passwordHash, /^\$2[aby]\$/);
    assert.equal(
      await bcrypt.compare(validPayload.password, stored.passwordHash),
      true,
    );
  });

  it("rejects a duplicate email with 409", async () => {
    await postRegister(validPayload);

    const response = await postRegister(validPayload);

    assert.equal(response.status, 409);
    assert.ok(response.body.errors?.email);
  });

  it("treats email uniqueness as case-insensitive", async () => {
    await postRegister(validPayload);

    const response = await postRegister({
      ...validPayload,
      email: "VARUN@CampusSync.EDU",
    });

    assert.equal(response.status, 409);
  });

  it("rejects a missing email with 400", async () => {
    const response = await postRegister({ ...validPayload, email: "" });

    assert.equal(response.status, 400);
    assert.equal(response.body.errors?.email, "Email address is required.");
  });

  it("rejects an invalid email with 400", async () => {
    const response = await postRegister({
      ...validPayload,
      email: "not-an-email",
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.errors?.email, "Enter a valid email address.");
  });

  it("rejects a weak password with 400", async () => {
    const response = await postRegister({ ...validPayload, password: "abc" });

    assert.equal(response.status, 400);
    assert.ok(response.body.errors?.password);
  });

  it("rejects a missing name with 400", async () => {
    const response = await postRegister({ ...validPayload, name: "" });

    assert.equal(response.status, 400);
    assert.equal(response.body.errors?.name, "Name is required.");
  });

  it("does not store a user when validation fails", async () => {
    await postRegister({ name: "", email: "bad", password: "x" });

    assert.equal(findUserByEmail("bad"), undefined);
  });

  it("ignores a client-supplied role and id", async () => {
    const response = await postRegister({
      ...validPayload,
      role: "admin",
      id: "attacker-chosen-id",
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.user?.role, "user");
    assert.notEqual(response.body.user?.id, "attacker-chosen-id");
  });
});
