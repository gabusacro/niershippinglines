import { createClient } from "@/lib/supabase/server";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
}

export async function getFaqs(): Promise<FaqItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faqs")
    .select("id, question, answer, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error || !data) return [];
  return data as FaqItem[];
}
