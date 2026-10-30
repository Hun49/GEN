# GEN External API

The GEN External API generates multiple-choice and true/false exams from source material.

- Base URL: `https://gen.hun-wrk0966.workers.dev`
- Endpoint: `POST /api/v1/generate`
- Content type: `application/json`
- Transport: HTTPS, JSON only, server-to-server
- CORS: not enabled

The API is intended for backend integrations. Do not call it directly from a browser.

## What you need

To call the API you only need three things:

1. **Base URL** — `https://gen.hun-wrk0966.workers.dev`
2. **Endpoint** — `POST /api/v1/generate`
3. **API key** — sent as `Authorization: Bearer gen_live_...`

Every request must also send `Content-Type: application/json` and a JSON body with at least a `content` field. Everything else is optional.

## Authentication

Create a project and API key in the admin console at `/api`. Keys look like:

```text
gen_live_...
```

Send the key as a Bearer token:

```http
Authorization: Bearer gen_live_...
```

Keys are shown once when created. Store them in a secret manager. Revoked keys and disabled projects are rejected immediately.

## Quick start

```bash
curl -X POST "https://gen.hun-wrk0966.workers.dev/api/v1/generate" \
  -H "Authorization: Bearer gen_live_your_key" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: biology-midterm-001" \
  -d '{
    "externalId": "biology-midterm-001",
    "content": "Photosynthesis converts light energy into chemical energy...",
    "subject": "Biology",
    "difficulty": "medium",
    "questionCount": 5,
    "questionTypes": ["multiple-choice", "true-false"],
    "language": "English",
    "sourceOnly": true
  }'
```

## Request body

Unknown fields are rejected with `400 VALIDATION_ERROR`.

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `content` | string | Yes | — | Source material. Maximum 35,000 characters. |
| `externalId` | string | No | — | Your identifier, max 128 characters. Echoed in schema, idempotency, and generation errors. |
| `instructions` | string | No | — | Extra generation instructions, max 2,000 characters. |
| `subject` | string | No | Auto-detect | Max 120 characters. |
| `difficulty` | string | No | `medium` | `easy`, `medium`, or `hard`. |
| `questionCount` | integer | No | `5` | 1–30. |
| `questionTypes` | array | No | `["multiple-choice"]` | Any of `multiple-choice`, `true-false`. |
| `language` | string | No | `English` | Max 40 characters. |
| `audience` | string | No | — | Max 80 characters. |
| `sourceOnly` | boolean | No | `true` | When true, questions must be grounded in `content`. |
| `responseSchema` | object | No | Project/default schema | Per-request JSON Schema override. |

The total request body is limited to 100 KB.

## Responses

### Default response

When neither the request nor the project defines a schema, GEN uses the built-in exam schema. A successful response body is exactly:

```json
{
  "title": "Cell Biology Review",
  "subject": "Biology",
  "difficulty": "medium",
  "description": "A short review of photosynthesis and cellular respiration.",
  "tags": ["biology", "cells", "metabolism"],
  "questionCount": 2,
  "questions": [
    {
      "number": 1,
      "type": "multiple-choice",
      "question": "Which organelle performs photosynthesis?",
      "options": [
        { "id": "A", "text": "Chloroplast" },
        { "id": "B", "text": "Mitochondrion" },
        { "id": "C", "text": "Nucleus" },
        { "id": "D", "text": "Ribosome" }
      ],
      "correctAnswer": { "id": "A", "text": "Chloroplast" },
      "explanation": "Chloroplasts contain chlorophyll and carry out photosynthesis."
    },
    {
      "number": 2,
      "type": "true-false",
      "question": "Cellular respiration releases energy from glucose.",
      "options": [
        { "id": "T", "text": "True" },
        { "id": "F", "text": "False" }
      ],
      "correctAnswer": { "id": "T", "text": "True" },
      "explanation": "Cellular respiration converts glucose into usable energy."
    }
  ]
}
```

The response has no `success` or `exam` wrapper. The successful body is exactly the schema-defined object.

### Custom response schemas

A schema can be set as the project default in the admin console, or sent per request with `responseSchema`. Precedence:

1. Request `responseSchema`
2. Project default schema
3. Built-in schema

Schema requirements:

- JSON Schema Draft 2020-12
- Root type must be `"object"`
- Maximum 16 KB serialized
- Local `$ref` values only; external URLs and remote references are rejected
- The schema describes the entire successful response body

The API asks the model to follow the schema, validates the generated JSON, repairs once if validation fails, then validates again. If the second attempt still fails, GEN returns `502 SCHEMA_VALIDATION_FAILED`.

Custom schemas should require fields explicitly and use `additionalProperties: false` where appropriate. Multiple-choice and true/false constraints are enforced by the prompt, not by the schema engine.

