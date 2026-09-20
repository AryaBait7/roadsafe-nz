# Running RoadSafe NZ — presentation runbook

## The URL you show

**http://localhost:3100**

That is the full application. It renders on the server and fetches its data
from the API deployed on AWS Lambda in Sydney, so what you are showing is the
real cloud path, not a local mock.

You can also show the deployed API directly in a browser tab — useful if you
are asked "is it actually on AWS?":

- https://b8cg0r0763.execute-api.ap-southeast-2.amazonaws.com/health
- https://b8cg0r0763.execute-api.ap-southeast-2.amazonaws.com/api/dashboard/totals

Code: https://github.com/AryaBait7/roadsafe-nz

## Starting it from cold (after a restart)

One terminal is enough, because the frontend reads the deployed API.

```bash
cd "C:/Users/Arya/Desktop/RoadSafe-NZ-Project/frontend"
npm run dev:3100
```

Wait for `Ready`, then open http://localhost:3100.

Use `npm run dev:3100`, not `npm run dev -- --port 3100`. PowerShell strips
the `--`, so the port arrives as a directory name and Next fails with
"Invalid project directory provided". The `dev:3100` script sidesteps that
and behaves the same in PowerShell, cmd and bash.

That is it. No local backend needed — `frontend/.env.local` points the app at
the deployed API.

## "EADDRINUSE: address already in use :::3100"

Something is already listening on 3100 — usually a dev server from an earlier
terminal you closed without stopping. Either open http://localhost:3100 and
use the one already running, or free the port:

```powershell
Get-NetTCPConnection -LocalPort 3100 -State Listen | Select-Object -Expand OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

Then start it again with `npm run dev:3100`.

Close a dev server properly with Ctrl+C in its terminal, and this will not
come up.

## Fallback: no internet, or AWS misbehaving

Run everything locally instead. Two terminals:

```bash
cd "C:/Users/Arya/Desktop/RoadSafe-NZ-Project/backend"
npm run dev
```

```bash
cd "C:/Users/Arya/Desktop/RoadSafe-NZ-Project/frontend"
Rename-Item .env.local .env.local.off
npm run dev:3100
```

Renaming `.env.local` makes the app fall back to `http://localhost:4000`.
(`Rename-Item` is PowerShell; in bash it is `mv .env.local .env.local.off`.)
Rename it back afterwards to return to the AWS API.

## Checking it is working before you present

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/dashboard
```

`200` means you are ready. Then click through:

1. Home — the intro drives to the billboard (about 4 seconds), then the hero
2. Scroll — the statistics count up, six cards, live NZTA updates
3. Explore dashboard — KPIs, severity donut, map
4. Apply a filter — Region: Waikato, years 2020–2024 → 19,383 crashes
5. Try Year from 2025 with Year to 2020 → inline validation, no request sent
6. Reset → back to 705,609

## If a page errors mid-demo

Reload it. The pages render per request, so a reload re-fetches. If the whole
site is erroring, the API is unreachable — switch to the local fallback above.

## Numbers you may be asked about

- 705,609 crashes, 2006–2026 (2026 is a partial year)
- 41,263 serious, 6,182 fatal, 6,911 killed, 280,236 injured
- Model: XGBoost, PR-AUC 0.152 on held-out 2022–2025, against 0.078 for
  random ranking
