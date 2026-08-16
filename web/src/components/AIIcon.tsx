// Wide-grotesk "AI" lettermark used as the assistant's identity icon.
// Hand-drawn paths keep the shape identical across platforms (no font lookup).
export function AIIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M2.5 21V9.8a5.6 5.6 0 0 1 11.2 0V21h-3.5v-4.5H6V21Zm3.5-7.2h4.2V9.9a2.1 2.1 0 0 0-4.2 0Z"
      />
      <rect x="16.9" y="4.6" width="3.7" height="16.4" rx="1.85" />
    </svg>
  )
}
