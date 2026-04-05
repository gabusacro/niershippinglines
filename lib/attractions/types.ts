export type AttractionType = "attraction" | "video" | "tip" | "news" | "partner";

export type AttractionCategory =
  | "attractions" | "beaches" | "surf" | "food"
  | "events" | "ferry-tips" | "local-life" | "video";

export type LayoutStyle = "standard" | "magazine" | "feature" | "guide";

export type AutoLink = {
  phrase:     string;
  url:        string;
  type:       "internal" | "external";
  occurrence: "first" | "second" | "all";
};

export type Attraction = {
  id:               string;
  title:            string;
  slug:             string;
  description:      string | null;
  image_url:        string | null;
  sort_order:       number;
  is_published:     boolean;
  created_at:       string;
  updated_at:       string;
  category:         AttractionCategory | null;
  cover_gradient:   string | null;
  cover_emoji:      string | null;
  is_live:          boolean;
  is_featured:      boolean;
  read_minutes:     number | null;
  seo_tags:         string[] | null;
  type:             AttractionType;
  layout_style:     LayoutStyle | null;
  auto_links:       AutoLink[] | null;
};

export type AttractionForm = {
  title:          string;
  slug:           string;
  description:    string;
  image_url:      string;
  image_alt:      string;
  category:       AttractionCategory;
  cover_gradient: string;
  cover_emoji:    string;
  is_live:        boolean;
  is_featured:    boolean;
  is_published:   boolean;
  read_minutes:   number;
  seo_tags:       string[];
  type:           AttractionType;
  sort_order:     number;
  layout_style:   LayoutStyle;
  auto_links:     AutoLink[];
};

export const EMPTY_FORM: AttractionForm = {
  title:          "",
  slug:           "",
  description:    "",
  image_url:      "",
  image_alt:      "",
  category:       "attractions",
  cover_gradient: "from-[#085C52] to-[#0c7b93]",
  cover_emoji:    "🌴",
  is_live:        false,
  is_featured:    false,
  is_published:   true,
  read_minutes:   2,
  seo_tags:       [],
  type:           "attraction",
  sort_order:     0,
  layout_style:   "standard",
  auto_links:     [],
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

export const LAYOUT_STYLES: { key: LayoutStyle; label: string; desc: string; icon: string }[] = [
  { key: "standard",  label: "Standard",  desc: "Clean article, sidebar right",         icon: "▤" },
  { key: "magazine",  label: "Magazine",  desc: "3-column editorial like Vulture",       icon: "▦" },
  { key: "feature",   label: "Feature",   desc: "Full-width hero, pull quotes",          icon: "◈" },
  { key: "guide",     label: "Guide",     desc: "Tip cards, how-to sections, checklist", icon: "☰" },
];