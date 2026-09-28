/** Глаз как у счётчика просмотров в Telegram: контур-миндаль и залитый зрачок. */
export function EyeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M2 12c2.4-4.3 5.8-6.5 10-6.5s7.6 2.2 10 6.5c-2.4 4.3-5.8 6.5-10 6.5S4.4 16.3 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.4" fill="currentColor" />
    </svg>
  );
}
