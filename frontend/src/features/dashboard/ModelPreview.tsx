import Link from "next/link";
import { BarList } from "@/components/charts/BarList";
import { formatPercent } from "@/lib/formatters";
import type {
  ApiResponse,
  FeatureImportanceReport,
  ModelMetrics,
} from "@/types";

/**
 * Dashboard preview of the severity model.
 *
 * Shows the headline figure with the reference it has to beat, because
 * "PR-AUC 0.15" alone tells a reader nothing. When no model is available it
 * says so rather than rendering a plausible-looking ranking: a placeholder
 * cannot be told apart from a measured one.
 */
export function ModelPreview({
  importance,
  metrics,
}: {
  importance: ApiResponse<FeatureImportanceReport | null>;
  metrics: ApiResponse<ModelMetrics | null>;
}) {
  const model = metrics.data;
  const top = importance.data?.items.slice(0, 5) ?? [];

  return (
    <div className="flex h-full flex-col justify-between gap-4">
      {model ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-navy-900">
              {model.modelName}
            </p>
            <p className="text-[11px] leading-relaxed text-surface-500">
              PR-AUC{" "}
              <span className="tabular font-medium text-navy-900">
                {model.prAuc.toFixed(3)}
              </span>{" "}
              on {model.testYears[0]}–{model.testYears[1]}, against{" "}
              {model.references.randomPrAuc.toFixed(3)} for random ranking. It
              finds {formatPercent(model.recall, 0)} of severe crashes;{" "}
              {formatPercent(model.precision, 0)} of what it flags is severe.
            </p>
          </div>

          {top.length > 0 ? (
            <BarList
              data={top.map((item) => ({
                label: item.feature,
                value: Math.round(item.importance * 10_000) / 10_000,
              }))}
              valueLabel="importance"
            />
          ) : null}
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-sm font-medium text-navy-900">
            No model trained yet
          </p>
          <p className="max-w-prose text-xs leading-relaxed text-surface-500">
            No performance figures or feature rankings are shown until a model
            has been trained and evaluated — placeholder numbers would be
            indistinguishable from measured ones.
          </p>
          <p className="max-w-prose text-xs leading-relaxed text-surface-500">
            The model estimates how severe a crash is likely to be{" "}
            <em>given that a crash occurred</em>. It does not predict whether a
            crash will happen: this dataset contains only crashes, so it has no
            examples of roads and conditions where nothing went wrong.
          </p>
        </div>
      )}

      <Link
        href="/ml-insights"
        className="text-xs font-medium text-accent-600 hover:underline"
      >
        View full model report →
      </Link>
    </div>
  );
}
