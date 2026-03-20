// app/attractions/page.tsx
// REPLACE your existing attractions page with this file

import { getAttractions } from "@/lib/attractions/get-attractions";
import { ExploreDiscoverPage } from "@/components/attractions/ExploreDiscoverPage";

export const metadata = {
  title: "Explore & Discover Siargao — Attractions, Beaches & Local Tips | Travela Siargao",
  description:
    "Discover the best of Siargao Island — tourist spots, surf breaks, hidden beaches, " +
    "local food, events and travel tips. Written and updated by locals.",
  keywords: [
    "siargao tourist spots",
    "things to do in siargao",
    "siargao beaches",
    "cloud 9 siargao",
    "siargao travel guide 2026",
    "siargao island attractions",
    "siargao events",
    "explore siargao",
  ],
  openGraph: {
    title: "Explore & Discover Siargao",
    description: "Attractions, beaches, surf, food and local tips — updated by locals.",
    url: "https://www.travelasiargao.com/attractions",
    siteName: "Travela Siargao",
    type: "website",
  },
};

export default async function AttractionsPage() {
  const items = await getAttractions();
  return <ExploreDiscoverPage items={items} />;
}
