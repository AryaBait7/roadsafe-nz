import { PageHeader } from "@/components/layout/PageHeader";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { BarList } from "@/components/charts/BarList";
import { DataTable } from "@/components/charts/DataTable";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Badge, PlaceholderBadge } from "@/components/ui/Badge";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { DIVERGING, SEVERITY_COLORS } from "@/lib/chart-theme";
import {
  getFeatureImportance,
  getModelMetrics,
  getTrainingDataProfile,
} from "@/services/mlService";

export const metadata = { title: "ML Insights" };

const CANDIDATE_MODELS = [
  {
    name: "Logistic regression",
    role: "Baseline",
    why: "Interpretable coefficients and a floor every other model has to beat.",
  },
  {
    name: "Random forest",
    role: "Challenger",
    why: "Captures interactions such as speed limit × road surface without hand-built terms.",
  },
  {
    name: "XGBoost",
    role: "Challenger",
    why: "Usually strongest on tabular data, and pairs well with SHAP explanations.",
  },
];

const METRICS = [
  { name: "Precision", note: "Of crashes flagged severe, how many were" },
  { name: "Recall", note: "Of severe crashes, how many were caught" },
  { name: "F1", note: "Balance of precision and recall" },
  { name: "ROC-AUC", note: "Ranking quality across all thresholds" },
  { name: "PR-AUC", note: "Ranking quality where positives are rare" },
];

