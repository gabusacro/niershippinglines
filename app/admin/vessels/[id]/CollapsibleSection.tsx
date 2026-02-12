"use client";

import { useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleSection({
  title,
  description,
  children,
  defaultOpen = true,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mt-10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-2 text-left focus:outline-none focus:ring-2 focus:ring-[#0c7b93] focus:ring-offset-2 rounded-lg p-1 -m-1"
      >
        <div>
          <h2 className="text-lg font-semibold text-[#134e4a]">{title}</h2>
          {description && <p className="mt-1 text-sm text-[#0f766e]">{description}</p>}
        </div>
        <span className="shrink-0 text-[#0f766e]" aria-hidden>
          {open ? "▼" : "▶"}
        </span>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </section>
  );
}
