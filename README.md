# RoadSafe NZ

Road crash risk analytics for New Zealand: predicts crash severity risk from
road, weather, and location conditions using NZTA's Crash Analysis System
(CAS) dataset, and visualizes risk hotspots and trends on a dashboard.

## Stack

- **Data pipeline / ML**: Python (pandas, scikit-learn)
- **Database**: PostgreSQL + PostGIS
- **Backend API**: Node.js / Express
- **Frontend**: Next.js (TypeScript)
- **Cloud**: AWS (S3, Lambda, RDS, API Gateway, Amplify), GitHub Actions

## Structure

```
data-pipeline/   Python: cleaning, feature engineering, ML training
  data/raw/         raw CAS CSV (gitignored — see below)
  data/processed/   cleaned + feature-engineered CSVs (gitignored)
  notebooks/        exploratory analysis
  src/              cleaning / feature engineering / training scripts
backend/         Node.js/Express API (not yet built)
frontend/        Next.js dashboard (not yet built)
```

## Getting the dataset

The raw CSV (~191MB, 705,609 rows) is not committed — GitHub blocks files
over 100MB without Git LFS, and a dataset this size doesn't belong in git
history regardless. Download it from
[Waka Kotahi's open data portal](https://opendata-nzta.opendata.arcgis.com/)
(search "Crash Analysis System (CAS) data") and place it at:

```
data-pipeline/data/raw/cas_crash_data.csv
```

Then, from `data-pipeline/`:

```bash
python -m venv venv
source venv/Scripts/activate   # Windows Git Bash; use venv\Scripts\activate.bat for cmd.exe
pip install -r requirements.txt
python src/clean_data.py
python src/feature_engineering.py
```

See [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md) for detailed status, [DECISIONS.md](DECISIONS.md) for the reasoning behind key choices, and [DATA_DICTIONARY.md](DATA_DICTIONARY.md) for the full column reference.

## Roadmap

1. ✅ Dataset & problem definition
2. ✅ Data cleaning & EDA (missing values, duplicates, outliers, trends)
3. ✅ Feature engineering
4. 🔲 SQL & geospatial database (PostgreSQL + PostGIS)
5. 🔲 Analytics layer
6. 🔲 Machine learning (baseline → logistic regression → random forest → XGBoost)
7. 🔲 Model explainability (SHAP)
8. 🔲 Backend API
9. 🔲 Frontend dashboard
10. 🔲 AWS deployment
11. 🔲 DevOps & monitoring
12. 🔲 Portfolio polish
