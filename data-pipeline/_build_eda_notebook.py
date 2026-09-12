"""One-off generator for notebooks/02_eda.ipynb. Not part of the pipeline —
run once, then delete (or re-run to regenerate if you want to tweak cells
from source instead of editing the notebook directly)."""

import nbformat as nbf

nb = nbf.v4.new_notebook()
cells = []

md = nbf.v4.new_markdown_cell
code = nbf.v4.new_code_cell

cells.append(md(
"# RoadSafe NZ — Exploratory Data Analysis\n"
"\n"
"Profiles the **cleaned** CAS dataset (after `clean_data.py`'s Null-string fix, "
"coordinate reprojection, and `is_severe` target) before we lean further on the "
"engineered features: how much is genuinely missing, whether there are duplicate "
"records, what the numeric outliers look like, and how severity is distributed "
"and trending over time."
))

cells.append(code(
"import pandas as pd\n"
"import numpy as np\n"
"import matplotlib.pyplot as plt\n"
"\n"
"pd.set_option(\"display.max_columns\", None)\n"
"plt.rcParams[\"figure.figsize\"] = (10, 5)"
))

cells.append(code(
"df = pd.read_csv(\"../data/processed/cas_crash_data_clean.csv\")\n"
"df.shape"
))

cells.append(md(
"## 1. Missing values\n"
"\n"
"This is the *true* missing picture — it only counts real `NaN`, now that the "
"disguised `\"Null\"` strings in `weatherA`/`weatherB`/`roadSurface`/`flatHill` "
"have been converted."
))

cells.append(code(
"missing = df.isna().sum().sort_values(ascending=False)\n"
"missing_pct = (missing / len(df) * 100).round(1)\n"
"missing_report = pd.DataFrame({\"missing_count\": missing, \"missing_pct\": missing_pct})\n"
"missing_report[missing_report[\"missing_count\"] > 0]"
))

cells.append(md(
"A block of columns (`bridge`, `cliffBank`, `debris`, `ditch`, `fence`, "
"`guardRail`, `houseOrBuilding`, `kerb`, `objectThrownOrDropped`, `otherObject`, "
"`overBank`, `parkedVehicle`, `phoneBoxEtc`, `postOrPole`, `roadworks`, "
"`slipOrFlood`, `strayAnimal`, `trafficIsland`, `trafficSign`, `train`, `tree`, "
"`vehicle`, `waterRiver`) are all missing for the exact same ~57% of rows. That's "
"not random sparsity — it's a schema change partway through CAS's history (these "
"roadside-object columns were only recorded from a certain year onward). Worth "
"confirming which `crashYear`s those come from before deciding how to handle them "
"in modeling, rather than assuming MCAR (missing completely at random) and just "
"imputing."
))

cells.append(code(
"# Confirm the schema-change theory: which years have `bridge` populated?\n"
"df.loc[df[\"bridge\"].notna(), \"crashYear\"].agg([\"min\", \"max\"])"
))

cells.append(code(
"top_missing = missing_report[missing_report[\"missing_count\"] > 0].head(20)\n"
"top_missing[\"missing_pct\"].plot(kind=\"barh\")\n"
"plt.gca().invert_yaxis()\n"
"plt.xlabel(\"% missing\")\n"
"plt.title(\"Top 20 columns by missing %\")\n"
"plt.tight_layout()\n"
"plt.show()"
))

cells.append(md(
"## 2. Duplicate records\n"
"\n"
"`OBJECTID` should be a unique crash identifier — if it isn't, that's a data "
"quality problem worth knowing about before we train anything on it."
))

cells.append(code(
"full_dupes = df.duplicated().sum()\n"
"id_dupes = df.duplicated(subset=[\"OBJECTID\"]).sum()\n"
"print(f\"Fully duplicated rows: {full_dupes}\")\n"
"print(f\"Duplicate OBJECTID values: {id_dupes}\")"
))

cells.append(md(
"## 3. Outliers in numeric fields\n"
"\n"
"Using the standard IQR rule (outside `Q1 - 1.5*IQR` to `Q3 + 1.5*IQR`) — but "
"treat the result as a prompt to look closer, not an automatic drop list. "
"`speedLimit` is a posted speed limit, not a sensor reading: low values like 2 "
"or 10 km/h are legitimate (carparks, shared zones), so IQR will flag real, "
"valid crashes as \"outliers\" here."
))

