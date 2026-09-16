interface PageHeaderProps {
  title: string;
  description?: string;
  /** Filter summary, export button, etc. */
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-200 bg-white px-4 py-2.5">
      <div className="min-w-0">
        <h1 className="text-base leading-tight font-semibold tracking-tight text-navy-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-0.5 max-w-3xl text-[11px] leading-snug text-surface-500">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
