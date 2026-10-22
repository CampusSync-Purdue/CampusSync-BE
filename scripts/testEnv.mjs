// Test-only environment defaults.
//
// `src/config/environment.ts` throws when JWT_SECRET or DATABASE_URL is
// missing, which made every test importing it fail before any case ran. The
// test script loads `.env` when present and this module fills in whatever is
// still unset, so the suite runs on a machine with no local configuration.
//
// `??=` means a real `.env` always wins; these are fallbacks, never overrides.
process.env.JWT_SECRET ??= 'test-only-jwt-secret-not-used-outside-tests'
process.env.DATABASE_URL ??=
  'postgresql://campussync_app:campussync_test@localhost:5433/campussync'
