// app/stories/page.tsx
// Drop this into your Next.js app router.
// Replace the `stories` prop with a real Supabase fetch when ready.

import { SiargaoStoriesPage } from "@/components/stories/SiargaoStoriesPage";

export const metadata = {
  title: "Siargao Stories — News, Events & Island Life | Travela Siargao",
  description:
    "Latest news, events, ferry tips and local guides from Siargao Island. " +
    "Written by locals — surf updates, restaurant reviews, beach discoveries and more.",
  keywords: [
    "siargao news 2026",
    "siargao events",
    "siargao travel guide",
    "cloud 9 siargao",
    "surigao to siargao ferry",
    "things to do siargao",
    "siargao tourist spots",
    "siargao island life",
  ],
  openGraph: {
    title: "Siargao Stories — Live from the Island",
    description: "News, events & travel tips from locals who live here.",
    url: "https://www.travelasiargao.com/stories",
    siteName: "Travela Siargao",
    type: "website",
  },
};

export default function StoriesPage() {
  // 🔁 Replace with your Supabase fetch:
  // const stories = await supabase.from("stories").select("*").order("published_at", { ascending: false });

  return <SiargaoStoriesPage />;
}
