interface SurfboardProps {
  className?: string;
  size?: number;
}

export function Surfboard({ className = "", size = 24 }: SurfboardProps) {
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
      <path d="M2 20c2-2 4-4 8-4s6 2 8 4" />
      <path d="M4 16c2-1 4-2 8-2s6 1 8 2" />
      <path d="M6 12c2 0 4-.5 8-.5s6 .5 8 .5" />
      <path d="M8 8c2 .5 4 1 8 1s6-.5 8-1" />
      <path d="M10 4c2 0 4 0 8 0s6 0 8 0" />
    </svg>
  );
}
