# upwin community — web app

Next.js 16 + Tailwind 4 + shadcn/ui. The desk side of upwin: it shows your Overview and
application tracker, and holds the inputs that shape every analysis and proposal. There is
no sign-in and no billing. It runs on your machine and talks to your own upwin API.

## Setup

```bash
pnpm install
cp .env.example .env.local     # works as-is when the API runs on localhost:3002
pnpm dev                       # http://localhost:3000
```

The API must be running. **Settings → Connection** shows whether this app can reach it, which
AI mode it is in, and how to set up the browser extension.

## Pages

| Section | Page | Route |
|---|---|---|
| Work | Overview: score trend, funnel, recent activity, setup checklist | `/<lang>` |
| | Applications: proposal tracker, as a kanban board or a table | `/<lang>/applications` |
| | Videos: your recordings, their links and who watched | `/<lang>/videos` |
| About you | My context: CV upload, manual entry, review | `/<lang>/context` |
| | Goals: what you are optimizing for | `/<lang>/goals` |
| | Proposal style: tone, length, language | `/<lang>/proposal-style` |
| Settings | Connection: API, AI mode, extension setup | `/<lang>/settings/connection` |
| | AI models: the model per capability | `/<lang>/settings/models` |
| | Prompts: edit, dry-run and activate prompt revisions | `/<lang>/settings/prompts` |

The languages are English (`en`) and French (`fr`). `/` redirects to your browser's language.

Public, for your clients: `/<lang>/v/<slug>`, a video link, plus its poster and view routes under
`/api/videos/`. Everything else is yours alone.

## Online (Vercel)

Set **Root Directory** to `front` and add `API_URL`, `API_TOKEN`, `APP_PASSWORD` and `APP_URL`
as environment variables. With `APP_PASSWORD` set, every page but the video links asks for it
once per browser. There are no accounts. Full walkthrough: `docs/DEPLOY.md` at the repository
root.

## How it talks to the API

Every API call happens on this server (server components, server actions and route handlers),
never from the browser. `API_URL`, `API_TOKEN` and `APP_PASSWORD` are server-only values.

## Gates

```bash
pnpm lint && pnpm test && pnpm build
```

## License

AGPL-3.0-only.
