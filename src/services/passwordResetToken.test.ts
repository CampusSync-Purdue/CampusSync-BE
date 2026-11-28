import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from './passwordResetToken.js'

describe('CSYNC-29 password-reset tokens', () => {
  it('generates a 64-character hexadecimal token', () => {
    const { token } = generatePasswordResetToken()

    assert.match(token, /^[a-f0-9]{64}$/)
  })

  it('generates different tokens for separate requests', () => {
    const first = generatePasswordResetToken()
    const second = generatePasswordResetToken()

    assert.notEqual(first.token, second.token)
    assert.notEqual(first.tokenHash, second.tokenHash)
  })

  it('stores a SHA-256 hash rather than the raw token', () => {
    const { token, tokenHash } = generatePasswordResetToken()

    assert.equal(tokenHash, hashPasswordResetToken(token))
    assert.notEqual(tokenHash, token)
    assert.match(tokenHash, /^[a-f0-9]{64}$/)
  })

  it('sets the expiration time to 30 minutes', () => {
    const before = Date.now()

    const { expiresAt } = generatePasswordResetToken()

    const after = Date.now()

    assert.ok(
      expiresAt.getTime() >= before + PASSWORD_RESET_TOKEN_TTL_MS,
    )

    assert.ok(
      expiresAt.getTime() <= after + PASSWORD_RESET_TOKEN_TTL_MS,
    )
  })
})