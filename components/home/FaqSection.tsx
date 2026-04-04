"use client";

import { useState } from "react";
import Link from "next/link";
import type { FaqItem } from "@/lib/home/get-faqs";

interface FaqSectionProps {
  faqs: FaqItem[];
  variant?: "dark" | "light";  // dark = homepage, light = /faq page
}

export function FaqSection({ faqs, variant = "dark" }: FaqSectionProps) {
  const [open,    setOpen]    = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (!faqs || faqs.length === 0) return null;

  const PREVIEW_COUNT = 3;
  const visible = showAll ? faqs : faqs.slice(0, PREVIEW_COUNT);
  const hasMore  = faqs.length > PREVIEW_COUNT;

  const isLight = variant === "light";

  return (
    <section
      className={`py-12 sm:py-16 ${isLight ? "bg-white" : ""}`}
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">

        {/* Header */}
        <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.28em] text-[#0c7b93]">
          Got questions?
        </p>
        <h2
          id="faq-heading"
          className={`mt-1 text-2xl font-black sm:text-3xl ${
            isLight ? "text-[#085C52]" : "text-white"
          }`}
        >
          Frequently asked
        </h2>
        <p className={`mt-1 text-sm font-semibold ${
          isLight ? "text-slate-500" : "text-white/50"
        }`}>
          Everything you need to know before you sail
        </p>

        {/* Accordion */}
        <div className="mt-7 flex flex-col gap-2.5 max-w-3xl">
          {visible.map((faq) => {
            const isOpen = open === faq.id;
            return (
              <div
                key={faq.id}
                className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
                  isOpen
                    ? "border-[#4dd9c0]/40 shadow-lg shadow-[#4dd9c0]/10"
                    : isLight
                      ? "border-slate-200 hover:border-[#4dd9c0]/40"
                      : "border-white/10 hover:border-white/20"
                }`}
                style={{
                  background: isOpen
                    ? isLight ? "rgba(8,92,82,0.04)" : "rgba(77,217,192,0.07)"
                    : isLight ? "rgba(248,250,252,1)"  : "rgba(255,255,255,0.05)",
                  backdropFilter: isLight ? undefined : "blur(8px)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : faq.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className={`font-bold text-sm sm:text-base leading-snug ${
                    isLight ? "text-slate-800" : "text-white/90"
                  }`}>
                    {faq.question}
                  </span>
                  <span
                    className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-full border text-base font-light transition-all duration-300 ${
                      isOpen
                        ? "border-[#4dd9c0]/50 text-[#4dd9c0] rotate-45 bg-[#4dd9c0]/10"
                        : isLight
                          ? "border-slate-300 text-slate-400"
                          : "border-white/20 text-white/50"
                    }`}
                  >
                    ＋
                  </span>
                </button>

                {isOpen && (
                  <div className={`border-t px-5 pb-4 pt-3 ${
                    isLight ? "border-slate-100" : "border-white/8"
                  }`}>
                    <p className={`text-sm font-semibold leading-relaxed ${
                      isLight ? "text-slate-600" : "text-white/65"
                    }`}>
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer row */}
        <div className="mt-5 flex items-center gap-4 max-w-3xl">
          {hasMore && (
            <button
              type="button"
              onClick={() => { setShowAll((s) => !s); if (showAll) setOpen(null); }}
              className={`flex items-center gap-2 text-sm font-bold transition-colors hover:text-[#4dd9c0] ${
                isLight ? "text-slate-500" : "text-white/60"
              }`}
            >
              <span className={`text-base font-light transition-transform duration-200 inline-block ${showAll ? "rotate-45" : ""}`}>
                ＋
              </span>
              {showAll
                ? "Show less"
                : `Show ${faqs.length - PREVIEW_COUNT} more questions`}
            </button>
          )}
          {!isLight && (
            <Link
              href="/faq"
              className="ml-auto text-sm font-bold text-[#4dd9c0] hover:text-white transition-colors flex items-center gap-1"
            >
              View all FAQs →
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}