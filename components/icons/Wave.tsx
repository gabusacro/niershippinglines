interface WaveProps {
  className?: string;
  size?: number;
}

export function Wave({ className = "", size = 24 }: WaveProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12c2-2 4-4 6-4s4 2 6 4 4 4 6 4" />
      <path d="M2 17c2-2 4-4 6-4s4 2 6 4 4 4 6 4" />
      <path d="M2 7c2-2 4-4 6-4s4 2 6 4 4 4 6 4" />
    </svg>
  );
}
