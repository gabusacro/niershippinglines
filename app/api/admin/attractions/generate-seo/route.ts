// app/api/admin/attractions/generate-seo/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { title, description, category } = await req.json();

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const prompt = `You are an SEO expert for a Philippine travel and ferry booking website called Travela Siargao (travelasiargao.com).

Generate SEO content for this Siargao Island attraction listing:
- Title: ${title}
- Category: ${category || "attraction"}
- Description: ${description || "(none provided yet)"}

Return ONLY a valid JSON object with NO markdown, NO backticks, NO explanation. Just raw JSON:
{
  "tags": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6"],
  "description": "2-3 sentence description optimized for Google (max 155 chars)"
}

Rules for tags:
- Use phrases tourists actually search on Google
- Include location modifiers: "siargao", "siargao island", "philippines"
- Include year where relevant: "siargao 2026"
- Mix short (2 words) and long-tail (4-5 words) keywords
- All lowercase
- Examples: "siargao tourist spots", "cloud 9 surf break siargao", "island hopping siargao philippines"

Rules for description:
- Max 155 characters
- Include "Siargao" naturally
- Mention what makes it special
- End with a call to action or unique detail
- No markdown, no quotes`;

    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages:   [{ role: "user", content: prompt }],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // Strip any accidental markdown fences
    const clean = text.replace(/```json|```/g, "").trim();
    const data  = JSON.parse(clean);

    return NextResponse.json({
      tags:        data.tags        ?? [],
      description: data.description ?? "",
    });
  } catch (err) {
    console.error("[generate-seo]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
