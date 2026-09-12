interface PageHeaderProps {
  title: string;
  description?: string;
  /** Filter summary, export button, etc. */
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-200 bg-white px-6 py-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-navy-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-surface-500">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
