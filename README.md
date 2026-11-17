# Project 2.0

<p align="center">
  <strong>AI Product Engineer · Full Stack + AI</strong><br>
  Operational workspace for task execution, governance, decision tracking, and AI-assisted knowledge workflows.
</p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Next.js" src="https://img.shields.io/badge/Frontend-Next.js-000000?logo=next.js&logoColor=white">
  <img alt="Fastify" src="https://img.shields.io/badge/Backend-Fastify-000000?logo=fastify&logoColor=white">
  <img alt="Prisma" src="https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma&logoColor=white">
  <img alt="Google Gemini" src="https://img.shields.io/badge/AI-Google%20Gemini-8E75B2?logo=googlegemini&logoColor=white">
</p>

## Product overview

Project 2.0 is a full-stack operational platform designed to support a work environment where teams can:

- manage tasks and execution flow
- create, review, and audit decisions
- monitor operational status and summaries
- interact with AI through contextual workflows
- keep a structured record of work history and accountability

The project combines a Next.js frontend, a Fastify backend, Prisma persistence, and AI integration to create a controllable operating layer for internal workflows and decision support.

## Why this project matters

Modern teams often deal with fragmented systems: task tracking lives in one place, decisions in another, knowledge in documents or chat tools, and operational visibility is incomplete. This application aims to reduce that fragmentation by centralizing these functions into a single interface.

The value is not only in UI polish but in the underlying system design:

- structured task lifecycle
- decision capture and filtering
- operational dashboard for leadership visibility
- AI-assisted interaction connected to backend logic
- extensible architecture for future workflow modules

## Core capabilities

- **Operational dashboard** with executive and operational views
- **Task management** with create, update, filter and workflow states
- **Decision registry** with historical audit trail
- **Workspace management** for project context and team organization
- **AI chat integration** with backend proxying to an AI service
- **Authentication flow** with demo access patterns and separation of production logic
- **Prisma-backed persistence** for operational records and metadata
- **Preview-friendly frontend integration** for local and deployment testing

## Architecture

```mermaid
flowchart LR
    User[User / Operator] --> Frontend[Next.js Frontend]
    Frontend --> API[Fastify Backend]
    API --> Prisma[Prisma + PostgreSQL]
    API --> Gemini[Google Gemini / AI service]
    Frontend --> Operations[Dashboard / Tasks / Decisions]
```

### Stack

| Layer | Technologies |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Backend | Fastify, Node.js, TypeScript |
| Data layer | Prisma, PostgreSQL |
| AI integration | Google Gen AI SDK and AI orchestration layer |
| Developer tooling | npm workspaces, Vitest, TypeScript |

## Repository structure

```text
project-2.0/
├── frontend/              # Next.js application and UI
├── backend/               # Fastify API and domain routes
├── scripts/               # Local startup and orchestration scripts
├── docs/                  # Architecture, roadmap, usage guides
├── .env.example           # Environment variables template
├── package.json           # Root workspace configuration
├── README.md              # Project overview
├── LICENSE                # Repository license
└── CHANGELOG.md           # Change history
```

## Getting started

### Requirements

- Node.js 18+
- npm
- PostgreSQL connection via `DATABASE_URL` for persistent storage
- Google AI credentials if the AI functions are enabled

### Environment variables

Copy the template and fill in your environment values:

```bash
cp .env.example .env
```

Example values:

```env
DATABASE_URL=postgresql://user:pass@host:5432/db
GEMINI_API_KEY=your_key_here
JWT_SECRET=your_secret
JWT_EXPIRES_IN=7d
XEREBRO_API_KEY=optional
ALLOWED_ORIGINS=http://localhost:3000
```

### Run the app locally

```bash
npm install
npm run dev
```

By default the workspace launches the services for:

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Dashboard: http://localhost:3000/dashboard

## Product workflow

The platform is organized around a practical operational loop:

1. Create or review tasks.
2. Capture decision points and status updates.
3. Reconcile activity with recent history and audit context.
4. Use AI-assisted chat and generation when needed.
5. Monitor dashboards for operational clarity and executive summaries.

This is the core product behavior that is currently represented in the codebase.

## Notes on scope

The repository includes both production-oriented modules and historical/experimental modules. These are intentionally separated in documentation to make clear what is already integrated and validated versus what remains conceptual or exploratory.

In practical terms:

- **Functional modules**: dashboard, tasks, decisions, workspaces, authentication flow, API proxies
- **Experimental modules**: conceptual AI, neural, simulation or exploratory systems
- **Historical modules**: earlier design ideas preserved for reference and future iteration

This distinction matters for portfolio presentation because it shows engineering judgment and product discipline.

## Developer commands

```bash
npm run dev
npm run build
npm run typecheck
npm run test
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Usage guide](docs/USAGE.md)
- [Contributing](CONTRIBUTING.md)
- [License](LICENSE)

## Security and operational notes

- Keep secrets in environment variables and never store them in source control.
- The preview/demo mode is intended for testing and demonstration only.
- Production-grade authentication, authorization and data isolation should be reviewed before external deployment.
- AI services and model calls should be controlled with rate limits, validation and operational guardrails.

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for details.

## Positioning

This repository is best framed as a product-style engineering project in the AI + operations space: a system that combines software architecture, product thinking, operational dashboards, and generative AI integration into a usable interface.