cells.append(code(
"def iqr_outlier_report(series, name):\n"
"    q1, q3 = series.quantile([0.25, 0.75])\n"
"    iqr = q3 - q1\n"
"    lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr\n"
"    outliers = series[(series < lower) | (series > upper)]\n"
"    pct = len(outliers) / series.notna().sum() * 100\n"
"    print(f\"{name}: IQR bounds=({lower:.1f}, {upper:.1f}), \"\n"
"          f\"outliers={len(outliers)} ({pct:.2f}%)\")\n"
"\n"
"iqr_outlier_report(df[\"speedLimit\"].dropna(), \"speedLimit\")\n"
"iqr_outlier_report(df[\"NumberOfLanes\"].dropna(), \"NumberOfLanes\")\n"
"iqr_outlier_report(df[\"fatalCount\"].dropna(), \"fatalCount\")\n"
"iqr_outlier_report(df[\"seriousInjuryCount\"].dropna(), \"seriousInjuryCount\")"
))

cells.append(md(
"## 4. Severity distribution\n"
"\n"
"The four raw `crashSeverity` categories, and the binary `is_severe` target "
"derived from them."
))

cells.append(code(
"fig, axes = plt.subplots(1, 2, figsize=(12, 5))\n"
"\n"
"df[\"crashSeverity\"].value_counts().plot(kind=\"bar\", ax=axes[0])\n"
"axes[0].set_title(\"crashSeverity (4 categories)\")\n"
"axes[0].tick_params(axis=\"x\", rotation=30)\n"
"\n"
"df[\"is_severe\"].value_counts().rename({True: \"Severe\", False: \"Not severe\"}).plot(\n"
"    kind=\"bar\", ax=axes[1], color=[\"#4C72B0\", \"#C44E52\"]\n"
")\n"
"axes[1].set_title(\"is_severe (binary target)\")\n"
"\n"
"plt.tight_layout()\n"
"plt.show()\n"
"\n"
"df[\"is_severe\"].value_counts(normalize=True)"
))

cells.append(md(
"## 5. Trends over time\n"
"\n"
f"⚠️ Today's date is 2026-09-07, so **`crashYear` 2026 is a partial year** — it "
"will show an artificially low crash count next to complete years. Excluding it "
"from the trend line (but keeping it in the table) avoids a misleading dip at "
"the end of the chart."
))

cells.append(code(
"yearly = df.groupby(\"crashYear\").agg(\n"
"    total_crashes=(\"OBJECTID\", \"count\"),\n"
"    severe_rate=(\"is_severe\", \"mean\"),\n"
")\n"
"yearly"
))

cells.append(code(
"complete_years = yearly.drop(index=2026)\n"
"\n"
"fig, ax1 = plt.subplots()\n"
"ax1.bar(complete_years.index, complete_years[\"total_crashes\"], color=\"#4C72B0\", alpha=0.6)\n"
"ax1.set_ylabel(\"Total crashes\", color=\"#4C72B0\")\n"
"ax1.set_xlabel(\"Crash year\")\n"
"\n"
"ax2 = ax1.twinx()\n"
"ax2.plot(complete_years.index, complete_years[\"severe_rate\"], color=\"#C44E52\", marker=\"o\")\n"
"ax2.set_ylabel(\"Severe rate\", color=\"#C44E52\")\n"
"\n"
"plt.title(\"Crashes per year vs. severe rate (2026 excluded — partial year)\")\n"
"plt.tight_layout()\n"
"plt.show()"
))

cells.append(md(
"## 6. Severity by weather and road surface\n"
"\n"
"A first look at whether the conditions we engineered features from actually "
"move the severity rate — a sanity check on Phase 3, run backwards."
))

cells.append(code(
"weather_severity = df.groupby(\"weatherA\")[\"is_severe\"].agg([\"mean\", \"count\"]).sort_values(\"mean\", ascending=False)\n"
"weather_severity"
))

cells.append(code(
"surface_severity = df.groupby(\"roadSurface\")[\"is_severe\"].agg([\"mean\", \"count\"]).sort_values(\"mean\", ascending=False)\n"
"surface_severity"
))

cells.append(md(
"## Takeaways\n"
"\n"
"- Fill in after running: note anything that should feed back into feature "
"engineering (e.g. a weather/surface category with a surprisingly high or low "
"severe rate, or a missingness pattern that needs a `_was_missing` indicator "
"rather than plain imputation)."
))

nb["cells"] = cells
with open("notebooks/02_eda.ipynb", "w", encoding="utf-8") as f:
    nbf.write(nb, f)

print("Wrote notebooks/02_eda.ipynb")
