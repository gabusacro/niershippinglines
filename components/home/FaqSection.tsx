"use client";

import { useState } from "react";
import type { FaqItem } from "@/lib/home/get-faqs";

export function FaqSection({ faqs }: { faqs: FaqItem[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (!faqs || faqs.length === 0) return null;

  return (
    <section className="border-t border-teal-200/50 bg-white py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-xs font-extrabold uppercase tracking-widest text-[#0c7b93]">Got questions?</p>
        <h2 className="mt-1 text-2xl font-black text-[#134e4a] sm:text-3xl">Frequently asked</h2>
        <p className="mt-1 text-sm font-semibold text-[#0f766e]">Everything you need to know before you sail</p>

        <div className="mt-6 flex flex-col gap-3 max-w-3xl">
          {faqs.map((faq) => {
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
      </div>
    </section>
  );
}