Example request schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["lessonTitle", "items"],
  "properties": {
    "lessonTitle": { "type": "string" },
    "items": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["prompt", "choices", "answer"],
        "properties": {
          "prompt": { "type": "string" },
          "choices": {
            "type": "array",
            "minItems": 2,
            "items": { "type": "string" }
          },
          "answer": { "type": "string" }
        }
      }
    }
  }
}
```

### Success headers

| Header | Description |
| --- | --- |
| `X-Gen-Request-Id` | Unique request ID. Include it in support requests. |
| `X-Gen-Idempotent-Replay` | `true` when a stored idempotent response was replayed. |
| `X-Gen-Schema-Source` | `default`, `project`, or `request`. |
| `X-Gen-Model` | Model that produced the response. |
| `X-Gen-Usage-Prompt-Tokens` | Prompt tokens used. |
| `X-Gen-Usage-Completion-Tokens` | Completion tokens used. |
| `X-Gen-Usage-Total-Tokens` | Total tokens used. |

### Error response

Errors always use this envelope:

```json
{
  "success": false,
  "requestId": "req_...",
  "externalId": "optional-client-id",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request body is invalid.",
    "details": [
      { "path": "questionCount", "message": "Too big: expected number to be <=30" }
    ]
  }
}
```

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Invalid JSON, unknown field, bad value, or invalid `Idempotency-Key`. |
| 400 | `INVALID_RESPONSE_SCHEMA` | The request-level schema is invalid. |
| 401 | `INVALID_API_KEY` | Missing or unknown Bearer key. |
| 403 | `KEY_REVOKED` | The key was revoked. |
| 403 | `PROJECT_DISABLED` | The project is disabled. |
| 409 | `IDEMPOTENCY_CONFLICT` | Same key used with a different request body. |
| 409 | `IDEMPOTENCY_IN_PROGRESS` | Same key is currently being processed. Retry after 2 seconds. |
| 413 | `CONTENT_TOO_LARGE` | Request body exceeds 100 KB. |
| 429 | `RATE_LIMITED` | Per-minute request limit exceeded. |
| 429 | `QUOTA_EXCEEDED` | Daily request or token quota exceeded. |
| 500 | `INTERNAL_ERROR` | Server error, including an invalid project default schema. |
| 502 | `SCHEMA_VALIDATION_FAILED` | The model could not produce schema-valid JSON after one repair. |
| 503 | `AI_UNAVAILABLE` | The AI provider is unavailable or not configured. |

## Limits

Limits are configured per project in the admin console. Defaults:

| Limit | Default |
| --- | --- |
| Requests per minute | 30 |
| Requests per day | 200 |
| Tokens per day | 1,000,000 |

Limit headers are returned on all authenticated requests:

```http
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 29
X-RateLimit-Reset: 1710000060
X-Gen-Daily-Requests-Remaining: 199
X-Gen-Daily-Tokens-Remaining: 998000
```

A `429` response includes `Retry-After` in seconds. Limits are hard stops.

## Idempotency

Send an optional `Idempotency-Key` header to make retries safe:

- Maximum 128 characters
- Allowed characters: letters, numbers, `.`, `_`, `:`, `-`
- Scoped to the project and key
- The request hash includes the normalized body and resolved schema
- Replays return the stored status and body for 24 hours
- Replays include `X-Gen-Idempotent-Replay: true`
- Replays count toward the per-minute rate limit, but not daily request or token quotas
- Completed response bodies are stored for 24 hours; source content is not stored

Same key and same body returns the original response. Same key and a different body returns `409 IDEMPOTENCY_CONFLICT`. A concurrent request with the same key returns `409 IDEMPOTENCY_IN_PROGRESS` with `Retry-After: 2`. Failed generations release the key so it can be retried.

## Admin console

The admin console is served at `/api`. It requires the `ADMIN_PASSWORD_HASH` environment variable and uses an 8-hour secure session.

From the console you can:

- create projects
- issue and revoke API keys
- reveal a key once at creation
- edit per-minute, per-day, and token limits
- disable a project
- set the default response schema
- inspect recent request metadata and usage

Analytics store request metadata only. Source content, generated exams, schema bodies, and client IP addresses are not stored in API usage records.

## Setup

Generate the admin password hash:

```bash
pnpm admin:hash "your-strong-password"
```

Add the result to `.dev.vars` for local development:

```dotenv
ADMIN_PASSWORD_HASH=scrypt:...
GROQ_API_KEY=...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
```

Apply the Drizzle migration before starting the app:

```bash
pnpm db:generate
pnpm db:migrate
```

For production, set the secret and apply the remote D1 migration:

```bash
wrangler secret put ADMIN_PASSWORD_HASH
wrangler d1 migrations apply gen-db --remote
```
