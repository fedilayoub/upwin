# Deploy upwin online

This puts each part in place:

| Part | Where | Address |
|---|---|---|
| API and database | Docker, on a small server, with automatic HTTPS | `https://api.example.com` |
| Web app | Vercel | `https://upwin-you.vercel.app` |
| Extension | your browser | points at your API |
| Video links | the web app | `https://upwin-you.vercel.app/v/<slug>`, public, for your clients |

Do it in this order. Each step needs a value from the one before.

## What you need

- **A Linux server with Docker:** 2 GB of RAM and 1–2 vCPUs is plenty. The API uses `ffmpeg`
  briefly after each recording.
- **A domain** you can add DNS records to, for the API, e.g. `api.example.com`.
- **A Vercel account.** The free Hobby plan works.
- **An AI provider key.** [llmgateway.io](https://llmgateway.io) is recommended; see
  [AI-PROVIDER-SETUP](../back/docs/AI-PROVIDER-SETUP.md).
- **For video:** a Cloudflare R2 bucket. See
  [VIDEO-STORAGE-SETUP](../back/docs/VIDEO-STORAGE-SETUP.md).

## 1. DNS

Add an **A record** for `api.example.com` pointing at the server's IP address. Wait until
`dig +short api.example.com` returns that IP. HTTPS needs it.

## 2. API on the server

On the server:

```bash
git clone <your fork of this repository> upwin
cd upwin/back
cp .env.example .env
openssl rand -hex 32          # use as API_TOKEN
openssl rand -base64 24       # use as POSTGRES_PASSWORD
```

Edit `.env`:

```bash
API_TOKEN=<the hex value>                    # required online
POSTGRES_PASSWORD=<the base64 value>         # the database password; compose reads it here
APP_URL=https://upwin-you.vercel.app         # the web app's address (step 3); fix it later if needed
EXTENSION_ALLOWED_ORIGINS=chrome-extension://<id>   # step 4

AI_BASE_URL=https://api.llmgateway.io/v1
AI_API_KEY=<your key>

# Video (optional): set all four. See VIDEO-STORAGE-SETUP
VIDEO_STORAGE_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
VIDEO_STORAGE_BUCKET=upwin-videos
VIDEO_STORAGE_ACCESS_KEY_ID=<key id>
VIDEO_STORAGE_SECRET_ACCESS_KEY=<secret>
```

Leave `DATABASE_URL` as it is: compose sets it for the container.

Start it with HTTPS:

```bash
API_DOMAIN=api.example.com \
  docker compose -f docker-compose.yml -f docker-compose.online.yml up -d --build
```

Caddy gets the certificate on its own. Open ports **80** and **443** in the server's firewall;
nothing else needs to be public. Postgres and the API itself are not reachable from outside.

Check it:

```bash
curl https://api.example.com/health                                  # {"status":"ok"}
curl -H "Authorization: Bearer <API_TOKEN>" https://api.example.com/me   # the local user
curl https://api.example.com/me                                      # 401: no token, no data
```

## 3. Web app on Vercel

1. In Vercel, choose **Add New → Project** and import your fork of the repository.
2. Set **Root Directory** to `front`. The framework is detected as Next.js, and pnpm comes
   from the lockfile.
3. Under **Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `API_URL` | `https://api.example.com` |
   | `API_TOKEN` | the same value as the API's `API_TOKEN` |
   | `APP_PASSWORD` | a password only you know: `openssl rand -base64 24` |
   | `APP_URL` | the project's address, e.g. `https://upwin-you.vercel.app` |

4. Deploy, then open the address. You get the unlock page. Enter `APP_PASSWORD`.
5. If the final address differs from the `APP_URL` you put in the API's `.env`:
   - fix it there;
   - run the `docker compose … up -d` command from step 2 again.

   Share links are built from the API's `APP_URL`.

**Settings → Connection** should show the API **reachable**, the model each task uses, and the
app password **On**.

## 4. Extension

The extension runs in your browser; nothing is deployed for it.

1. On your computer, run `pnpm install && pnpm build` in `extension`.
2. Load `.output/chrome-mv3` unpacked from `chrome://extensions`, with Developer mode on.
3. Open the side panel. Fill in the connect screen, or **Settings → Connection** later:
   - **API address:** `https://api.example.com`;
   - **API token:** the API's `API_TOKEN`;
   - **Web app address:** `https://upwin-you.vercel.app`.
4. If it says the API doesn't allow this extension, allow the origin it shows:
   - put the origin in the API's `EXTENSION_ALLOWED_ORIGINS`;
   - add it to the bucket's CORS policy;
   - restart the API.

To use the same extension id on several computers, run `pnpm crx:keygen` once. Put
`WXT_CRX_PUBLIC_KEY` in `extension/.env.local` on each one before building.

## 5. Video links

Use the **deployed** CORS policy from
[VIDEO-STORAGE-SETUP, step 3](../back/docs/VIDEO-STORAGE-SETUP.md#3-cors-policy), with the
extension id that `pnpm crx:id` prints. The web app needs no CORS rule: playback works without one.

Record a test video, copy its link, and open it in a private window. That is exactly what a
client sees: no sign-in, no app, just your video.

## Keep it running

| Task | Command (on the server, in `back`) |
|---|---|
| Update | `git pull`, then the `docker compose … up -d --build` command from step 2 |
| Logs | `docker compose logs -f api` |
| Back up the database | `docker compose exec db pg_dump -U upwin upwin > upwin-$(date +%F).sql` |
| Rotate the API token | change `API_TOKEN` in `.env` and in Vercel, restart both, and update the extension's settings |

Changing `APP_PASSWORD` in Vercel signs every browser out of the web app. Your video links keep
working.
