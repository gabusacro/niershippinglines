"use client";
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700"
    >
      🖨️ Print Manifest
    </button>
  );
}