# Video storage setup (Cloudflare R2)

Video proposals let you record your screen and camera from the extension, then paste a link into
a proposal. The client opens `<your web app>/<lang>/v/<slug>` and watches it, without an
account.

> **Send client videos from an online install.** On your machine, a share link points at
> `localhost`, which your client cannot open: local recording is for trying the feature. Put the
> API and web app online first ([docs/DEPLOY.md](../../docs/DEPLOY.md)), so every link works.

Recordings live in **your own** S3-compatible bucket. The guide uses Cloudflare R2, because its
free tier covers most freelancers and its egress is free. Any S3-compatible store works; see the
end of this guide.

The bucket stays private. The extension uploads with short-lived presigned URLs, and the share
page plays from them. Your storage keys never leave the API.

## 1. Before you start

- You need a Cloudflare account. The free plan is fine.
- R2 asks for a payment method before it can be enabled, even inside the free tier. Within the
  free tier the bill is $0.
  - **Storage:** 10 GB-month of Standard storage.
  - **Operations:** 1 M Class A and 10 M Class B operations a month.
  - **Egress:** always free.
- Use the **Standard** storage class. Infrequent Access has no free tier and charges for
  retrieval.

## 2. Create the bucket

1. In the Cloudflare dashboard, go to **R2 Object Storage**, then **Create bucket**.
2. Fill in the bucket settings:
   - **Name:** for example `upwin-videos`.
   - **Location:** Automatic, or the region nearest most of your clients.
   - **Default storage class:** Standard.
3. Open the bucket's **Settings**, then **Public access**:
   - **Public Development URL (r2.dev):** leave it disabled.
   - **Custom domains:** add none.

## 3. CORS policy

Only the extension talks to the bucket from a browser. It uploads each part of a recording with a
`PUT` to a presigned URL, then reads the part's `ETag` header. So the bucket must allow the
extension's origin, and expose `ETag`.

Playback needs no rule. The share page and the web app use a plain `<video>` and poster image,
which browsers load without CORS.

### Find your extension's origin

The origin is `chrome-extension://<id>`. The extension shows it, with a copy button, whenever the
API refuses it. The id is also on `chrome://extensions` (or `edge://extensions`).

The id depends on how you load the extension:

| How you load it | Its id |
|---|---|
| `pnpm dev`, here or at the repository root | WXT loads `extension/.output/chrome-mv3-dev`. The id comes from that folder's path. |
| `pnpm build`, then **Load unpacked** | Comes from the path of `extension/.output/chrome-mv3`, so it differs from the `pnpm dev` id. |
| Either one, with `WXT_CRX_PUBLIC_KEY` set | One id for both commands, in Chrome and Edge, on every computer. `pnpm crx:id` prints it. |
| Published to the Chrome Web Store | The id on its store page. |

Without a pinned key, moving or recloning the folder changes the id. Run `pnpm crx:keygen` once
to pin one.

The API checks the same origins: list them in its `EXTENSION_ALLOWED_ORIGINS` too, separated by
commas. An origin missing from either list fails, at the API or at the upload.

### Paste the policy

In the bucket, open **Settings**, then **CORS policy**, then **Add CORS policy**. Paste the
policy for your case, with your ids.

**On your machine,** with an unpinned id: list the `pnpm dev` and the `pnpm build` ids, so both
ways of running the extension can upload.

