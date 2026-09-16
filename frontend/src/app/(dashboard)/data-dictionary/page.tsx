import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { DictionaryExplorer } from "@/features/data-dictionary/DictionaryExplorer";
import { formatNumber } from "@/lib/formatters";
import { getDataDictionary } from "@/services/datasetService";

export const metadata = { title: "Data Dictionary" };

/**
 * Column metadata is a property of the dataset, not of a filtered view, so
 * this page ignores the sidebar filters and stays statically rendered.
 */
export default async function DataDictionaryPage() {
  const { data, meta } = await getDataDictionary();
  const fields = data.fields;

  const stats = [
    { label: "Crash records", value: formatNumber(data.rowCount) },
    { label: "Columns", value: formatNumber(data.columnCount) },
    {
      label: "Derived by the pipeline",
      value: formatNumber(fields.filter((f) => f.derived).length),
    },
    {
      label: "Used in the dashboard",
      value: formatNumber(fields.filter((f) => f.usedInDashboard).length),
    },
    {
      label: "Over 50% missing",
      value: formatNumber(fields.filter((f) => f.missingPct > 50).length),
    },
  ];

  return (
    <>
      <PageHeader
        title="Data Dictionary"
        description="Every column in the processed CAS dataset: what it means, how complete it is, and where it is used."
      />

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardBody className="py-3">
                <p className="text-[11px] text-surface-500">{s.label}</p>
                <p className="tabular mt-1 text-[20px] leading-none font-semibold text-navy-900">
                  {s.value}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>Columns</CardTitle>
              <CardDescription>
                Types, examples and missing values are measured from{" "}
                <code>{data.sourceFile}</code>; descriptions are our working
                understanding and have not yet been reconciled with NZTA&apos;s
                published definitions. The sidebar filters do not apply here.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <DictionaryExplorer fields={fields} />
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-3 text-[11px] leading-relaxed text-surface-700 lg:grid-cols-3">
          <Card>
            <CardBody>
              <p className="font-semibold text-navy-900">Missing is not always a gap</p>
              <p className="mt-1">
                <code>holiday</code> is 94.5% empty because most crashes are not
                on a holiday, and <code>pedestrian</code> is filled only when one
                was involved. The roadside-object block is empty for the same
                57.3% of rows; whether that means &ldquo;not struck&rdquo; is
                still unresolved.
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="font-semibold text-navy-900">What the model may use</p>
              <p className="mt-1">
                No model has been trained yet. &ldquo;Candidate&rdquo; marks
                planned inputs; &ldquo;Excluded&rdquo; marks columns that encode
                the outcome (casualty counts, severity) or carry no meaning (the
                record ID) and must never be inputs.
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="font-semibold text-navy-900">What CAS does not record</p>
              <p className="mt-1">
                There is no date, month, weekday or time of day — only the year
                — and no recorded cause. Every relationship shown elsewhere is
                an association with severity, not a cause of it.
              </p>
            </CardBody>
          </Card>
        </div>

        {meta.generatedAt ? (
          <p className="text-[10px] text-surface-400">
            Profiled {new Date(meta.generatedAt).toLocaleDateString("en-NZ")} ·{" "}
            {meta.note}
          </p>
        ) : null}
      </div>
    </>
  );
}
