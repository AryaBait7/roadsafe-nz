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
import type { CalibrationBin } from "@/types";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { DIVERGING, SEVERITY_COLORS } from "@/lib/chart-theme";
import {
  getFeatureImportance,
  getModelMetrics,
  getScenarios,
  getShapSummary,
  getTrainingDataProfile,
} from "@/services/mlService";
import { ScenarioExplorer } from "@/features/ml/ScenarioExplorer";

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
  const [profile, metrics, importance, explanation, scenarios] =
    await Promise.all([
      getTrainingDataProfile(),
      getModelMetrics(),
      getFeatureImportance(),
      getShapSummary(),
      getScenarios(),
    ]);
  const shap = explanation.data;

  const data = profile.data;
  const trained = metrics.data;
  const modelExists = trained !== null;
  const prevalence = data.prevalence;
  // From the split profile, so the calibration note cites measured rates.
  const trainSevereRate =
    data.splits.find((split) => split.name === "Train")?.severeRate ?? 0;

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
        actions={
          modelExists ? null : <PlaceholderBadge title="No model trained yet" />
        }
      />

      <div className="space-y-3 p-4">
        <Card className="border-safety-500/40 bg-safety-400/5">
          <CardBody className="grid gap-3 text-[11px] leading-relaxed text-surface-700 md:grid-cols-2">
            <p>
              {trained ? (
                <>
                  <span className="font-semibold text-navy-900">
                    {trained.modelName}, trained on {trained.trainYears[0]}–
                    {trained.trainYears[1]}.
                  </span>{" "}
                  Candidates were compared on {trained.validationYears[0]}–
                  {trained.validationYears[1]}, and the winner was scored once
                  on {trained.testYears[0]}–{trained.testYears[1]}, which it
                  never saw during training or model choice. Every figure below
                  is measured on those test years.
                </>
              ) : (
                <>
                  <span className="font-semibold text-navy-900">
                    No model has been trained yet.
                  </span>{" "}
                  Everything below marked as a placeholder is layout only — no
                  performance figure on this page comes from a model, because a
                  made-up score cannot be told apart from a measured one.
                </>
              )}
            </p>
            <p>
              <span className="font-semibold text-navy-900">
                What the model will and will not do.
              </span>{" "}
              It estimates how severe a crash is likely to be{" "}
              <em>given that a crash has occurred</em>. It cannot predict
              whether a crash will happen: CAS contains only crashes, so it has
              no examples of trips where nothing went wrong. The dashboard
              filters do not apply here — the model is trained once on the full
              dataset.
            </p>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <Card className="xl:col-span-4">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Prediction target</CardTitle>
                <CardDescription>
                  <code>{data.target}</code> —{" "}
                  {data.positiveLabel.toLowerCase()}
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
                  style={{
                    backgroundColor: SEVERITY_COLORS["Non-Injury Crash"],
                  }}
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
                      <th className="py-1.5 text-right font-medium">
                        Accuracy
                      </th>
                      <th className="py-1.5 text-right font-medium">Recall</th>
                      <th className="py-1.5 text-right font-medium">PR-AUC</th>
                      <th className="py-1.5 pl-4 font-medium">What it shows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {references.map((ref) => (
                      <tr
                        key={ref.name}
                        className="border-b border-surface-100 last:border-0"
                      >
                        <td className="py-2 font-medium text-navy-900">
                          {ref.name}
                        </td>
                        <td className="tabular py-2 text-right">
                          {ref.accuracy === null
                            ? "—"
                            : formatPercent(ref.accuracy)}
                        </td>
                        <td className="tabular py-2 text-right">
                          {ref.recall === null
                            ? "—"
                            : formatPercent(ref.recall)}
                        </td>
                        <td className="tabular py-2 text-right">
                          {ref.prAuc === null ? "—" : ref.prAuc.toFixed(3)}
                        </td>
                        <td className="py-2 pl-4 text-surface-500">
                          {ref.note}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          />

          <ChartPanel
            className="xl:col-span-7"
            title="Chronological split"
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
                    {formatPercent(
                      data.splits[data.splits.length - 1].severeRate,
                    )}
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
                  {
                    header: "Years",
                    cell: (row) => `${row.yearFrom}–${row.yearTo}`,
                  },
                  {
                    header: "Rows",
                    numeric: true,
                    cell: (row) => formatNumber(row.rows),
                  },
                  {
                    header: "Severe",
                    numeric: true,
                    cell: (row) => formatNumber(row.severeRows),
                  },
                  {
                    header: "Rate",
                    numeric: true,
                    cell: (row) => formatPercent(row.severeRate),
                  },
                ]}
              />
            }
          />

          <Card className="xl:col-span-5">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Candidate models</CardTitle>
                <CardDescription>
                  Compared on the same split and metrics.
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <ul className="space-y-2.5">
                {CANDIDATE_MODELS.map((model) => (
                  <li
                    key={model.name}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-navy-900">
                        {model.name}{" "}
                        <span className="font-normal text-surface-500">
                          · {model.role}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-surface-500">
                        {model.why}
                      </p>
                    </div>
                    <Badge
                      tone={
                        trained?.modelName === model.name ? "info" : "neutral"
                      }
                      className="shrink-0 whitespace-nowrap"
                    >
                      {!trained
                        ? "Not trained"
                        : trained.modelName === model.name
                          ? "Chosen"
                          : "Trained"}
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
                <CardDescription>
                  {trained
                    ? `${trained.testYears[0]}–${trained.testYears[1]}, ${formatNumber(trained.testRows)} crashes, scored once at a threshold of ${trained.threshold.toFixed(3)}.`
                    : "Measured on the test years once a model exists."}
                </CardDescription>
              </div>
              {trained ? null : <PlaceholderBadge />}
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {METRICS.map((metric) => {
                  const value = trained
                    ? {
                        Precision: trained.precision,
                        Recall: trained.recall,
                        F1: trained.f1,
                        "ROC-AUC": trained.rocAuc,
                        "PR-AUC": trained.prAuc,
                      }[metric.name]
                    : undefined;

                  return (
                    <div
                      key={metric.name}
                      className={
                        trained
                          ? "rounded-md border border-surface-200 p-2.5"
                          : "rounded-md border border-dashed border-surface-300 p-2.5"
                      }
                    >
                      <p className="text-[10px] text-surface-500">
                        {metric.name}
                      </p>
                      <p
                        className={
                          value === undefined
                            ? "mt-1 text-xl font-semibold text-surface-300"
                            : "tabular mt-1 text-xl font-semibold text-navy-900"
                        }
                      >
                        {value === undefined ? "—" : value.toFixed(3)}
                      </p>
                      <p className="mt-1 text-[10px] leading-snug text-surface-500">
                        {metric.note}
                      </p>
                    </div>
                  );
                })}
              </div>

              {trained ? (
                <div className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-surface-600">
                  <p>
                    <span className="font-medium text-navy-900">
                      Against the references.
                    </span>{" "}
                    PR-AUC {trained.prAuc.toFixed(3)} against{" "}
                    {trained.references.randomPrAuc.toFixed(3)} for random
                    ranking —{" "}
                    {(trained.prAuc / trained.references.randomPrAuc).toFixed(
                      1,
                    )}
                    × better. Accuracy {formatPercent(trained.accuracy, 1)}{" "}
                    against{" "}
                    {formatPercent(
                      trained.references.alwaysNotSevereAccuracy,
                      1,
                    )}{" "}
                    for always predicting &ldquo;not severe&rdquo;, which is why
                    accuracy is the least useful number here.
                  </p>
                  <p>
                    <span className="font-medium text-navy-900">
                      Threshold.
                    </span>{" "}
                    {trained.thresholdRule} Moving it trades recall against
                    precision; nothing about the model changes.
                  </p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card className="xl:col-span-5">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Confusion matrix</CardTitle>
                <CardDescription>
                  {trained
                    ? `${trained.testYears[0]}–${trained.testYears[1]} predictions against what happened.`
                    : "Test-set predictions against actual outcomes."}
                </CardDescription>
              </div>
              {trained ? null : <PlaceholderBadge />}
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 text-[10px]">
                <span />
                <span className="text-center text-surface-500">
                  Predicted severe
                </span>
                <span className="text-center text-surface-500">
                  Predicted not
                </span>
                {(
                  [
                    [
                      "Actually severe",
                      ["True positive", trained?.confusionMatrix.truePositive],
                      [
                        "False negative",
                        trained?.confusionMatrix.falseNegative,
                      ],
                    ],
                    [
                      "Actually not",
                      [
                        "False positive",
                        trained?.confusionMatrix.falsePositive,
                      ],
                      ["True negative", trained?.confusionMatrix.trueNegative],
                    ],
                  ] as [
                    string,
                    [string, number | undefined],
                    [string, number | undefined],
                  ][]
                ).map(([rowLabel, a, b]) => (
                  <div key={rowLabel} className="contents">
                    <span className="self-center pr-1 text-right text-surface-500">
                      {rowLabel}
                    </span>
                    {[a, b].map(([cell, count]) => (
                      <span
                        key={cell}
                        className={
                          count === undefined
                            ? "grid h-14 place-items-center rounded-md border border-dashed border-surface-300 text-center text-surface-500"
                            : "grid h-14 place-items-center rounded-md border border-surface-200 text-center text-surface-500"
                        }
                      >
                        <span>
                          <span
                            className={
                              count === undefined
                                ? "block text-base font-semibold text-surface-300"
                                : "tabular block text-base font-semibold text-navy-900"
                            }
                          >
                            {count === undefined ? "—" : formatNumber(count)}
                          </span>
                          {cell}
                        </span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-[10px] leading-snug text-surface-500">
                False negatives — severe crashes the model misses — are the
                costliest error here, which is why recall is weighted heavily.
                {trained
                  ? ` At this threshold it misses ${formatNumber(trained.confusionMatrix.falseNegative)} of ${formatNumber(trained.confusionMatrix.falseNegative + trained.confusionMatrix.truePositive)} severe crashes, and wrongly flags ${formatNumber(trained.confusionMatrix.falsePositive)}.`
                  : ""}
              </p>
            </CardBody>
          </Card>

          <Card className="xl:col-span-6">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>What the model leans on</CardTitle>
                <CardDescription>
                  Which inputs move the prediction, and in which direction.
                </CardDescription>
              </div>
              {importance.data === null ? <PlaceholderBadge /> : null}
            </CardHeader>
            <CardBody className="space-y-3">
              {importance.data ? (
                <>
                  <p className="text-[11px] leading-relaxed text-surface-500">
                    {importance.data.method}: each input is shuffled and the
                    drop in PR-AUC measured, so the scale is &ldquo;how much
                    worse the ranking gets without it&rdquo;. It is unsigned;
                    the SHAP panel below adds the direction of each push.
                  </p>
                  <BarList
                    data={importance.data.items.map((item) => ({
                      label: item.feature,
                      value: Math.round(item.importance * 10_000) / 10_000,
                    }))}
                    valueLabel="importance"
                  />
                </>
              ) : (
                <>
                  <p className="text-[11px] leading-relaxed text-surface-500">
                    Once trained, SHAP values will show each feature&rsquo;s
                    push toward or away from a severe prediction —{" "}
                    <span style={{ color: DIVERGING.above }}>toward</span> and{" "}
                    <span style={{ color: DIVERGING.below }}>away</span> —
                    rather than a single unsigned importance score. Until then,
                    these are the inputs under consideration:
                  </p>
                  <ul className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                    {data.candidateFeatures.map((feature) => (
                      <li key={feature.name} className="text-[11px]">
                        <span className="font-medium text-navy-900">
                          {feature.name}
                        </span>
                        <span className="block text-[10px] text-surface-500">
                          {feature.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardBody>
          </Card>

          <Card className="xl:col-span-6">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Excluded to prevent leakage</CardTitle>
                <CardDescription>
                  Columns that encode the answer, so they can never be inputs.
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <ul className="space-y-2">
                {data.leakageExcluded.map((field) => (
                  <li
                    key={field.name}
                    className="flex items-baseline justify-between gap-3 text-[11px]"
                  >
                    <code className="shrink-0 text-navy-900">{field.name}</code>
                    <span className="text-right text-surface-500">
                      {field.reason}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[10px] leading-snug text-surface-500">
                A model given these would score near-perfectly in testing and be
                useless in practice, since none of them is known before the
                outcome is.
              </p>
            </CardBody>
          </Card>

          {trained ? (
            <>
              <Card className="xl:col-span-7">
                <CardHeader>
                  <div className="min-w-0">
                    <CardTitle>How the candidates compared</CardTitle>
                    <CardDescription>
                      On the validation years ({trained.validationYears[0]}–
                      {trained.validationYears[1]}), each at its own best
                      threshold. {trained.modelName} was chosen on PR-AUC, then
                      scored once on the test years.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardBody>
                  <DataTable
                    caption="Candidate models on the validation years"
                    rows={trained.comparison}
                    columns={[
                      {
                        header: "Model",
                        cell: (row) => (
                          <span
                            className={
                              row.model === trained.modelName
                                ? "font-medium text-navy-900"
                                : undefined
                            }
                          >
                            {row.model}
                            {row.model === trained.modelName
                              ? " ·  chosen"
                              : ""}
                          </span>
                        ),
                      },
                      {
                        header: "PR-AUC",
                        numeric: true,
                        cell: (row) => row.prAuc.toFixed(3),
                      },
                      {
                        header: "ROC-AUC",
                        numeric: true,
                        cell: (row) => row.rocAuc.toFixed(3),
                      },
                      {
                        header: "Recall",
                        numeric: true,
                        cell: (row) => row.recall.toFixed(3),
                      },
                      {
                        header: "Precision",
                        numeric: true,
                        cell: (row) => row.precision.toFixed(3),
                      },
                      {
                        header: "Fit time",
                        numeric: true,
                        cell: (row) => `${row.fitSeconds.toFixed(0)}s`,
                      },
                    ]}
                  />
                </CardBody>
              </Card>

              <Card className="xl:col-span-5">
                <CardHeader>
                  <div className="min-w-0">
                    <CardTitle>Do the probabilities mean anything?</CardTitle>
                    <CardDescription>
                      Test crashes grouped by predicted probability, against how
                      many actually were severe. Close agreement means a
                      predicted 20% can be read as one in five.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardBody>
                  {(() => {
                    const crashes = trained.calibration.reduce(
                      (sum, bin) => sum + bin.crashes,
                      0,
                    );
                    const mean = (pick: (bin: CalibrationBin) => number) =>
                      trained.calibration.reduce(
                        (sum, bin) => sum + pick(bin) * bin.crashes,
                        0,
                      ) / crashes;

                    return (
                      <p className="mb-2.5 text-[11px] leading-relaxed text-surface-600">
                        It runs low:{" "}
                        {formatPercent(
                          mean((b) => b.predicted),
                          1,
                        )}{" "}
                        predicted against{" "}
                        {formatPercent(
                          mean((b) => b.observed),
                          1,
                        )}{" "}
                        observed, and the gap is widest in the safest-looking
                        bins. That is the chronological split doing its job —
                        the severe rate rose from{" "}
                        {formatPercent(trainSevereRate, 1)} in the training
                        years to {formatPercent(trained.testPrevalence, 1)} in
                        the test years, so a model fitted on the past
                        under-calls the present. A random split would have
                        hidden this.
                      </p>
                    );
                  })()}
                  <DataTable
                    caption="Predicted probability against observed severe rate"
                    rows={trained.calibration}
                    columns={[
                      {
                        header: "Predicted",
                        numeric: true,
                        cell: (row) => formatPercent(row.predicted, 1),
                      },
                      {
                        header: "Actually severe",
                        numeric: true,
                        cell: (row) => formatPercent(row.observed, 1),
                      },
                      {
                        header: "Crashes",
                        numeric: true,
                        cell: (row) => formatNumber(row.crashes),
                      },
                    ]}
                  />
                </CardBody>
              </Card>
            </>
          ) : null}

          {shap ? (
            <Card className="xl:col-span-7">
              <CardHeader>
                <div className="min-w-0">
                  <CardTitle>
                    Which conditions push a prediction, and where
                  </CardTitle>
                  <CardDescription>
                    {shap.method}, on {formatNumber(shap.sampleRows)} crashes
                    from {shap.testYears[0]}–{shap.testYears[1]}. Each bar is
                    the average push that level applies when it is present.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardBody>
                <ul className="space-y-1.5">
                  {[...shap.levels.slice(0, 6), ...shap.levels.slice(-4)].map(
                    (level) => {
                      const worse = level.meanShap >= 0;
                      const widest = Math.max(
                        ...shap.levels.map((l) => Math.abs(l.meanShap)),
                      );

                      return (
                        <li
                          key={level.label}
                          className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-2"
                        >
                          <span
                            className="truncate text-[11px] text-surface-700"
                            title={level.label}
                          >
                            {level.label}
                          </span>
                          <span className="relative block h-3">
                            <span
                              aria-hidden
                              className="absolute inset-y-0 left-1/2 w-px bg-surface-300"
                            />
                            <span
                              className="absolute top-1/2 h-2.5 -translate-y-1/2"
                              style={{
                                [worse ? "left" : "right"]: "50%",
                                width: `${(Math.abs(level.meanShap) / widest) * 50}%`,
                                backgroundColor: worse
                                  ? DIVERGING.above
                                  : DIVERGING.below,
                                borderRadius: worse
                                  ? "0 3px 3px 0"
                                  : "3px 0 0 3px",
                              }}
                            />
                          </span>
                          <span
                            className="tabular text-right text-[11px] font-medium"
                            style={{
                              color: worse ? DIVERGING.above : DIVERGING.below,
                            }}
                          >
                            {worse ? "+" : "−"}
                            {Math.abs(level.meanShap).toFixed(2)}
                          </span>
                        </li>
                      );
                    },
                  )}
                </ul>
                <p className="mt-3 text-[11px] leading-relaxed text-surface-600">
                  <span className="font-medium text-navy-900">
                    Read the &ldquo;Unknown&rdquo; levels as a warning, not a
                    finding.
                  </span>{" "}
                  The strongest pushes in either direction come from missing
                  data: an unrecorded light condition pulls hard away from
                  severe, an unrecorded speed limit pushes towards it. That
                  matches what the Risk Factors page found, and it means the
                  model has partly learned how CAS records are completed.
                  Removing those levels is the first thing to try in a further
                  pass.
                </p>
              </CardBody>
            </Card>
          ) : null}

          {shap ? (
            <Card className="xl:col-span-5">
              <CardHeader>
                <div className="min-w-0">
                  <CardTitle>Three real crashes, explained</CardTitle>
                  <CardDescription>
                    Actual rows from the test years. The pushes add to the
                    prediction, so an explanation is arithmetic rather than a
                    story told afterwards.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                {shap.examples.map((example) => (
                  <div
                    key={example.title}
                    className="rounded-md border border-surface-200 p-2.5"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[11px] font-medium text-navy-900">
                        {example.title}
                      </p>
                      <p className="tabular text-[13px] font-semibold text-navy-900">
                        {/* Two decimals: the lowest-risk example rounds to
                            "0.0%" at one, which reads as impossible. */}
                        {formatPercent(example.probability, 2)}
                      </p>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {example.contributions.map((contribution) => (
                        <li
                          key={contribution.label}
                          className="flex items-baseline justify-between gap-2 text-[10px]"
                        >
                          <span className="min-w-0 truncate text-surface-600">
                            {contribution.label}
                          </span>
                          <span
                            className="tabular shrink-0 font-medium"
                            style={{
                              color:
                                contribution.shap >= 0
                                  ? DIVERGING.above
                                  : DIVERGING.below,
                            }}
                          >
                            {contribution.shap >= 0 ? "+" : "−"}
                            {Math.abs(contribution.shap).toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}

          <Card className="xl:col-span-12">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Scenario explorer</CardTitle>
                <CardDescription>
                  Set road and environment conditions and see what the model
                  says about a crash reported under them. It does not say how
                  likely a crash is on such a road.
                </CardDescription>
              </div>
              {scenarios.data ? null : <PlaceholderBadge />}
            </CardHeader>
            <CardBody>
              {scenarios.data ? (
                <>
                  <ScenarioExplorer grid={scenarios.data} />
                  <p className="mt-3 text-[10px] leading-snug text-surface-500">
                    Every combination was scored by the model in the pipeline,
                    so these are its own outputs rather than an approximation.
                    The inputs not offered here are held at their most common
                    training value:{" "}
                    {scenarios.data.heldFixed
                      .map((held) => `${held.feature} ${held.value}`)
                      .join(", ")}
                    . Changing those would move the figures.
                  </p>
                </>
              ) : (
                <p className="text-[11px] leading-relaxed text-surface-500">
                  Available once a model is trained.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
