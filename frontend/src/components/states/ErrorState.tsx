interface ErrorStateProps {
  title?: string;
  /** Safe to show the user. Never surface a raw stack trace here. */
  message?: string;
  action?: React.ReactNode;
}

export function ErrorState({
  title = "Could not load this data",
  message,
  action,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center"
    >
      <p className="text-sm font-medium text-severity-fatal">{title}</p>
      {message ? (
        <p className="max-w-sm text-xs text-surface-500">{message}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
