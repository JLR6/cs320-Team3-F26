export function FieldError({ id, message }: { id: string; message?: string }) {
  // hide the region when validation has no msg
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
      className="text-xs font-semibold text-destructive mt-1"
    >
      {message}
    </p>
  );
}
