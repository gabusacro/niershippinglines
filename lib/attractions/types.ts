// lib/attractions/types.ts
// Matches your exact Supabase `attractions` table

export type AttractionType = "attraction" | "video" | "tip" | "news" | "partner";

export type AttractionCategory =
  | "attractions"
  | "beaches"
  | "surf"
  | "food"
  | "events"
  | "ferry-tips"
  | "local-life"
  | "video";

// Matches your exact table columns
export type Attraction = {
  id: string;
  title: string;
  slug: string;
  description: string | null;   // your "tag" / excerpt column
  image_url: string | null;     // your single photo column
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  // ── New columns you just added ──
  category: AttractionCategory | null;
  cover_gradient: string | null;
  cover_emoji: string | null;
  is_live: boolean;
  is_featured: boolean;
  read_minutes: number | null;
  seo_tags: string[] | null;
  type: AttractionType;
};

// Used in the admin form
export type AttractionForm = {
  title: string;
  slug: string;
  description: string;
  image_url: string;
  image_alt: string;
  category: AttractionCategory;
  cover_gradient: string;
  cover_emoji: string;
  is_live: boolean;
  is_featured: boolean;
  is_published: boolean;
  read_minutes: number;
  seo_tags: string[];
  type: AttractionType;
  sort_order: number;
};

export const EMPTY_FORM: AttractionForm = {
  title: "",
  slug: "",
  description: "",
  image_url: "",
  image_alt: "",
  category: "attractions",
  cover_gradient: "from-[#085C52] to-[#0c7b93]",
  cover_emoji: "🌴",
  is_live: false,
  is_featured: false,
  is_published: true,
  read_minutes: 2,
  seo_tags: [],
  type: "attraction",
  sort_order: 0,
};

export const CATEGORIES: { key: string; label: string }[] = [
  { key: "all",         label: "All" },
  { key: "attractions", label: "Attractions" },
  { key: "beaches",     label: "Beaches" },
  { key: "surf",        label: "Surf" },
  { key: "food",        label: "Food" },
  { key: "events",      label: "Events" },
  { key: "ferry-tips",  label: "Ferry tips" },
  { key: "local-life",  label: "Local life" },
  { key: "video",       label: "Videos" },
];

export const GRADIENTS = [
  { label: "Ocean teal",    value: "from-[#085C52] via-[#0c7b93] to-[#1AB5A3]" },
  { label: "Deep jungle",   value: "from-[#04342C] to-[#085C52]" },
  { label: "Sunset amber",  value: "from-[#BA7517] to-[#EF9F27]" },
  { label: "Island purple", value: "from-[#534AB7] to-[#AFA9EC]" },
  { label: "Coral red",     value: "from-[#A32D2D] to-[#E24B4A]" },
  { label: "Reef green",    value: "from-[#1D9E75] to-[#5DCAA5]" },
  { label: "Sky blue",      value: "from-[#0c7b93] to-[#5DCAA5]" },
];
