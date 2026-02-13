"use client";

import { useState } from "react";
import { Sun } from "@/components/icons";

const STEPS = [
  { step: 1, title: "Choose route & date", desc: "Pick Siargao ↔ Surigao or Dinagat ↔ Surigao, then your travel date." },
  { step: 2, title: "Pick a time & boat", desc: "Select your preferred departure time and we'll show available boats." },
  { step: 3, title: "Enter passenger details", desc: "Add names and contact info. Choose fare type (adult, senior, PWD, child)." },
  { step: 4, title: "Pay via GCash", desc: "Pay with GCash and upload a screenshot of your payment for verification." },
  { step: 5, title: "Get your e-ticket", desc: "Receive your e-ticket with QR code and reference number. Show it at the pier." },
];

export function HowItWorksSection() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="rounded-2xl border border-teal-200 bg-white/80 shadow-sm overflow-hidden mb-8 sm:mb-10">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full bg-[#0c7b93]/10 px-4 py-3 sm:px-6 sm:py-4 border-b border-teal-200 text-left hover:bg-[#0c7b93]/15 transition-colors"
        aria-expanded={expanded}
      >
        <h2 className="font-semibold text-[#134e4a] flex items-center justify-between gap-2 text-sm sm:text-base">
          <span className="flex items-center gap-2">
            <Sun size={20} className="text-[#f59e0b] shrink-0" />
            How it works
          </span>
          <span className="shrink-0 text-[#0f766e]" aria-hidden>
            {expanded ? "▼" : "▶"}
          </span>
        </h2>
      </button>
      {expanded && (
        <ol className="divide-y divide-teal-100">
          {STEPS.map(({ step, title, desc }) => (
            <li key={step} className="flex gap-3 sm:gap-4 px-4 py-4 sm:px-6">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0c7b93] text-sm font-bold text-white touch-target">
                {step}
              </span>
              <div className="min-w-0">
                <h3 className="font-medium text-[#134e4a] text-sm sm:text-base">{title}</h3>
                <p className="mt-0.5 text-xs sm:text-sm text-[#0f766e]">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
