/** Wordmark: "expire" in foreground + "365" in mint (locked mockups). */
export function BrandName({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`.trim()}>
      <span className="text-foreground">expire</span>
      <span className="text-primary">365</span>
    </span>
  );
}