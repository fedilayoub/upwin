# upwin community — browser extension

WXT + React 19 + Tailwind 4. It works in Chrome and Edge 126 or newer. Firefox works too, but
without video.

It does two things:

- **Captures** the Upwork page you are on when you click: your profile, or a job post. It sends
  a structured snapshot, never HTML, to your upwin API, and shows the analysis, the job match
  and the proposal draft.
- **Records** video proposals: screen, window or tab, plus an optional camera bubble with
  on-device background blur. It uploads them straight to your bucket.

It holds no AI key, prompt or scoring. All of that is in the API.

## Install

```bash
pnpm install
pnpm build                  # .output/chrome-mv3
```

1. Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and pick
   `.output/chrome-mv3`.
2. Open the side panel. It tries `http://localhost:3002` first.
3. If that doesn't work, the connect screen asks for:
   - **API address:** your API, e.g. `https://api.example.com`;
   - **API token:** the API's `API_TOKEN`, if it has one;
   - **Web app address:** for links to your context and goals.

   You can change all three later in **Settings → Connection**.
4. If the API says it doesn't allow this extension, copy the origin the screen shows into the
   API's `EXTENSION_ALLOWED_ORIGINS`, then restart the API.

`pnpm dev` runs a development build in a fresh Chrome profile with live reload. `pnpm dev:edge`
does the same in Edge.

## A fixed extension id

An unpacked extension's id comes from its folder path. To keep the same id, and therefore the
same origin, across machines and reinstalls:

```bash
pnpm crx:keygen   # writes .crx-key.pem (gitignored) and prints the two lines to copy
```

Put `WXT_CRX_PUBLIC_KEY` in `.env.local`, then rebuild. `pnpm crx:id` prints the id for a key.

## Permissions, and why

| Permission | Why |
|---|---|
| `activeTab`, `scripting` | Read the page you are on, once, after you click. |
| `storage` | Your connection settings, preferences and the local error log. |
| `sidePanel` | The side panel UI. |
| `offscreen` | The recorder runs in an offscreen document so recording survives closing the panel. |
| `tabCapture` (optional) | Asked the first time you record "this tab" in one click. |

The content script runs on `upwork.com` for the on-page Analyze shortcut. It reads the page only
when you use it.

There are **no host permissions** and **no `cookies` permission**:
- The extension calls only your API, which allows its origin through CORS.
- It uploads only to your bucket, with presigned URLs.

## Gates

```bash
pnpm compile && pnpm test && pnpm build
```

DOM parser tests run on sanitized, hand-trimmed fixtures in `features/upwork/*/__fixtures__`.
Never commit a real captured page.

## License

AGPL-3.0-only.
