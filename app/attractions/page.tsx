// app/attractions/page.tsx
import { APP_NAME, ROUTES } from "@/lib/constants";
import { getAttractionsFromSupabase } from "@/lib/attractions/get-attractions";
import { AttractionsHero } from "./AttractionsHero";
import { AttractionsMosaicClient } from "./AttractionsMosaicClient";

export const metadata = {
  title: "Attractions",
  description: `Tourist attractions in Siargao — ${APP_NAME}`,
};

const FALLBACK_ATTRACTIONS = [
  {
    id: "cloud-9",
    title: "Cloud 9",
    short: "World-famous surf break and viewing deck.",
    description: "Cloud 9 is Siargao's most famous surf break and a must-see even if you don't surf. The wooden viewing deck overlooks the waves and the horizon—perfect for photos and sunset. The break itself hosts international competitions.",
    image_url: "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/Attractions/494421846_1238903398244282_5907375550827324770_n.jpg",
    image_urls: [] as string[],
    category: "Surfing",
  },
  {
    id: "magpupungko",
    title: "Magpupungko Rock Pools",
    short: "Tidal pools and natural rock formations.",
    description: "Magpupungko's tidal pools appear at low tide between dramatic rock formations. Swim in crystal-clear pools, jump from rocks, and take in the coastal scenery. Best visited at low tide—check tide times before you go.",
    image_url: "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/Attractions/magpupungko-rock-pools-siargao-0036.webp",
    image_urls: [] as string[],
    category: "Adventure",
  },
  {
    id: "sugba-lagoon",
    title: "Sugba Lagoon",
    short: "Turquoise lagoon and paddle boards.",
    description: "A peaceful turquoise lagoon surrounded by mangroves. Rent a kayak or paddleboard, swim, or relax on the floating deck. Often combined with island-hopping tours.",
    image_url: "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/Attractions/637396695_1499167005551252_6719252401910291062_n.jpg",
    image_urls: [] as string[],
    category: "Adventure",
  },
  {
    id: "naked-island",
    title: "Naked Island",
    short: "Tiny sandbar island for swimming and sun.",
    description: "A small strip of white sand with no structures—just sea and sky. Ideal for swimming, snorkeling, and photos. Usually visited as part of a three-island (Naked, Daku, Guyam) tour.",
    image_url: "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/Attractions/Naked-Island-Drone-Photo-Siargao-Philippines-728x410.jpg",
    image_urls: [] as string[],
    category: "Islands",
  },
  {
    id: "daku-island",
    title: "Daku Island",
    short: "Largest island-hop stop — white sand and local food.",
    description: "Wide stretches of white sand, calm swimming areas, and traditional meals served by island residents. Beachfront cottages and a relaxed atmosphere give a deeper glimpse into authentic island life.",
    image_url: "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/Attractions/daku-island-siargao-boats-island-hopping.jpg",
    image_urls: [] as string[],
    category: "Islands",
  },
  {
    id: "guyam-island",
    title: "Guyam Island",
    short: "Postcard-perfect tiny island.",
    description: "Powdery white sand, clear shallow waters, and a ring of swaying coconut trees. A raw and unspoiled half-day tropical escape just a short boat ride from General Luna.",
    image_url: "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/Attractions/siargao-tri-island-hopping-daku-guyam-and-naked-island-t847678-8.jpg",
    image_urls: [] as string[],
    category: "Islands",
  },
  {
    id: "sohoton-cove",
    title: "Sohoton Cove",
    short: "Limestone cliffs, emerald lagoons and cave systems.",
    description: "A protected natural area in the Bucas Grande Islands. Explore hidden coves, paddle through crystal-clear waters, and enter caves with stalactites and rock pools.",
    image_url: "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/Attractions/494153329_1238903248244297_3893621105851367722_n.jpg",
    image_urls: [] as string[],
    category: "Adventure",
  },
  {
    id: "alegria-beach",
    title: "Alegria Beach",
    short: "Wide pristine stretch on the northern tip.",
    description: "Shallow calm waters ideal for families. Uninterrupted ocean views with coconut trees lining the shore. Often combined with land tours exploring northern Siargao.",
    image_url: "https://thefroggyadventures.com/wp-content/uploads/2024/10/alegria-beach-siargao-768x960.jpg",
    image_urls: [] as string[],
    category: "Beaches",
  },
  {
    id: "pacifico-beach",
    title: "Pacifico Beach",
    short: "Consistent surf and wide, uncrowded shores.",
    description: "One hour north of General Luna. Consistent surf suitable for beginners and intermediates. Wide panoramic views backed by coconut-lined hills.",
    image_url: "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/Attractions/pacifico-beach-siargao.webp",
    image_urls: [] as string[],
    category: "Surfing",
  },
  {
    id: "maasin-river",
    title: "Maasin River",
    short: "Bamboo rafts and cool freshwater jungle river.",
    description: "Cool, clear freshwater flowing beneath a natural canopy of tall trees. Paddle bamboo rafts, swim in calm pools, or simply relax in the jungle shade.",
    image_url: "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/Attractions/maasin-river-jumping-platform-768x576.jpg",
    image_urls: [] as string[],
    category: "Rivers & Caves",
  },
  {
    id: "tayangban-cave",
    title: "Tayangban Cave Pool",
    short: "Limestone corridors and a naturally lit cave pool.",
    description: "River passages and limestone corridors open into a naturally lit cave pool perfect for swimming. Often paired with Magpupungko.",
    image_url: "https://thefroggyadventures.com/wp-content/uploads/2025/01/tayangban-cave-pool-siargao-exit-natural-pool-768x576.jpg",
    image_urls: [] as string[],
    category: "Rivers & Caves",
  },
  {
    id: "corregidor-island",
    title: "Corregidor Island",
    short: "Rolling hills, rocky cliffs and Pacific panoramas.",
    description: "Also known as Casolian Island. Hike to elevated viewpoints, explore quiet shorelines, or enjoy untouched landscapes shaped by wind and waves.",
    image_url: "https://thefroggyadventures.com/wp-content/uploads/2025/01/corregidor-island-siargao-aerial-768x576.jpg",
    image_urls: [] as string[],
    category: "Adventure",
  },
  {
    id: "secret-beach",
    title: "Secret Beach (Malinao)",
    short: "Tucked-away coastal gem near General Luna.",
    description: "Accessible by motorbike then a short path. Soft sand, clear water, minimal crowds. A peaceful alternative for travelers seeking solitude.",
    image_url: "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/Attractions/636331291_1499190298882256_3094040769713568987_n.jpg",
    image_urls: [] as string[],
    category: "Beaches",
  },
];

export default async function AttractionsPage() {
  const fromDb = await getAttractionsFromSupabase();
  const attractions = fromDb.length > 0 ? fromDb : FALLBACK_ATTRACTIONS;
  const usingDb = fromDb.length > 0;

  return (
    <div className="min-h-screen bg-[#f7f3eb]">
      <AttractionsHero
        imageUrls={attractions.flatMap(a =>
          a.image_urls?.length ? a.image_urls : a.image_url ? [a.image_url] : []
        ).slice(0, 10)}
        subtitle={usingDb
          ? "What to see and do on the island. Click any card to explore."
          : "What to see and do on the island. Add attractions in Supabase to show photos here."}
      />

      {/* Mosaic grid */}
      <AttractionsMosaicClient attractions={attractions} />
    </div>
  );
}