```json
[
  {
    "AllowedOrigins": [
      "chrome-extension://<ID_FROM_PNPM_DEV>",
      "chrome-extension://<ID_FROM_PNPM_BUILD>"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

**Deployed,** with the extension built from a pinned key on each computer (see
[docs/DEPLOY.md](../../docs/DEPLOY.md)): one origin covers every computer and browser. Add the
store id too if you publish it.

```json
[
  {
    "AllowedOrigins": ["chrome-extension://<ID_FROM_PNPM_CRX_ID>"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

If one bucket serves both, put every origin in the one `AllowedOrigins` list.

- **`ExposeHeaders: ["ETag"]` is mandatory.** Without it, the extension cannot read the receipt
  of each uploaded part.
- **Origins must match exactly:** `chrome-extension://` and the 32-letter id, with no trailing
  slash.

### If an upload fails

| What you see | Cause | Fix |
|---|---|---|
| The error `UPLOAD_CORS`: "Your bucket is not exposing the ETag header" | The origin is allowed, but `ETag` is not exposed. | Add `"ExposeHeaders": ["ETag"]`. |
| The recorder shows **Reconnecting…** and never finishes, although you're online | The bucket refuses this extension's origin. The browser reports that as a network error, so the extension keeps retrying. | Add the origin the extension shows to `AllowedOrigins`. After switching between `pnpm dev` and `pnpm build`, both ids must be listed. |

To see the refusal itself, open `chrome://extensions`, then the extension's **Details**, then
**Inspect views: offscreen-recorder.html** while it records. Its console says "blocked by CORS
policy" and names the origin it used.

## 4. Lifecycle rule

Open **Settings**, then **Object lifecycle rules**.

1. **Abort incomplete multipart uploads** after 2 days. R2 ships a rule like this; just keep it.
   It is a safety net, because the API already aborts uploads that are still unfinished after
   24 hours.
2. **No object-expiry rule.** A video stays shareable until you delete it, and deleting it in
   the app removes its files from the bucket.

## 5. API token

1. Go to **R2 Object Storage**, then **Manage R2 API Tokens**, then **Create API token**.
2. Fill in the token settings:
   - **Permissions:** Object Read & Write.
   - **Specify bucket(s):** only your video bucket.
3. Copy the three values. The secret is shown only once.
   - the Access Key ID;
   - the Secret Access Key;
   - the S3 endpoint, `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

## 6. Turn video on in the API

Add these four to the API's `.env`, then restart the API. Video is on once all four are set:

```bash
VIDEO_STORAGE_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
VIDEO_STORAGE_BUCKET=upwin-videos
VIDEO_STORAGE_ACCESS_KEY_ID=<access key id>
VIDEO_STORAGE_SECRET_ACCESS_KEY=<secret>
```

- **Docker.** The image ships `ffmpeg` and `ffprobe`, which turn a recording into a playable file
  and a poster.
- **Without Docker,** install them yourself and keep them on `PATH`, for example
  `brew install ffmpeg` or `apt install ffmpeg`.
- **They're checked at boot.** When video is on, the API checks both binaries at startup and
  refuses to start without them.

**Share links point at the API's `APP_URL`.** Set it to your web app's public address, for
example `https://upwin-yourname.vercel.app`. Otherwise clients get a `localhost` link. Both the
API and the web app need the same value.

A recording can be up to 20 minutes long. There is no total storage cap: the web app's
**Videos** page shows how much you use, so you can stay inside R2's 10 GB free tier.

## 7. Check it

1. **Web app.** **Videos** shows your storage and "Kept until you delete".
2. **Extension.** Open a job post, draft a proposal in the **Draft** tab, and choose **Record a
   video for this job**. Pick a window, record a few seconds, and stop. The **Video** tab also
   records without a job.
3. **Library.** The video appears, first as processing, then ready. Copy its link and open it in
   a private window: that is what your client sees.

If the upload fails, or keeps showing **Reconnecting…**, see the table at the end of step 3.

## Other S3-compatible storage

| Store | Endpoint | Notes |
|---|---|---|
| AWS S3 | `https://s3.<region>.amazonaws.com` | Set `VIDEO_STORAGE_REGION` to the bucket's region. |
| MinIO | `http://localhost:9000` | Set `VIDEO_STORAGE_FORCE_PATH_STYLE=true`. Plain HTTP is allowed only for `localhost`. Uploads and playback must reach the same address from the browser. |
| Backblaze B2, Wasabi | the S3 endpoint from their dashboard | Same CORS rules as above. |
