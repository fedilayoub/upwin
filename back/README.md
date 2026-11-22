# upwin community — API

NestJS 11 (Fastify) + PostgreSQL (Drizzle) + Vercel AI SDK. Single-user and self-hosted: it
runs on your machine, holds your data and your AI key, and has no accounts and no billing.

It is the only part of upwin that holds prompts, rubrics, scoring weights, model configuration,
or secrets. The browser extension and the web app only call it.

## Setup

```bash
pnpm install
cp .env.example .env      # set AI_API_KEY first: the API will not start without a provider
pnpm db:migrate
pnpm start:dev            # http://localhost:3002, OpenAPI at /docs
```

Or run the API and Postgres in containers:

```bash
cp .env.example .env
docker compose up -d --build
```

On a server, with automatic HTTPS (Caddy) for your domain:

```bash
API_DOMAIN=api.example.com \
  docker compose -f docker-compose.yml -f docker-compose.online.yml up -d --build
```

Set `API_TOKEN` first. Full walkthrough: `docs/DEPLOY.md` at the repository root.

## AI providers

The API calls a real model from the first request. Set `AI_BASE_URL` and `AI_API_KEY`
(a key is optional only for a model server on this machine) and, if you like, one model per
capability. Without a provider, the API refuses to start and names what is missing.

- **Recommended:** llmgateway.io.
- **Also works:** any OpenAI-compatible endpoint with structured (JSON schema) output, e.g.
  OpenAI, OpenRouter, Ollama or LM Studio.

Guide: [docs/AI-PROVIDER-SETUP.md](docs/AI-PROVIDER-SETUP.md).

## Video proposals

Recordings go to your own S3-compatible bucket (Cloudflare R2's free tier is enough), and
clients watch them on the web app's public `/v/<slug>` page.

- **Setup:** [docs/VIDEO-STORAGE-SETUP.md](docs/VIDEO-STORAGE-SETUP.md).
- **No caps:** no monthly count, no storage cap, no expiry. A recording can be up to 20
  minutes long, and a video stays shareable until you delete it.
- **Your own plays don't count:** a play that presents the API's `API_TOKEN` is not counted.

Each analysis makes one structured model call. The model returns criteria scores; the API
applies versioned, goal-dependent weights to compute the score (`src/profile/scoring/`), so
the model never owns the final number.

## Access

There are no accounts. Every request is served as the one local user. What keeps other
people out:

| Setting | Default | Effect |
|---|---|---|
| `HOST` | `127.0.0.1` | The interface the API listens on. Anything else needs `API_TOKEN`, or the API refuses to boot. |
| `API_TOKEN` | unset | When set, every route except `/health` and the share page's `/public/videos/*` needs `Authorization: Bearer <API_TOKEN>`. Without it, only requests addressed to `localhost`, `127.0.0.1` or `[::1]` are served, which blocks DNS-rebinding pages. |
| `APP_URL`, `EXTENSION_ALLOWED_ORIGINS` | | Exact CORS origins. Requests from any other browser origin get 403. |
| `ALLOW_NETWORK_WITHOUT_TOKEN` | `false` | For containers only: `HOST=0.0.0.0` with the port published on `127.0.0.1`. |

## Diagnostics

Every response carries `X-Request-Id`. Every 4xx and 5xx logs one line with that id and a
server-only `cause`. The extension shows the same id next to an error, so you can find the
matching line in `docker compose logs api`.

## Gates

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build

# Database integration tests, against a throwaway database:
RUN_DATABASE_INTEGRATION=1 DATABASE_URL=postgresql://... pnpm test
```

Tests never reach the network: AI calls use fixtures (`NODE_ENV=test` only), and
`test/network-fetch-guard.ts` fails any test that calls a non-localhost host.

## License

AGPL-3.0-only.
