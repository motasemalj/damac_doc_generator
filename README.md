# DAMAC DocGen

**Intelligent Technical Documentation Platform**

Generate publication-quality Technical Design Documents (TDDs) from your codebase using AI. Upload a ZIP of your source code, select a template, and get a comprehensive TDD with architecture diagrams, API specifications, and more.

## Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 10.0.0
- **OpenAI API Key** (for TDD generation)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client
npm run db:generate

# 3. Push database schema (creates SQLite database)
npm run db:push

# 4. Seed default templates
npm run db:seed

# 5. Start the development server
npm run dev
```

The app will be available at **http://localhost:3000**.

### Environment Variables

Create a `.env` file in `apps/web/` (one is already created):

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | Database connection string | `file:../../packages/db/prisma/dev.db` |
| `OPENAI_API_KEY` | Your OpenAI API key | Required for generation |
| `OPENAI_MODEL` | OpenAI model to use | `gpt-4o` |
| `NODE_ENV` | Environment | `development` |

## Architecture

```
damac-docgen/
├── apps/
│   └── web/                  # Next.js 15 App (UI + API)
│       ├── src/
│       │   ├── app/          # Pages and API routes
│       │   ├── components/   # UI components
│       │   └── lib/          # Auth, storage, utilities
│       └── public/brand/     # DAMAC branding assets
├── packages/
│   ├── shared/               # Shared types, constants, validators
│   ├── db/                   # Prisma schema and database client
│   └── core/                 # OpenAI generation, template engine, ingester
```

## Features

### Authentication
- Email/password signup and login
- Session-based authentication with CSRF protection
- Secure password hashing with bcrypt

### Project Management
- Create and manage documentation projects
- Upload codebase as ZIP files (validated, extracted safely)
- Version snapshots with file tree visualization

### TDD Generation
- AI-powered generation using OpenAI API
- Real-time token streaming to the UI
- Customizable templates with variable substitution
- Rate limiting and retry logic
- Generation job tracking with token usage

### TDD Viewer
- Rich Markdown rendering with syntax highlighting
- Mermaid diagram rendering (client-side)
- Table of Contents with scroll-to-section navigation
- Responsive design for large documents

### TDD Editor
- Split view: Markdown editor + live preview
- Mermaid diagram preview in real-time
- Autosave (5-second debounce) + explicit save
- Version history with revision restore
- Document metadata (title, description, tags)

### Template Management
- Default DAMAC Enterprise TDD template included
- Create, edit, clone, and delete templates
- Variable placeholders with `{{VARIABLE_NAME}}` syntax
- Prompt preview with variable substitution
- Validation for well-formed template expressions

### PDF Export
- Export any TDD as a branded PDF
- DAMAC-branded cover page with logo
- Preserves headings, tables, code blocks
- Mermaid diagrams rendered in PDF
- Powered by Puppeteer (HTML-to-PDF)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS, shadcn/ui-style components |
| Backend | Next.js API Routes |
| Database | SQLite (dev) via Prisma ORM |
| Auth | Custom bcrypt + sessions |
| AI | OpenAI API (streaming) |
| Markdown | react-markdown + remark-gfm |
| Diagrams | Mermaid.js (client-side rendering) |
| PDF | Puppeteer (headless Chrome) |
| Monorepo | Turborepo + npm workspaces |

## PDF Export Setup

PDF generation requires Puppeteer (headless Chrome). It is included as a dependency and should work automatically. On first run, Puppeteer will download a Chromium binary.

For servers without a display:
```bash
# Linux: install required system dependencies
npx puppeteer browsers install chrome
```

## Production Deployment

```bash
# Build all packages
npm run build

# Start production server
cd apps/web && npm start
```

For production, consider:
- Replace SQLite with PostgreSQL (update `schema.prisma` provider)
- Use S3-compatible storage (implement `StorageAdapter` interface)
- Set `NODE_ENV=production` for secure cookies
- Use a process manager (PM2, Docker, etc.)

## Security

- Uploaded code is never executed
- ZIP contents are validated and extracted safely (path traversal protection)
- Markdown rendering is sanitized against XSS
- All project/TDD access is auth-checked
- Audit logging for uploads, generation, exports
- CSRF tokens on sessions
- OpenAI API key is only read from environment variables
