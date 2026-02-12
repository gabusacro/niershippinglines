"use client";

export function PrintTicketsButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e]"
    >
      Print tickets
    </button>
  );
}
