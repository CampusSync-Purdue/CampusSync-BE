/** PostgreSQL error codes the application reacts to. */
export const PG_UNIQUE_VIOLATION = '23505'
export const PG_FOREIGN_KEY_VIOLATION = '23503'
export const PG_EXCLUSION_VIOLATION = '23P01'
export const PG_INVALID_TEXT_REPRESENTATION = '22P02'

type ErrorLike = { code?: unknown; constraint?: unknown; cause?: unknown }

/**
 * Drizzle wraps driver errors in DrizzleQueryError, so the pg error is in
 * `cause`. Walk the cause chain until an error with a SQLSTATE code is found.
 */
function findPgError(error: unknown): ErrorLike | undefined {
  let current: unknown = error

  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const candidate = current as ErrorLike

    if (typeof candidate.code === 'string') {
      return candidate
    }

    current = candidate.cause
  }

  return undefined
}

export function getPgErrorCode(error: unknown): string | undefined {
  return findPgError(error)?.code as string | undefined
}

export function getPgConstraint(error: unknown): string | undefined {
  const constraint = findPgError(error)?.constraint

  return typeof constraint === 'string' ? constraint : undefined
}
