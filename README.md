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

## Project structure

```text
src/
  config/       # Environment and application configuration
  controllers/  # Request handlers
  middleware/   # Express middleware
  routes/       # API route definitions
  services/     # Business logic and external integrations
  types/        # Shared TypeScript types
  app.ts        # Express app and middleware configuration
  server.ts     # Environment loading and HTTP server startup
```
