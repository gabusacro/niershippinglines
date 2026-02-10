import Link from "next/link";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { PalmTree, Wave, Sun, Boat, Surfboard } from "@/components/icons";
import { WeatherWidget } from "@/components/weather/WeatherWidget";

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-8rem)]">
      {/* Hero: island vibe with icons */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0d9488]/25 via-[#99d6d4]/15 to-transparent pt-8 pb-14 sm:pt-14 sm:pb-20 md:pt-18 md:pb-24">
        <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20">
          <PalmTree size={56} className="text-[#0f766e] -ml-2 mt-16 rotate-12 sm:w-16 sm:h-16 md:w-20 md:h-20 md:mt-20" />
          <Sun size={48} className="text-[#f59e0b] mr-4 mt-6 sm:w-14 sm:h-14 md:w-16 md:h-16 md:mr-8 md:mt-8" />
          <Wave size={56} className="text-[#0c7b93] mr-4 mt-32 sm:w-16 sm:h-16 md:w-[72px] md:h-[72px] md:mr-16 md:mt-40" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h1 className="text-3xl font-bold text-[#134e4a] leading-tight tracking-tight sm:text-4xl md:text-5xl">
            {APP_NAME}
          </h1>
          <p className="mt-3 text-base text-[#0f766e] font-medium tracking-tight sm:mt-4 sm:text-lg md:text-xl">
            Siargao Island ↔ Surigao &middot; Dinagat ↔ Surigao City
          </p>
          <p className="mt-2 text-[#0f766e]/90 text-base sm:mt-3 sm:text-lg tracking-tight">
            Feel the island before you arrive. Sun, waves, and a smooth sail away.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
            <Link
              href={ROUTES.book}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#0c7b93] px-6 py-4 text-base font-semibold text-white shadow-lg shadow-[#0c7b93]/25 hover:bg-[#0f766e] transition-all duration-200 touch-target active:scale-[0.98] sm:min-h-0"
            >
              <Boat size={20} />
              Book a Trip
            </Link>
            <Link
              href={ROUTES.schedule}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#f59e0b] px-6 py-4 text-base font-semibold text-[#134e4a] shadow-lg shadow-[#f59e0b]/25 hover:bg-[#fbbf24] transition-all duration-200 touch-target active:scale-[0.98] sm:min-h-0"
            >
              <Sun size={20} />
              View Schedule
            </Link>
            <Link
              href={ROUTES.attractions}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border-2 border-[#0c7b93] bg-white/80 px-6 py-4 text-base font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/10 transition-all duration-200 touch-target active:scale-[0.98] sm:min-h-0"
            >
              <Surfboard size={20} />
              Explore Siargao
            </Link>
          </div>
        </div>
      </section>

      {/* Weather (Siargao) - uses NEXT_PUBLIC_OPENWEATHER_API_KEY */}
      <section className="border-t border-teal-200/50 bg-[#fef9e7]/50 py-8 sm:py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="max-w-sm md:max-w-4xl mx-auto">
            <WeatherWidget />
          </div>
          <p className="mt-3 text-center text-sm text-[#0f766e]">
            <Link href={ROUTES.weather} className="font-semibold text-[#0c7b93] hover:underline">Full weather →</Link>
          </p>
        </div>
      </section>

      {/* Feel the island */}
      <section className="border-t border-teal-200/50 bg-white/60 py-10 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-center text-xl font-bold text-[#134e4a] tracking-tight sm:text-2xl md:text-3xl">
            One click away from island time
          </h2>
          <p className="mt-3 max-w-2xl mx-auto text-center text-[#0f766e] text-base sm:mt-4 sm:text-lg">
            We run daily ferries between Siargao, Surigao, and Dinagat. Book your seat online, get your e-ticket, and show up at the pier. No stress—just waves and coconut trees waiting on the other side.
          </p>
          <div className="mt-8 grid gap-6 sm:mt-12 sm:grid-cols-3 sm:gap-8 text-center">
            <div className="rounded-2xl bg-[#fef9e7]/80 p-5 border border-teal-100 sm:p-6">
              <div className="mx-auto w-fit rounded-full bg-[#0c7b93]/10 p-3 sm:p-4">
                <Boat size={28} className="text-[#0c7b93] sm:w-8 sm:h-8" />
              </div>
              <h3 className="mt-2 font-semibold text-[#134e4a] sm:mt-3">Reliable ferries</h3>
              <p className="mt-1 text-sm text-[#0f766e]">Multiple trips daily. Safe, on-time sailings you can count on.</p>
            </div>
            <div className="rounded-2xl bg-[#fef9e7]/80 p-5 border border-teal-100 sm:p-6">
              <div className="mx-auto w-fit rounded-full bg-[#f59e0b]/20 p-3 sm:p-4">
                <Sun size={28} className="text-[#f59e0b] sm:w-8 sm:h-8" />
              </div>
              <h3 className="mt-2 font-semibold text-[#134e4a] sm:mt-3">Easy booking</h3>
              <p className="mt-1 text-sm text-[#0f766e]">Book online, pay via GCash, get your e-ticket with QR code.</p>
            </div>
            <div className="rounded-2xl bg-[#fef9e7]/80 p-5 border border-teal-100 sm:p-6">
              <div className="mx-auto w-fit rounded-full bg-[#0d9488]/20 p-3 sm:p-4">
                <PalmTree size={28} className="text-[#0d9488] sm:w-8 sm:h-8" />
              </div>
              <h3 className="mt-2 font-semibold text-[#134e4a] sm:mt-3">Island gateway</h3>
              <p className="mt-1 text-sm text-[#0f766e]">Your first step to Siargao’s surf, beaches, and sunsets.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust line */}
      <section className="border-t border-teal-200/50 py-6 sm:py-8">
        <div className="mx-auto max-w-4xl px-4 text-center text-[#0f766e] text-xs sm:text-sm sm:px-6">
          Easy online booking &middot; E-ticket with QR code &middot; Siargao &amp; Dinagat routes &middot; Senior, PWD &amp; child discounts
        </div>
      </section>
    </div>
  );
}
