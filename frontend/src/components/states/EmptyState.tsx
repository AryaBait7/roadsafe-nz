interface EmptyStateProps {
  title: string;
  /** What the user can do about it — an empty panel with no next step is a dead end. */
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="text-sm font-medium text-navy-900">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs text-surface-500">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
