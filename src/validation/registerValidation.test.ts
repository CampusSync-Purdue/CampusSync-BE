import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeEmail,
  validateRegisterInput,
} from "../validation/registerValidation.js";

const validInput = {
  name: "Varun Teja",
  email: "varun@campussync.edu",
  password: "Password1",
};

describe("normalizeEmail", () => {
  it("trims surrounding whitespace and lowercases", () => {
    assert.equal(normalizeEmail("  Varun@Campus.EDU "), "varun@campus.edu");
  });
});

describe("validateRegisterInput", () => {
  it("accepts a well formed registration", () => {
    const result = validateRegisterInput(validInput);

    assert.equal(result.valid, true);
    assert.deepEqual(result.valid && result.value, {
      name: "Varun Teja",
      email: "varun@campussync.edu",
      password: "Password1",
    });
  });

  it("trims the name and normalizes the email", () => {
    const result = validateRegisterInput({
      ...validInput,
      name: "  Varun Teja  ",
      email: "  VARUN@CampusSync.edu  ",
    });

    assert.equal(result.valid, true);
    assert.equal(result.valid && result.value.name, "Varun Teja");
    assert.equal(result.valid && result.value.email, "varun@campussync.edu");
  });

  it("does not alter the password", () => {
    const result = validateRegisterInput({
      ...validInput,
      password: "  Password1  ",
    });

    assert.equal(result.valid, true);
    assert.equal(result.valid && result.value.password, "  Password1  ");
  });

  it("rejects a missing body", () => {
    const result = validateRegisterInput(undefined);

    assert.equal(result.valid, false);
    assert.ok(result.valid === false && result.errors.name);
    assert.ok(result.valid === false && result.errors.email);
    assert.ok(result.valid === false && result.errors.password);
  });

  it("rejects a blank name", () => {
    for (const name of ["", "   ", undefined, 42]) {
      const result = validateRegisterInput({ ...validInput, name });

      assert.equal(result.valid, false, `expected ${String(name)} to fail`);
      assert.equal(result.valid === false && result.errors.name, "Name is required.");
    }
  });

  it("rejects a one-character name", () => {
    const result = validateRegisterInput({ ...validInput, name: "V" });

    assert.equal(result.valid, false);
    assert.match(
      (result.valid === false && result.errors.name) || "",
      /at least 2 characters/,
    );
  });

  it("rejects a name over 100 characters", () => {
    const result = validateRegisterInput({
      ...validInput,
      name: "a".repeat(101),
    });

    assert.equal(result.valid, false);
    assert.match(
      (result.valid === false && result.errors.name) || "",
      /100 characters or fewer/,
    );
  });

  it("rejects a missing email", () => {
    const result = validateRegisterInput({ ...validInput, email: "" });

    assert.equal(result.valid, false);
    assert.equal(
      result.valid === false && result.errors.email,
      "Email address is required.",
    );
  });

  it("rejects malformed email addresses", () => {
    const malformed = [
      "plainstring",
      "no-at-sign.edu",
      "@nolocalpart.edu",
      "missing@domain",
      "spaces in@email.edu",
      "two@@at.edu",
      "trailing@dot.",
    ];

    for (const email of malformed) {
      const result = validateRegisterInput({ ...validInput, email });

      assert.equal(result.valid, false, `expected ${email} to fail`);
      assert.equal(
        result.valid === false && result.errors.email,
        "Enter a valid email address.",
      );
    }
  });

  it("accepts emails with subdomains and plus addressing", () => {
    for (const email of [
      "varun+test@mail.campussync.edu",
      "first.last@sub.domain.co.uk",
    ]) {
      const result = validateRegisterInput({ ...validInput, email });

      assert.equal(result.valid, true, `expected ${email} to pass`);
    }
  });

  it("rejects a missing password", () => {
    const result = validateRegisterInput({ ...validInput, password: "" });

    assert.equal(result.valid, false);
    assert.equal(
      result.valid === false && result.errors.password,
      "Password is required.",
    );
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = validateRegisterInput({ ...validInput, password: "Pass1" });

    assert.equal(result.valid, false);
    assert.match(
      (result.valid === false && result.errors.password) || "",
      /at least 8 characters/,
    );
  });

  it("rejects a password over 128 characters", () => {
    const result = validateRegisterInput({
      ...validInput,
      password: `A1${"a".repeat(127)}`,
    });

    assert.equal(result.valid, false);
    assert.match(
      (result.valid === false && result.errors.password) || "",
      /128 characters or fewer/,
    );
  });

  it("requires lowercase, uppercase, and a number", () => {
    const cases: [string, RegExp][] = [
      ["PASSWORD1", /lowercase letter/],
      ["password1", /uppercase letter/],
      ["PasswordOnly", /a number/],
    ];

    for (const [password, expected] of cases) {
      const result = validateRegisterInput({ ...validInput, password });

      assert.equal(result.valid, false, `expected ${password} to fail`);
      assert.match(
        (result.valid === false && result.errors.password) || "",
        expected,
      );
    }
  });

  it("reports every invalid field at once", () => {
    const result = validateRegisterInput({
      name: "",
      email: "bad",
      password: "short",
    });

    assert.equal(result.valid, false);
    assert.deepEqual(
      result.valid === false && Object.keys(result.errors).sort(),
      ["email", "name", "password"],
    );
  });
});
