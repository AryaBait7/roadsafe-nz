import Link from "next/link";
import type { ApiResponse, FeatureImportanceItem } from "@/types";

/**
 * Dashboard preview of the severity model.
 *
 * No model has been trained yet, so this renders an explicit awaiting-model
 * state rather than a plausible-looking feature-importance chart. A reader
 * cannot tell a placeholder ranking from a measured one, and a screenshot of
 * invented importances in a portfolio would be a claim about a model that
 * does not exist.
 *
 * The panel still shows the shape of what is coming, so the dashboard reads
 * as complete rather than missing a card.
 */
export function ModelPreview({
  importance,
}: {
  importance: ApiResponse<FeatureImportanceItem[] | null>;
}) {
  const hasModel = importance.data !== null && importance.data.length > 0;

  return (
    <div className="flex h-full flex-col justify-between gap-5">
      {hasModel ? (
        <ul className="flex flex-col gap-2.5">
          {importance.data!.map((item) => (
            <li key={item.feature} className="text-xs text-surface-700">
              {item.feature}
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-2.5">
          <p className="text-sm font-medium text-navy-900">
            No model trained yet
          </p>
          <p className="max-w-prose text-xs leading-relaxed text-surface-500">
            The crash-severity classifier is scheduled for Stage 20. Until it
            has been trained and evaluated, no performance figures or feature
            rankings are shown here — placeholder numbers would be
            indistinguishable from measured ones.
          </p>
          <p className="max-w-prose text-xs leading-relaxed text-surface-500">
            When it lands, the model will estimate how severe a crash is likely
            to be <em>given that a crash occurred</em>. It will not predict
            whether a crash will happen — this dataset contains only crashes,
            so it has no examples of roads and conditions where nothing went
            wrong.
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
