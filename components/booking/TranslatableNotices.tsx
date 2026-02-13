"use client";

import { useState, useEffect } from "react";
import { NOTICE_LANGUAGES, NOTICE_TRANSLATIONS, type NoticeLang } from "@/lib/booking-notices-translations";

const STORAGE_KEY = "notice-lang";
const LANG_EVENT = "notice-lang-change";

interface TranslatableNoticesProps {
  /** Use only last N notices (e.g. 2 for booking detail). Omit for all 4. */
  sliceFrom?: number;
  className?: string;
  listClassName?: string;
  compact?: boolean;
  /** Hide language selector (e.g. for 2nd+ ticket when multiple on page). */
  showSelector?: boolean;
}

export function TranslatableNotices({
  sliceFrom = 0,
  className = "",
  listClassName = "text-xs text-amber-900 space-y-0.5 list-disc list-outside pl-5 ml-1",
  compact = false,
  showSelector = true,
}: TranslatableNoticesProps) {
  const [lang, setLang] = useState<NoticeLang>("en");

  useEffect(() => {
    const sync = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY) as NoticeLang | null;
        if (stored && NOTICE_TRANSLATIONS[stored]) setLang(stored);
      } catch {
        /* ignore */
      }
    };
    sync();
    const onLangChange = () => sync();
    window.addEventListener(LANG_EVENT, onLangChange);
    window.addEventListener("storage", onLangChange);
    return () => {
      window.removeEventListener(LANG_EVENT, onLangChange);
      window.removeEventListener("storage", onLangChange);
    };
  }, []);

  const handleLangChange = (code: NoticeLang) => {
    setLang(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
      window.dispatchEvent(new CustomEvent(LANG_EVENT));
    } catch {
      /* ignore */
    }
  };

  const notices = NOTICE_TRANSLATIONS[lang];
  const displayed = sliceFrom > 0 ? notices.slice(sliceFrom) : notices;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-amber-800">Important notices</p>
        {showSelector && (
        <div className="flex flex-wrap items-center gap-1 print:hidden" role="group" aria-label="Translate notices">
          {NOTICE_LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => handleLangChange(code)}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                lang === code
                  ? "bg-amber-200 text-amber-900"
                  : "text-amber-700 hover:bg-amber-100"
              }`}
              title={label}
            >
              {compact ? code.toUpperCase() : label}
            </button>
          ))}
        </div>
        )}
      </div>
      <ul className={`mt-1 ${listClassName}`}>
        {displayed.map((notice, j) => (
          <li key={j}>{notice}</li>
        ))}
      </ul>
    </div>
  );
}
