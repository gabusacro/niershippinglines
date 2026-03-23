"use client";

import { useState } from "react";
import Link from "next/link";
import type { FaqItem } from "@/lib/home/get-faqs";

export function FaqSection({ faqs }: { faqs: FaqItem[] }) {
  const [open,    setOpen]    = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (!faqs || faqs.length === 0) return null;

  const PREVIEW_COUNT = 3;
  const visible = showAll ? faqs : faqs.slice(0, PREVIEW_COUNT);
  const hasMore  = faqs.length > PREVIEW_COUNT;

  return (
    <section className="border-t border-teal-200/50 bg-white py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-xs font-extrabold uppercase tracking-widest text-[#0c7b93]">Got questions?</p>
        <h2 className="mt-1 text-2xl font-black text-[#134e4a] sm:text-3xl">Frequently asked</h2>
        <p className="mt-1 text-sm font-semibold text-[#0f766e]">Everything you need to know before you sail</p>

        <div className="mt-6 flex flex-col gap-3 max-w-3xl">
          {visible.map((faq) => {
            const isOpen = open === faq.id;
            return (
              <div
                key={faq.id}
                className={`overflow-hidden rounded-2xl border-2 transition-all ${
                  isOpen ? "border-[#0c7b93] shadow-sm" : "border-teal-100 hover:border-teal-300"
                } bg-white`}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : faq.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="font-bold text-[#134e4a] text-sm sm:text-base leading-snug">
                    {faq.question}
                  </span>
                  <span className={`shrink-0 text-xl font-light text-[#0c7b93] transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`}>
                    ＋
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-teal-100 px-5 pb-4 pt-3">
                    <p className="text-sm font-semibold text-[#0f766e] leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Load more / show less + View all link */}
        <div className="mt-5 flex items-center gap-4 max-w-3xl">
          {hasMore && (
            <button
              type="button"
              onClick={() => { setShowAll((s) => !s); if (showAll) setOpen(null); }}
              className="flex items-center gap-2 text-sm font-bold text-[#0c7b93] hover:text-[#085C52] transition-colors"
            >
              <span className={`text-lg font-light transition-transform duration-200 ${showAll ? "rotate-45 inline-block" : ""}`}>＋</span>
              {showAll ? "Show less" : `Show ${faqs.length - PREVIEW_COUNT} more questions`}
            </button>
          )}
          <Link
            href="/faq"
            className="ml-auto text-sm font-bold text-[#0c7b93] hover:text-[#085C52] transition-colors flex items-center gap-1"
          >
            View all FAQs →
          </Link>
        </div>
      </div>
    </section>
  );
}
