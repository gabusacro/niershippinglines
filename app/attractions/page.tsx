import Link from "next/link";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { PalmTree, Wave, Sun, Surfboard } from "@/components/icons";
import { getAttractionsFromSupabase } from "@/lib/attractions/get-attractions";
import { AttractionThumbnail } from "./AttractionThumbnail";

export const metadata = {
  title: "Attractions",
  description: `Tourist attractions in Siargao — ${APP_NAME}`,
};

const iconMap = {
  surf: Surfboard,
  wave: Wave,
  palm: PalmTree,
  sun: Sun,
};

const FALLBACK_ATTRACTIONS = [
  { slug: "cloud-9", title: "Cloud 9", short: "World-famous surf break and viewing deck.", description: "Cloud 9 is Siargao's most famous surf break and a must-see even if you don't surf. The wooden viewing deck overlooks the waves and the horizon—perfect for photos and sunset. The break itself hosts international competitions.", icon: "surf" },
  { slug: "magpupungko", title: "Magpupungko Rock Pools", short: "Tidal pools and natural rock formations.", description: "Magpupungko's tidal pools appear at low tide between dramatic rock formations. Swim in crystal-clear pools, jump from rocks, and take in the coastal scenery. Best visited at low tide—check tide times before you go.", icon: "wave" },
  { slug: "sugba-lagoon", title: "Sugba Lagoon", short: "Turquoise lagoon and paddle boards.", description: "A peaceful turquoise lagoon surrounded by mangroves. Rent a kayak or paddleboard, swim, or relax on the floating deck. Often combined with island-hopping tours. A refreshing escape from the open sea.", icon: "palm" },
  { slug: "naked-island", title: "Naked Island", short: "Tiny sandbar island for swimming and sun.", description: "A small strip of white sand with no structures—just sea and sky. Ideal for swimming, snorkeling, and photos. Usually visited as part of a three-island (Naked, Daku, Guyam) tour.", icon: "sun" },
  { slug: "taktak-falls", title: "Taktak Falls", short: "Waterfall and natural pool in the interior.", description: "A short ride from the coast, Taktak Falls offers a freshwater pool and a scenic cascade. Good for a half-day trip when you want a break from the beach. The area is green and quiet.", icon: "palm" },
  { slug: "general-luna", title: "General Luna & Beach Road", short: "Surf town with cafes, shops, and beach vibes.", description: "General Luna is the main tourist hub: surf schools, cafes, restaurants, and beachfront bars. The beach road runs along the coast—rent a motorbike or walk to feel the island pace. Nightlife and day trips start here.", icon: "surf" },
];

export default async function AttractionsPage() {
  const fromDb = await getAttractionsFromSupabase();
  const useDb = fromDb.length > 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 mb-8 sm:mb-10">
        <div className="rounded-full bg-[#0c7b93]/10 p-3 w-fit">
          <PalmTree size={28} className="text-[#0d9488]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#134e4a] sm:text-2xl">Explore Siargao</h1>
          <p className="text-sm text-[#0f766e] sm:text-base">
            {useDb ? "What to see and do on the island. Add or edit attractions in Supabase." : "What to see and do on the island. Add attractions in Supabase to show photos and descriptions here."}
          </p>
        </div>
      </div>

      <div className="grid gap-6 sm:gap-8">
        {useDb
          ? fromDb.map((a) => (
              <article key={a.id} className="rounded-2xl border border-teal-200 bg-white/80 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-4 sm:flex-row sm:gap-4 p-4 sm:p-6 md:p-8">
                  <AttractionThumbnail title={a.title} imageUrl={a.image_url} imageUrls={a.image_urls} />
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-[#134e4a] sm:text-xl">{a.title}</h2>
                    <p className="mt-3 text-[#0f766e] text-xs sm:text-sm leading-relaxed">{a.description ?? ""}</p>
                    <Link href={ROUTES.book} className="mt-4 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-[#0c7b93] hover:underline touch-target py-2">
                      Book your trip to Siargao →
                    </Link>
                  </div>
                </div>
              </article>
            ))
          : FALLBACK_ATTRACTIONS.map((a) => {
              const Icon = iconMap[a.icon as keyof typeof iconMap] ?? PalmTree;
              return (
                <article key={a.slug} className="rounded-2xl border border-teal-200 bg-white/80 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className="flex flex-col gap-4 sm:flex-row sm:gap-4 p-4 sm:p-6 md:p-8">
                    <div className="shrink-0 rounded-xl bg-[#fef9e7] border border-teal-100 p-3 w-fit sm:p-4">
                      <Icon size={28} className="text-[#0c7b93] sm:w-8 sm:h-8" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-[#134e4a] sm:text-xl">{a.title}</h2>
                      <p className="mt-1 font-medium text-[#0f766e] text-sm">{a.short}</p>
                      <p className="mt-3 text-[#0f766e] text-xs sm:text-sm leading-relaxed">{a.description}</p>
                      <Link href={ROUTES.book} className="mt-4 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-[#0c7b93] hover:underline touch-target py-2">
                        Book your trip to Siargao →
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
      </div>

      <div className="mt-10 sm:mt-12 rounded-xl bg-[#fef3c7]/50 border border-teal-100 p-4 sm:p-6 text-center">
        <p className="text-[#134e4a] font-medium text-sm sm:text-base">Ready to go?</p>
        <p className="mt-1 text-xs sm:text-sm text-[#0f766e]">Book your ferry from Surigao to Siargao and start your island adventure.</p>
        <Link href={ROUTES.book} className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[#0c7b93] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] transition-colors touch-target w-full sm:w-auto">
          Book a trip
        </Link>
      </div>
    </div>
  );
}
