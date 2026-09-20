# RoadSafe NZ

Road crash intelligence for New Zealand, built on Waka Kotahi's Crash
Analysis System (CAS) open data: 705,609 reported crashes, 2006–2026. It
covers where crashes happen, how severity has changed, and which conditions
are *associated with* serious outcomes. A crash-severity model (XGBoost) is
trained and evaluated on held-out years; every figure shown is measured, and
the app states the model's limits rather than overselling it.

## Status

- **Frontend: complete.** Nine pages (landing, dashboard, trends, map, hotspots,
  risk factors, ML insights, reports, data dictionary), all served by the API.
- **Data pipeline: reproducible** from a pinned download (Stage 17).
- **Analytics (Stage 19):** confidence intervals, small-area shrinkage, and
  crude vs adjusted associations.
- **Model (Stage 20):** XGBoost, PR-AUC 0.152 on 2022–2025 against 0.078 for
  random ranking.
- **Explainability (Stage 21):** SHAP contributions and a scenario explorer
  that shows how much evidence each combination actually has.
- **API (Stage 22–23):** Express + TypeScript, 23 routes. The frontend reads
  everything through it; aggregation lives in one place.
- **Live updates:** road-safety updates are read from the NZ Transport
  Agency's open data catalogue, normalised and cached by the API.
- **Deployed (Stage 24):** the API runs on AWS Lambda (ap-southeast-2) behind
  an API Gateway HTTP API — try
  [`/health`](https://b8cg0r0763.execute-api.ap-southeast-2.amazonaws.com/health)
  or [national
  totals](https://b8cg0r0763.execute-api.ap-southeast-2.amazonaws.com/api/dashboard/totals).
- **Blocked:** PostgreSQL + PostGIS (Stage 18) — Docker will not start here.
- **Planned:** frontend hosting, CI/CD and monitoring (Stages 24–27).

Details: [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md) · design:
[ARCHITECTURE.md](ARCHITECTURE.md) · reasoning: [DECISIONS.md](DECISIONS.md) ·
columns: [DATA_DICTIONARY.md](DATA_DICTIONARY.md)

## Stack

| Layer | Technology | State |
|---|---|---|
| Data pipeline | Python, pandas, pyproj, pytest | Built |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind v4, Recharts, Leaflet, Vitest | Built |
| Database | PostgreSQL + PostGIS | Planned |
| Analytics + ML | pandas, statsmodels, scikit-learn, XGBoost, SHAP | Built |
| API | Node.js / Express 5, TypeScript, supertest | Built |
| Cloud | AWS Lambda + API Gateway + S3 + CloudWatch (ap-southeast-2) | Deployed |
| Cloud (planned) | Amplify hosting, RDS, GitHub Actions | Planned |

## Structure

```
data-pipeline/
  src/              download → validate → clean → features → fixtures → dictionary
  tests/            pytest unit tests for the cleaning and validation rules
  data/raw/         downloaded CAS CSV + manifest.json (CSV gitignored)
  data/processed/   cleaned + feature CSVs, pipeline_run.json (gitignored)
  notebooks/        exploration and EDA
data/fixtures/      pipeline output, served by the API (committed, ~7.6MB)
frontend/           Next.js app; fetches everything from the API
backend/
  src/              routes, services, fixtures data source
  tests/            supertest API tests
```

## Running the data pipeline

The CAS CSV (~200MB) is not committed. The pipeline downloads it from
[Waka Kotahi's open data portal](https://opendata-nzta.opendata.arcgis.com/datasets/NZTA::crash-analysis-system-cas-data-1/)
and records a manifest (source, time, size, row count, SHA-256). No
credentials are needed. From `data-pipeline/`:

```bash
python -m venv venv
source venv/Scripts/activate   # Windows Git Bash; venv\Scripts\activate.bat for cmd.exe
pip install -r requirements.txt
python src/run_pipeline.py            # download if needed, then every step
python -m pytest                      # unit tests
```

`python src/run_pipeline.py --refresh` fetches the latest export. The run
record (`data/processed/pipeline_run.json`) shows which snapshot produced
the published figures.

## Running the API

From `backend/`:

```bash
npm install
npm run dev        # http://localhost:4000, /health lists available data
npm test
```

It reads the pipeline's aggregates (`FIXTURES_DIR`, default
`../data/fixtures`) until the Stage 18 database is available. See
`backend/.env.example` for `PORT` and `CORS_ORIGIN`.

`src/lambda.ts` wraps the same app for AWS Lambda, so the deployed API and
the local one are the same code and the same tests.

## Running the frontend

**Start the API first** — the pages fetch from it (`API_BASE_URL`, default
`http://localhost:4000`). To read the deployed API instead, put its URL in
`frontend/.env.local` and no backend is needed locally. From `frontend/`:

```bash
npm install
npm run dev -- --port 3100
npm test
```

## Roadmap

1–16. ✅ Frontend: shell, every page, responsive, motion, states, accessibility, tests
17. ✅ Reproducible CAS pipeline
18. ⏸️ PostgreSQL + PostGIS — blocked, Docker will not start
19. ✅ Analytics layer
20. ✅ Severity model (baseline → logistic regression → random forest → XGBoost)
21. ✅ Explainability (SHAP)
22. ✅ Node/Express REST API
23. ✅ Connect frontend to the API
24. 🟡 AWS deployment — API live on Lambda + API Gateway; frontend hosting to do
25–26. 🔲 CI/CD, security, monitoring, final testing
27. 🔲 Portfolio documentation

*RoadSafe NZ is a portfolio project, not an official NZTA service.*