export default async function MlInsightsPage() {
  const [profile, metrics, importance] = await Promise.all([
    getTrainingDataProfile(),
    getModelMetrics(),
    getFeatureImportance(),
  ]);

  const data = profile.data;
  const modelExists = metrics.data !== null;
  const prevalence = data.prevalence;

  // Reference points, not model results: these follow arithmetically from
  // the class balance and are the bar any trained model has to clear.
  const references = [
    {
      name: "Always predict “not severe”",
      accuracy: 1 - prevalence,
      recall: 0,
      prAuc: null as number | null,
      note: "Looks excellent on accuracy and catches no severe crash at all.",
    },
    {
      name: "Random guessing",
      accuracy: null as number | null,
      recall: null as number | null,
      prAuc: prevalence,
      note: "PR-AUC equals the positive rate; ROC-AUC is 0.5.",
    },
  ];

  return (
    <>
      <PageHeader
        title="ML Insights"
        description="The crash-severity model: what it is for, the data behind it, and how it will be judged."
        actions={modelExists ? null : <PlaceholderBadge title="No model trained yet" />}
      />

      <div className="space-y-3 p-4">
        <Card className="border-safety-500/40 bg-safety-400/5">
          <CardBody className="grid gap-3 text-[11px] leading-relaxed text-surface-700 md:grid-cols-2">
            <p>
              <span className="font-semibold text-navy-900">
                No model has been trained yet.
              </span>{" "}
              Training and evaluation are scheduled for Stage 20. Everything
              below marked as a placeholder is layout only — no performance
              figure on this page comes from a model, because a made-up score
              cannot be told apart from a measured one.
            </p>
            <p>
              <span className="font-semibold text-navy-900">
                What the model will and will not do.
              </span>{" "}
              It will estimate how severe a crash is likely to be{" "}
              <em>given that a crash has occurred</em>. It cannot predict whether
              a crash will happen: CAS contains only crashes, so it has no
              examples of trips where nothing went wrong. The dashboard filters
              do not apply here — the model is trained once on the full dataset.
            </p>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <Card className="xl:col-span-4">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Prediction target</CardTitle>
                <CardDescription>
                  <code>{data.target}</code> — {data.positiveLabel.toLowerCase()}
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-[26px] leading-none font-semibold text-navy-900">
                {formatPercent(prevalence, 2)}
              </p>
              <p className="text-[11px] text-surface-500">
                {formatNumber(data.positiveRows)} of{" "}
                {formatNumber(data.totalRows)} crashes are serious or fatal.
              </p>
              <div
                className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[4px]"
                role="img"
                aria-label={`${formatPercent(prevalence, 2)} serious or fatal, ${formatPercent(1 - prevalence, 2)} minor or non-injury`}
              >
                <span
                  style={{
                    width: `${prevalence * 100}%`,
                    backgroundColor: SEVERITY_COLORS["Serious Crash"],
                  }}
                />
                <span
                  className="flex-1"
                  style={{ backgroundColor: SEVERITY_COLORS["Non-Injury Crash"] }}
                />
              </div>
              <p className="text-[11px] leading-relaxed text-surface-500">
                The classes are heavily imbalanced, which rules out accuracy as
                a measure of success and shapes how the model is trained.
              </p>
            </CardBody>
          </Card>

          <ChartPanel
            className="xl:col-span-8"
            title="Why accuracy is the wrong measure"
            description="Reference points that follow from the class balance alone. Not model results — the bar a trained model has to beat."
            chart={
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-surface-200 text-left text-surface-500">
                      <th className="py-1.5 font-medium">Reference</th>
                      <th className="py-1.5 text-right font-medium">Accuracy</th>
                      <th className="py-1.5 text-right font-medium">Recall</th>
                      <th className="py-1.5 text-right font-medium">PR-AUC</th>
                      <th className="py-1.5 pl-4 font-medium">What it shows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {references.map((ref) => (
                      <tr key={ref.name} className="border-b border-surface-100 last:border-0">
                        <td className="py-2 font-medium text-navy-900">{ref.name}</td>
                        <td className="tabular py-2 text-right">
                          {ref.accuracy === null ? "—" : formatPercent(ref.accuracy)}
                        </td>
                        <td className="tabular py-2 text-right">
                          {ref.recall === null ? "—" : formatPercent(ref.recall)}
                        </td>
                        <td className="tabular py-2 text-right">
                          {ref.prAuc === null ? "—" : ref.prAuc.toFixed(3)}
                        </td>
                        <td className="py-2 pl-4 text-surface-500">{ref.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          />

          <ChartPanel
            className="xl:col-span-7"
            title="Planned chronological split"
            description={`Train on the past, test on the most recent complete years.${data.heldOutYear ? ` ${data.heldOutYear} is held out as a partial year.` : ""} Row counts are real; no model has used them yet.`}
            chart={
              <div className="space-y-3">
                <BarList
                  valueLabel="rows"
                  data={data.splits.map((split) => ({
                    label: `${split.name} · ${split.yearFrom}–${split.yearTo}`,
                    value: split.rows,
                    rate: split.severeRate,
                  }))}
                />
                <p className="text-[11px] leading-relaxed text-surface-500">
                  The severe share rises from{" "}
                  <span className="font-medium text-navy-900">
                    {formatPercent(data.splits[0].severeRate)}
                  </span>{" "}
                  in training to{" "}
                  <span className="font-medium text-navy-900">
                    {formatPercent(data.splits[data.splits.length - 1].severeRate)}
                  </span>{" "}
                  in the test years. A random split would mix that shift into
                  training and make the test score look better than the model
                  would perform on new crashes.
                </p>
              </div>
            }
            table={
              <DataTable
                caption="Planned train, validation and test split"
                rows={data.splits}
                columns={[
                  { header: "Split", cell: (row) => row.name },
                  { header: "Years", cell: (row) => `${row.yearFrom}–${row.yearTo}` },
                  { header: "Rows", numeric: true, cell: (row) => formatNumber(row.rows) },
                  { header: "Severe", numeric: true, cell: (row) => formatNumber(row.severeRows) },
                  { header: "Rate", numeric: true, cell: (row) => formatPercent(row.severeRate) },
                ]}
              />
            }
          />

          <Card className="xl:col-span-5">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Candidate models</CardTitle>
                <CardDescription>Compared on the same split and metrics.</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <ul className="space-y-2.5">
                {CANDIDATE_MODELS.map((model) => (
                  <li key={model.name} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-navy-900">
                        {model.name}{" "}
                        <span className="font-normal text-surface-400">· {model.role}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-surface-500">{model.why}</p>
                    </div>
                    <Badge tone="neutral" className="shrink-0 whitespace-nowrap">
                      Not trained
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card className="xl:col-span-7">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Model performance</CardTitle>
                <CardDescription>Measured on the test years once a model exists.</CardDescription>
              </div>
              <PlaceholderBadge />
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {METRICS.map((metric) => (
                  <div key={metric.name} className="rounded-md border border-dashed border-surface-300 p-2.5">
                    <p className="text-[10px] text-surface-500">{metric.name}</p>
                    <p className="mt-1 text-xl font-semibold text-surface-300">—</p>
                    <p className="mt-1 text-[10px] leading-snug text-surface-400">{metric.note}</p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card className="xl:col-span-5">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Confusion matrix</CardTitle>
                <CardDescription>Test-set predictions against actual outcomes.</CardDescription>
              </div>
              <PlaceholderBadge />
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 text-[10px]">
                <span />
                <span className="text-center text-surface-500">Predicted severe</span>
                <span className="text-center text-surface-500">Predicted not</span>
                {[
                  ["Actually severe", "True positive", "False negative"],
                  ["Actually not", "False positive", "True negative"],
                ].map(([rowLabel, a, b]) => (
                  <div key={rowLabel} className="contents">
                    <span className="self-center pr-1 text-right text-surface-500">{rowLabel}</span>
                    {[a, b].map((cell) => (
                      <span
                        key={cell}
                        className="grid h-14 place-items-center rounded-md border border-dashed border-surface-300 text-center text-surface-400"
                      >
                        <span>
                          <span className="block text-base font-semibold text-surface-300">—</span>
                          {cell}
                        </span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-[10px] leading-snug text-surface-400">
                False negatives — severe crashes the model misses — are the
                costliest error here, which is why recall is weighted heavily.
              </p>
            </CardBody>
          </Card>

          <Card className="xl:col-span-6">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Feature importance and SHAP</CardTitle>
                <CardDescription>Which inputs move the prediction, and in which direction.</CardDescription>
              </div>
              {importance.data === null ? <PlaceholderBadge /> : null}
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-[11px] leading-relaxed text-surface-500">
                Once trained, SHAP values will show each feature&rsquo;s push
                toward or away from a severe prediction —{" "}
                <span style={{ color: DIVERGING.above }}>toward</span> and{" "}
                <span style={{ color: DIVERGING.below }}>away</span> — rather
                than a single unsigned importance score. Until then, these are
                the inputs under consideration:
              </p>
              <ul className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                {data.candidateFeatures.map((feature) => (
                  <li key={feature.name} className="text-[11px]">
                    <span className="font-medium text-navy-900">{feature.name}</span>
                    <span className="block text-[10px] text-surface-400">{feature.description}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card className="xl:col-span-6">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Excluded to prevent leakage</CardTitle>
                <CardDescription>Columns that encode the answer, so they can never be inputs.</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <ul className="space-y-2">
                {data.leakageExcluded.map((field) => (
                  <li key={field.name} className="flex items-baseline justify-between gap-3 text-[11px]">
                    <code className="shrink-0 text-navy-900">{field.name}</code>
                    <span className="text-right text-surface-500">{field.reason}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[10px] leading-snug text-surface-400">
                A model given these would score near-perfectly in testing and be
                useless in practice, since none of them is known before the
                outcome is.
              </p>
            </CardBody>
          </Card>

          <Card className="xl:col-span-12">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Scenario explorer</CardTitle>
                <CardDescription>
                  Set road and environment conditions and see the estimated
                  chance that a crash under them would be serious or fatal.
                </CardDescription>
              </div>
              <PlaceholderBadge />
            </CardHeader>
            <CardBody className="text-[11px] leading-relaxed text-surface-500">
              Available once a model is trained. It will describe severity for a
              crash that has already happened under the chosen conditions — it
              will not say how likely a crash is on a given road.
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
