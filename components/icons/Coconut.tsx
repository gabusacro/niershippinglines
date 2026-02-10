interface CoconutProps {
  className?: string;
  size?: number;
}

export function Coconut({ className = "", size = 24 }: CoconutProps) {
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
      <ellipse cx="12" cy="14" rx="4" ry="5" />
      <path d="M8 14c0-2 2-4 4-4s4 2 4 4" />
    </svg>
  );
}
