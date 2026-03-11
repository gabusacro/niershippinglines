"use client";

/**
 * ShareButtons — reusable social share widget
 * Usage:
 *   <ShareButtons
 *     message="Just booked my trip to Siargao! 🏝️"
 *     url="https://travelasiargao.com"
 *     label="Share your trip"
 *   />
 */

import { useState } from "react";

type ShareButtonsProps = {
  message: string;
  url?: string;
  label?: string;
  compact?: boolean; // smaller layout for email / tight spaces
};

export function ShareButtons({
  message,
  url = "https://travelasiargao.com",
  label = "Share with friends",
  compact = false,
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const encoded = encodeURIComponent(message);
  const encodedUrl = encodeURIComponent(url);
  const encodedMsg = encodeURIComponent(`${message} ${url}`);

  const links = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encoded}`,
    messenger: `fb-messenger://share/?link=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedMsg}`,
    viber: `viber://forward?text=${encodedMsg}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedMsg}`,
    email: `mailto:?subject=Check out Travela Siargao!&body=${encodedMsg}`,
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${message} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const btnBase = compact
    ? "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all hover:opacity-80 hover:-translate-y-0.5 active:scale-95"
    : "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-85 hover:-translate-y-0.5 active:scale-95 shadow-sm";

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {label && (
        <p className={`font-bold text-[#134e4a] ${compact ? "text-xs" : "text-sm"}`}>
          {label}
        </p>
      )}
      <div className={`flex flex-wrap gap-2`}>

        {/* Facebook */}
        <a
          href={links.facebook}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btnBase} bg-[#1877F2] text-white`}
          aria-label="Share on Facebook"
        >
          <svg className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          {!compact && <span>Facebook</span>}
          {compact && <span>FB</span>}
        </a>

        {/* Messenger */}
        <a
          href={links.messenger}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btnBase} bg-gradient-to-br from-[#0078FF] to-[#A033FF] text-white`}
          aria-label="Share on Messenger"
        >
          <svg className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.683V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z"/>
          </svg>
          {!compact && <span>Messenger</span>}
          {compact && <span>MSG</span>}
        </a>

        {/* WhatsApp */}
        <a
          href={links.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btnBase} bg-[#25D366] text-white`}
          aria-label="Share on WhatsApp"
        >
          <svg className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          {!compact && <span>WhatsApp</span>}
          {compact && <span>WA</span>}
        </a>

        {/* Viber */}
        <a
          href={links.viber}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btnBase} bg-[#7360F2] text-white`}
          aria-label="Share on Viber"
        >
          <svg className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.398.002C8.473.085 2.101 .61 .75 6.898c-.66 3.015-.733 6.952.017 10.067C1.703 21.239 6.63 21.698 8 21.696v2.498s-.013.804.5.966c.63.195.993-.404 1.59-1.05.327-.356.779-.88 1.12-1.272 3.085.258 5.46-.333 5.73-.42.623-.202 4.15-.654 4.726-5.33.594-4.824-.288-7.862-1.857-9.232l-.003-.004c-.467-.424-2.343-1.8-6.086-2.01C13.38.793 12.283-.028 11.398.002Zm.099 1.62c3.266-.022 5.187.981 5.63 1.373 1.313 1.14 2.024 3.757 1.51 7.876-.474 3.868-3.235 4.14-3.757 4.308-.217.07-2.334.583-4.962.414l-.005.004-.003.002s-1.967 2.367-2.582 2.995c-.097.1-.208.14-.283.12-.105-.027-.135-.153-.134-.337l.018-2.878S2.52 17.22 1.87 14.5c-.645-2.72-.568-6.294.003-9.003C2.923 1.784 8.464 1.644 11.497 1.622Zm.048 2.549c-.165.001-.33.007-.497.017-2.12.127-3.373 1.27-3.373 1.27-.002 0-1.45 1.239-1.546 3.896-.07 1.924.439 3.354 1.017 4.338.098.168.196.33.292.482l.003.007.002.004.001.002.001.003.002.006.003.007c.198.304.389.568.557.797l.002.003.002.003c.056.077.11.15.162.218l.001.002.018.025c.053.075.098.14.131.194l.01.015.012.018.013.021.013.02a.46.46 0 0 1 .06.143c.048.194-.017.4-.199.488l-.006.003c-.357.162-.668-.063-.896-.273-.222-.205-.437-.44-.63-.684-.095-.12-.186-.243-.272-.365l-.003-.004-.01-.016-.012-.017c-.06-.088-.115-.175-.165-.258a10.09 10.09 0 0 1-.336-.64c-.54-1.166-.985-2.822-.9-5.07.12-3.28 1.862-4.77 1.862-4.77s1.567-1.396 4.082-1.541c.208-.012.414-.018.618-.017h.002c2.124.004 3.502.826 3.502.826.002 0 1.637 1.012 1.637 3.842 0 0 .074 2.617-1.378 3.517-.002.002-.005.003-.007.005-.236.14-.47.193-.678.193-.385 0-.684-.164-.684-.164-.002 0-1.18-.736-1.18-.736l-.844-2.328s-.342-.744.07-1.19c.414-.448.869-.448.869-.448l.003-.001c.235-.004.417.088.55.197.131.108.221.245.28.369.06.122.089.233.097.3.013.107-.01.17-.01.17v.003l-.002.005v.002l-.001.002-.001.003v.002l-.002.005c-.017.044-.055.1-.148.15a.52.52 0 0 1-.227.056c-.195 0-.341-.107-.341-.107l-.4-.3s-.1-.075-.202-.075c-.205 0-.331.246-.331.246-.253.576.155 1.504.155 1.504l.7 1.929s.126.343.505.54c.377.195.724.078.724.078l.008-.004c1.803-.968 1.74-3.198 1.74-3.198 0-2.303-1.268-3.106-1.268-3.106-.61-.38-1.667-.792-3.225-.795zm.08 1.77c.57-.002 1.022.19 1.022.19v.002s.88.37.88 1.457c0 1.088-.757 1.576-.757 1.576-.001 0-.14.098-.343.098a.512.512 0 0 1-.283-.082c-.28-.18-.254-.52-.254-.52l-.002-.004V9.44c.038-.396.312-.62.312-.62s.203-.17.486-.17c.055 0 .112.007.166.022.165.046.267.163.31.252.082.17.04.345.04.345l-.24.67s-.083.214-.082.42c.002.203.094.35.094.35.001.002.186.265.497.265.086 0 .179-.02.277-.066.464-.218.672-.9.672-.9.33-1.057-.29-1.826-.29-1.826-.494-.607-1.38-.631-1.38-.631l-.09-.003z"/>
          </svg>
          {!compact && <span>Viber</span>}
          {compact && <span>Viber</span>}
        </a>

        {/* X / Twitter */}
        <a
          href={links.twitter}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btnBase} bg-black text-white`}
          aria-label="Share on X"
        >
          <svg className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          {!compact && <span>X</span>}
          {compact && <span>X</span>}
        </a>

        {/* Email */}
        <a
          href={links.email}
          className={`${btnBase} bg-[#0f766e] text-white`}
          aria-label="Share via Email"
        >
          <svg className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
          {!compact && <span>Email</span>}
          {compact && <span>Email</span>}
        </a>

        {/* Copy link */}
        <button
          onClick={handleCopy}
          className={`${btnBase} ${copied ? "bg-emerald-500 text-white" : "bg-[#e0f2fe] text-[#0c7b93] border border-[#99d6d4]"}`}
          aria-label="Copy link"
        >
          {copied ? (
            <>
              <svg className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>

      </div>
    </div>
  );
}
