// app/api/admin/attractions/generate-seo/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { title, description, category, mode } = await req.json();

    // ── Mode: enhance — rewrites description in storytelling + practical style ──
    if (mode === "enhance") {
      const msg = await client.messages.create({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `You are writing content for travelasiargao.com, a local Siargao Island travel website run by someone who lives on the island.

Rewrite this attraction description for "${title}" (category: ${category}).

Original notes: ${description || "(no notes provided — write from general knowledge about this Siargao attraction)"}

Writing style rules:
- Mix personal storytelling WITH practical travel info — like a local friend who has actually been there giving you the real story
- Start with a vivid moment or sensory detail that pulls the reader in (e.g. "The first time you see Cloud 9 at sunrise...")
- Include at least one practical tip (best time to visit, what to bring, how to get there via travel and tour and vehicle rentals , dont mention cost)
- Warm, conversational, genuine — NOT a formal travel brochure
- First-person perspective or "you" perspective is great humble and relatable and engaging or enticing
- Reference Siargao naturally — this is for people who are already planning to visit
- Length: 1-3 paragraphs, around 120-155 words total
- Do NOT use headers or bullet points — flowing paragraphs only
- End with something that makes the reader feel they absolutely must go

Return ONLY the rewritten description text. No intro, no label, no quotes around it.`,
        }],
      });

      const text = msg.content.find((b) => b.type === "text")?.text ?? "";
      return NextResponse.json({ description: text.trim() });
    }

    // ── Mode: seo — generates keyword tags + short meta description ──────────
 
 
 

        if (mode === "title") {
          const msg = await client.messages.create({
            model:      "claude-sonnet-4-20250514",
            max_tokens: 100,
            messages: [{
              role: "user",
              content: `Generate a short, catchy title for a Siargao Island discover item.
        Type: ${category}
        Current title: ${title || "(none)"}
        Description: ${description?.slice(0, 200) || "(none)"}

        Rules:
        - Max 6 words
        - Specific to Siargao — mention the place name if known
        - Engaging and descriptive
        - No quotes, no punctuation at end
        - Examples: "Cloud 9 Surf Break", "Naked Island Paradise", "Maasin River Adventure"

        Return ONLY the title text, nothing else.`,
            }],
          });
          const text = msg.content.find((b) => b.type === "text")?.text ?? "";
          return NextResponse.json({ title: text.trim() });
        }

 
 
 
 
 
 
 
 
 
    if (mode === "seo") {
      const msg = await client.messages.create({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `You are an SEO expert for travelasiargao.com, a Siargao Island travel website in the Philippines.

Generate SEO data for the attraction: "${title}" (category: ${category})
Context: ${description?.slice(0, 300) || "Siargao Island tourist attraction"}

Return ONLY valid JSON in this exact format, nothing else:
{
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
  "description": "One or two sentences max, 120-155 characters total, written to make someone click in Google search results. Mention Siargao and be specific about what makes this place special."
}

Rules for tags:
- 6 tags total
- Mix of: location-based ("siargao island"), activity-based ("surfing in siargao"), question-based ("best beaches siargao"), year-based ("siargao 2026")
- Phrases real tourists type into Google
- Lowercase only

Rules for description:
- MAXIMUM 155 characters — count carefully
- Specific and enticing — not generic
- Must mention Siargao`,
        }],
      });

      const raw  = msg.content.find((b) => b.type === "text")?.text ?? "{}";
      const clean = raw.replace(/```json|```/g, "").trim();

      try {
        const parsed = JSON.parse(clean);
        // Hard cap meta description at 155 chars
        if (parsed.description && parsed.description.length > 155) {
          parsed.description = parsed.description.slice(0, 152) + "...";
        }
        return NextResponse.json(parsed);
      } catch {
        return NextResponse.json({ tags: [], description: "" });
      }
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });

  } catch (err: any) {
    console.error("[generate-seo]", err);
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}
