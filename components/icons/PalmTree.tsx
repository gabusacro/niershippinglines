interface PalmTreeProps {
  className?: string;
  size?: number;
}

export function PalmTree({ className = "", size = 24 }: PalmTreeProps) {
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
      {/* Trunk */}
      <path d="M12 22V10" />
      {/* Fronds */}
      <path d="M8 10c0-2 1.5-4 4-4s4 2 4 4c0 1.5-1 3-2 4" />
      <path d="M12 6c-2 1-3 3-3 5" />
      <path d="M12 6c2 1 3 3 3 5" />
      <path d="M6 12c1-1 2-2 3-2s2 1 3 2" />
      <path d="M18 12c-1-1-2-2-3-2s-2 1-3 2" />
    </svg>
  );
}
