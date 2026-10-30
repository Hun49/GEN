# GEN — AI-Powered Academic Exam Platform

Generate custom exams on any topic using AI, practice with instant grading, and explore exams created by others. Built for learners, educators, and autodidacts.

To run this application first:

- **Custom Exam Generation** — Generate rigorous, multi-format exams (Multiple Choice, True/False) on any subject via Groq AI
- **Document Upload** — Use PDF, PPTX, or DOCX files as source material for exam generation
- **Two Practice Modes**
  - *Instant Feedback* — Validates answers immediately with step-by-step proofs and on-demand AI explanations
  - *Exam Mode* — Timed, silent answering with solutions hidden until submission, followed by a diagnostic report
- **AI Tutor Explanations** — Deep-dive explanations for wrong answers
- **Anonymous Usage** — Start practicing instantly with zero friction; link to an email account later
- **Public Exam Discovery** — Browse and practice exams published by other users
- **Performance Tracking** — Historical attempts, score improvements, and mastery levels per question
- **External API** — Generate MC and true/false exams server-to-server with project-scoped API keys and custom JSON Schema responses
- **Dark & Light Themes** — Toggle between Dark Charcoal and Pure White themes

## Tech Stack

| Layer | Technology |
| ------- | ----------- |
| Framework | [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) |
| UI | React 19, [Tailwind CSS v4](https://tailwindcss.com/), [Lucide Icons](https://lucide.dev/) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |
| Auth | [Better Auth](https://www.better-auth.com/) (anonymous + email/password) |
| Database | Cloudflare D1 (SQLite) via [Drizzle ORM](https://orm.drizzle.team/) |
| Storage | Cloudflare R2 (document uploads) |
| AI | Groq API (exam generation & explanations) |
| Validation | [Zod](https://zod.dev/) |
| Linting | [Biome](https://biomejs.dev/) |
| Deployment | [Cloudflare Workers](https://developers.cloudflare.com/workers/) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)
- A [Groq API key](https://console.groq.com/)

### INSTALL & Run

```bash
pnpm install
pnpm dev
```

The dev server runs at `http://localhost:3000`.

### Environment Variables

Copy `.dev.vars.example` to `.dev.vars` for the local Workers runtime:

```env
ADMIN_PASSWORD_HASH=output-from-pnpm-admin:hash
GROQ_API_KEY=your_groq_api_key
BETTER_AUTH_SECRET=your_auth_secret
BETTER_AUTH_URL=http://localhost:3000
```

Generate a Better Auth secret:

```bash
pnpm dlx @better-auth/cli secret
```

Generate the admin console password hash:

```bash
pnpm admin:hash "your-strong-password"
```

The admin console is available at `/api`. External API documentation is in [`docs/external-api.md`](docs/external-api.md).

## Scripts

| Command | Description |
| --------- | ------------- |
| `pnpm dev` | Start dev server on port 3000 |
| `pnpm build` | Build for production |
| `pnpm lint` | Lint with Biome |
| `pnpm format` | Format with Biome |
| `pnpm check` | Lint + format check |
| `pnpm test` | Run tests with Vitest |
| `pnpm deploy` | Build and deploy to Cloudflare Workers |
| `pnpm admin:hash` | Generate the admin console password hash |

## Database

The project uses Cloudflare D1 in production and local SQLite for development.

```bash
pnpm db:generate   # Generate Drizzle migrations
DATABASE_URL=dev.db pnpm db:migrate  # Apply migrations to local SQLite
pnpm db:push       # Push schema changes
pnpm db:studio     # Open Drizzle Studio
```

## Deployment

1. Install Wrangler: `npm install -g wrangler`
2. Authenticate: `wrangler login`
3. Set secrets: `wrangler secret put GROQ_API_KEY`, `wrangler secret put BETTER_AUTH_SECRET`, and `wrangler secret put ADMIN_PASSWORD_HASH`
4. Apply D1 migrations: `wrangler d1 migrations apply gen-db --remote`
5. Deploy: `pnpm deploy`

The `wrangler.jsonc` configures D1, R2, and Queue bindings.

## Project Structure

```text
src/
├── components/       # UI components (AuthModal, Sidebar, TopHeader, etc.)
├── db/               # Database connection and Drizzle schema
├── lib/              # Auth, utilities, document processing, rate limiting
├── routes/           # File-based routes (TanStack Router)
├── stores/           # Zustand stores (exam session, performance, user, nav)
└── integrations/     # TanStack Query setup
```

## Acknowledgments & Third-Party Attributions

```text
This project is built on top of the following open-source libraries and third-party services. We're grateful to their maintainers.

#Frameworks & UI
- [TanStack Start](https://tanstack.com/start) & [TanStack Router](https://tanstack.com/router) — MIT
- [React](https://react.dev/) — MIT
- [Tailwind CSS](https://tailwindcss.com/) — MIT
- [Zustand](https://zustand-demo.pmnd.rs/) — MIT
- [Lucide Icons](https://lucide.dev/) — ISC

#Backend & Data
- [Better Auth](https://www.better-auth.com/) — MIT
- [Drizzle ORM](https://orm.drizzle.team/) — Apache-2.0
- [Zod](https://zod.dev/) — MIT
- [JSZip](https://stuk.github.io/jszip/) — MIT/GPLv3 dual license
- [unpdf](https://github.com/unjs/unpdf) — MIT

#Infrastructure & AI
- [Cloudflare Workers, D1, R2, and Queues](https://developers.cloudflare.com/) — Cloudflare, Inc.
- [Groq API](https://groq.com/) — inference provider for exam generation and AI tutoring

#Tooling
- [Biome](https://biomejs.dev/) — MIT
- [Vitest](https://vitest.dev/) — MIT
- [pnpm](https://pnpm.io/) — MIT
- [TruffleHog](https://github.com/trufflesecurity/trufflehog) — used in CI for automated secret scanning

All trademarks and product names are property of their respective owners. No affiliation with or endorsement by these projects is implied.
```

## License

All rights reserved c.
