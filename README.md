# CampusSync Backend

Backend API for CampusSync, built with Node.js, Express, and TypeScript.

## Prerequisites

- Node.js 18 or later
- npm

Verify your local installation:

```bash
node --version
npm --version
```

## Install dependencies

From the `CampusSync-BE` directory, run:

```bash
npm install
```

The direct dependency versions in `package.json` are pinned so team members install the same Express, CORS, dotenv, TypeScript, and related type-package versions.

## Environment variables

Create a local `.env` file from the template:

```bash
cp .env.example .env
```

Local development uses port `5050` because port `5000` may be used by AirTunes on macOS.

```env
PORT=5050
```

Never commit `.env`; it may later contain database credentials and other secrets. Commit changes to `.env.example` when a new variable is required.

## Run the API

Start the development server:

```bash
npm run dev
```

Other commands:

```bash
npm run build
npm start
```

`npm run build` compiles TypeScript from `src/` into `dist/`. `npm start` runs the compiled application.

## Health endpoint

Confirm the backend is running from a second terminal:

```bash
curl -i http://127.0.0.1:5050/api/health
```

Expected response:

```http
HTTP/1.1 200 OK
```

```json
{
  "status": "ok",
  "message": "CampusSync API is running"
}
```

## Registration endpoint

Create an account:

```bash
curl -i -X POST http://127.0.0.1:5050/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Varun Teja","email":"varun@campussync.edu","password":"Password1"}'
```

Successful responses are `201` and contain the new user without any password data:

```json
{
  "message": "Your account has been created.",
  "user": {
    "id": "54446290-115c-4f4d-8c6e-810640df7638",
    "name": "Varun Teja",
    "email": "varun@campussync.edu",
    "role": "user",
    "createdAt": "2026-10-01T22:52:11.291Z"
  }
}
```

Failure responses carry a `message` plus per-field `errors`:

| Status | Meaning |
| ------ | ------- |
| `400`  | A field is missing or invalid |
| `409`  | The email address is already registered |
| `500`  | Unexpected server error (details are logged, not returned) |

Rules enforced by the endpoint:

- Name is 2 to 100 characters.
- Email must be well formed, at most 254 characters, and is stored lowercased.
  Uniqueness is case-insensitive.
- Password is 8 to 128 characters and must contain a lowercase letter, an
  uppercase letter, and a number.
- Passwords are hashed with bcrypt (cost 12). The hash never leaves the backend.
- Every new account is assigned the default `user` role; a `role` supplied by
  the client is ignored.

Users are currently held in memory by `src/repositories/userRepository.ts`, so
accounts do not survive a restart. That module is the only place that knows how
users are stored, so swapping it for a real database table does not affect the
service, controller, or routes above it.

## Tests

```bash
npm test
```

Tests run on the Node.js built-in test runner through `tsx`, and live beside the
code they cover as `*.test.ts`. They are excluded from `npm run build`.

## Project structure

```text
src/
  config/         # Environment and application configuration
  constants/      # Shared constant values, including HTTP status codes
  controllers/    # Request handlers
  middleware/     # Express middleware
  repositories/   # Data access and persistence
  routes/         # API route definitions
  services/       # Business logic and external integrations
  types/          # Shared TypeScript types
  validation/     # Request payload validation
  app.ts          # Express app and middleware configuration
  server.ts       # Environment loading and HTTP server startup
```
