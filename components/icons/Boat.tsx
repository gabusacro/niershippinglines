interface BoatProps {
  className?: string;
  size?: number;
}

/**
 * Motorboat icon (side view): pointed bow, hull, cabin/pilothouse, stern.
 */
export function Boat({ className = "", size = 24 }: BoatProps) {
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
      {/* Deck line: bow to stern */}
      <path d="M6 12 L22 14" />
      {/* Hull bottom / waterline */}
      <path d="M4 16 L20 16" />
      {/* Bow: pointed front */}
      <path d="M6 12 L4 16" />
      {/* Stern */}
      <path d="M22 14 L20 16" />
      {/* Cabin / pilothouse */}
      <path d="M9 12 L9 8 L15 8 L15 12 Z" />
      {/* Exhaust / stack */}
      <path d="M12 8 L12 6" />
    </svg>
  );
}
