# upwin community

A self-hosted assistant for freelancers on Upwork:

- **Profile analysis:** a score, the reasons behind it, and rewrite suggestions for each section.
- **Job match:** how well a job post fits you, before you spend Connects on it.
- **Proposal drafts:** a proposal and screening answers, written from your own context and
  goals.
- **Video proposals:** record your screen and camera, then paste a link that your client opens
  without an account.
- **An application tracker:** what you sent, and what happened.

There are no accounts and no plans. It runs on your machine or your own server. It uses your
database, your AI key, and your storage bucket.

> Independent project, not affiliated with or endorsed by Upwork. The extension reads a page
> only when you click it, and only the page you are on. It never browses, scrolls, clicks or
> submits anything for you.

## The three parts, and how they plug together

| Part | Folder | Runs on | What it does |
|---|---|---|---|
| **API** | `back` | Docker, on your machine or a server | Holds your data, the prompts and scoring, the AI key and the storage keys. Everything else only talks to it. |
| **Web app** | `front` | `pnpm dev` locally, or Vercel online | Your desk: Overview, Applications, Videos, your context, goals and proposal style, settings. Also serves the public video links. |
| **Extension** | `extension` | Chrome or Edge, loaded unpacked | Captures the Upwork page you're on when you click, and records videos. |

```
                       ┌──────────────── your AI provider (llmgateway.io, OpenAI, Ollama…)
                       │
 Extension ──HTTPS──▶  API  ──▶ Postgres
   │   (API token)     ▲  │
   │                   │  └──▶ presigned URLs for your bucket (R2)
   │ upload (presigned)│
   ▼                   │ server-side, with the API token
 Bucket  ◀──playback── Web app ◀── you (APP_PASSWORD)
                         ▲
                         └── your client opens /v/<slug>: public, no account
```

Each connection needs a setting on both ends:

| Connection | API side (`back/.env`) | Other side |
|---|---|---|
| Web app → API | `API_TOKEN` (online) | Web app: `API_URL`, `API_TOKEN` |
| Extension → API | `EXTENSION_ALLOWED_ORIGINS=chrome-extension://<id>`, plus `API_TOKEN` online | Extension Settings: API address and API token |
| API → AI provider | `AI_BASE_URL`, `AI_API_KEY` (required: the API won't start without a provider), plus `AI_MODEL` for providers other than llmgateway.io and OpenAI | the provider's dashboard |
| Extension → bucket (upload) | the four `VIDEO_STORAGE_*` keys | Bucket CORS allows `chrome-extension://<id>`, exposing `ETag` |
| Client → video link | `APP_URL` = the web app's public address | Web app: `APP_URL`, the same value |
| You → web app (online) | none | Web app: `APP_PASSWORD` |

## Run it on your machine

You need Docker, Node 24, pnpm 11, and a key from an AI provider.

**1. AI provider.** The API calls a real model from the first request; there is no sample mode.
[llmgateway.io](https://llmgateway.io) is recommended: one key reaches about 40 providers, and
the model console works out of the box. Ollama or LM Studio on your machine also work, without a
key. See [back/docs/AI-PROVIDER-SETUP.md](back/docs/AI-PROVIDER-SETUP.md).

**All three in one terminal.** From the repository root:

```bash
pnpm dev                            # or: node scripts/dev.mjs
```

On the first run it creates `back/.env` from its example and stops, so you can set `AI_API_KEY`.
Run it again and it installs what's missing, then starts:

- the API and its database in Docker, at `http://localhost:3002/health`;
- the web app, at `http://localhost:3000`;
- the extension in development mode. WXT opens a separate browser with the extension loaded, and
  reloads it as you edit. That browser has its own profile, so sign in to Upwork there. If its
  side panel says the API doesn't allow this extension, add the origin it shows to
  `EXTENSION_ALLOWED_ORIGINS` in `back/.env` (a comma-separated list), then restart `pnpm dev`.

Each line shows which part it comes from, and Ctrl+C stops all three. It works on macOS, Linux and
Windows, in any terminal. Steps 2 to 4 below do the same by hand. Step 4 is also how you install
the extension in your usual browser.

**2. API and database:**

```bash
cd back
cp .env.example .env                # set AI_API_KEY (and AI_BASE_URL if not llmgateway.io)
docker compose up -d --build        # http://localhost:3002/health
```

If the key or the provider is missing, the API refuses to start and names the setting to fix:
`docker compose logs api`.

**3. Web app:**

```bash
cd front
pnpm install
cp .env.example .env.local
pnpm dev                            # http://localhost:3000
```

Open `http://localhost:3000`, not `127.0.0.1:3000`. The Next.js dev server serves its scripts
only to the origin it started on, so pages half-load on the other one.

**4. Extension:**

```bash
cd extension
pnpm install
pnpm build
```

1. Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and pick
   `extension/.output/chrome-mv3`.
2. Pin the extension and open its side panel. It tries `http://localhost:3002` on its own.
3. If it says the API doesn't allow this extension yet:
   - copy the origin it shows into `EXTENSION_ALLOWED_ORIGINS` in `back/.env`;
   - then run `docker compose up -d` in `back`.

**5. Video proposals:** follow [back/docs/VIDEO-STORAGE-SETUP.md](back/docs/VIDEO-STORAGE-SETUP.md)
for a free Cloudflare R2 bucket. Locally, a share link points at `localhost`, which your client
cannot open: to send videos to clients, [put it online](#put-it-online).

The web app's **Settings → Connection** page shows whether each part is reachable, which model
each task uses, and what the extension needs.

## Put it online

The API goes in Docker on a small server, with automatic HTTPS. The web app goes on Vercel. The
extension then works from anywhere, and clients can open your video links.

Step by step: **[docs/DEPLOY.md](docs/DEPLOY.md)**.

## Security model

- **No accounts.** The API serves one user, you.
- **Locally, everything stays on your machine.**
  - The API listens on `127.0.0.1`.
  - It answers only requests addressed to `localhost`, which blocks malicious pages that try to
    reach it through DNS rebinding.
  - It answers only the web app and extension origins it lists.
- **Online:**
  - The API requires `API_TOKEN`. It refuses to listen beyond loopback without one.
  - The web app requires `APP_PASSWORD`.
  - The only public pages are your video links.
- **Secrets stay in the API.** The AI key, storage keys and database credentials are never sent
  to a browser. The web app's settings are all server-side; it has no `NEXT_PUBLIC_*` values.
  - **The one exception** is the extension's copy of your API token, which you enter in its
    settings. It's kept in extension storage, which no website can read.
- **The AI never owns your score.** The model returns criteria scores, and the API computes the
  final number from versioned weights. You can read and edit the prompts in Settings → Prompts.

## Developing

Each app has its own gates:

```bash
cd back      && pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd front     && pnpm lint && pnpm test && pnpm build
cd extension && pnpm compile && pnpm test && pnpm build
```

Tests never call a real AI provider or the network: they use fixtures, which nothing outside the
test suite can switch on.

## License

[AGPL-3.0](LICENSE). You can self-host it, change it and share it. If you run a modified
version as a service for other people, you must publish your changes.

Some code and files come from other open-source projects, under their own licenses: see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
