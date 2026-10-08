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

## Local PostgreSQL database

This project runs PostgreSQL 16 in Docker.

### Start the database

1. Create `.env` from the template and set the `POSTGRES_*` values.

```bash
cp .env.example .env
```

2. Build the database image once, then start it:

```bash
./dev-env postgres      # Build the PostgreSQL image
./dev-env postgres up   # Start PostgreSQL and list its tables
```

`./dev-env postgres up` does not build an image. It starts the existing local
container and waits until PostgreSQL is healthy. If `.env` is missing, the
command stops without creating or changing files.

### Database initialization

On the first start of a new Docker volume, PostgreSQL automatically runs
`database/init/001_initial_schema.sql`. It creates `users`, `rooms`, and
`reservations`, including the constraint that prevents overlapping active room
reservations. Initialization scripts do not run again for an existing volume.
The initialization directory is mounted into the development container, so
changes to these SQL files do not require rebuilding the Docker image.
The schema uses `IF NOT EXISTS`, so running the script manually does not try to
create tables or indexes that already exist; it does not apply schema changes
to existing tables.

To reset local database data and run initialization again:

```bash
docker compose down -v
./dev-env postgres up
```

This permanently deletes local database data.

### Connect to PostgreSQL

From your machine:

```bash
docker compose exec postgres psql -U campussync_app -d campussync
```

Use this connection string from the backend when it runs on your machine:

```text
postgresql://campussync_app:your-password@localhost:5432/campussync
```

Containers on `campussync_network` use the Docker service hostname:

```text
postgresql://campussync_app:your-password@postgres:5432/campussync
```

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

## Request logs

Each API request is appended to `logs/application.log` as a JSON line. The logger records only the timestamp, HTTP method, route path, status code, and duration. Unhandled errors are also logged with error details and a stack trace, while the client receives a safe generic error message. Passwords, authorization headers, JWTs, and request bodies are deliberately excluded. The `logs/` directory is ignored by Git.

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
