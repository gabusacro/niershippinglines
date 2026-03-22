// app/api/admin/attractions/generate-seo/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { title, description, category, mode } = await req.json();

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // ── Mode: enhance — rewrites/improves the existing description ──
    if (mode === "enhance") {
      const prompt = `You are a professional travel writer and SEO expert for Travela Siargao (travelasiargao.com), a ferry booking and travel platform for Siargao Island, Philippines.

Enhance and rewrite this attraction description to make it SEO-friendly, engaging, and informative for tourists planning a trip to Siargao:

Attraction: ${title}
Category: ${category || "attraction"}
Current description: ${description || "(empty — write from scratch based on the title)"}

Rules:
- Write in a warm, inviting travel writing style
- Naturally include "Siargao" and "Siargao Island" 
- Include practical info tourists want: what to expect, best time to visit, what makes it unique
- Be specific and vivid — no generic filler
- Length: 3-5 paragraphs, 150-400 words
- Do NOT use markdown headers or bullet points — pure flowing paragraphs only
- Do NOT start with the attraction name as the first word
- End with a subtle call to action encouraging visitors to book their ferry

Return ONLY the enhanced description text. No JSON, no labels, no markdown.`;

      const message = await anthropic.messages.create({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 800,
        messages:   [{ role: "user", content: prompt }],
      });

      const text = message.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("").trim();

      return NextResponse.json({ description: text });
    }

    // ── Mode: seo (default) — generates tags + short meta description ──
    const prompt = `You are an SEO expert for Travela Siargao (travelasiargao.com), a Philippine travel and ferry booking website for Siargao Island.

Generate SEO content for this Siargao Island attraction:
- Title: ${title}
- Category: ${category || "attraction"}
- Description: ${description || "(none provided yet)"}

Return ONLY valid JSON with NO markdown, NO backticks, NO explanation:
{
  "tags": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6"],
  "description": "2-3 sentence meta description optimized for Google (max 155 chars total)"
}

Rules for tags:
- Phrases tourists actually search on Google
- Include location: "siargao", "siargao island", "philippines"  
- Include year where relevant: "siargao 2026"
- Mix 2-word and 4-5 word long-tail keywords
- All lowercase
- Examples: "siargao tourist spots", "cloud 9 surf break siargao", "island hopping siargao philippines"

Rules for meta description:
- Max 155 characters total
- Include "Siargao" naturally
- Mention what makes it special
- No markdown, no quotes`;

    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages:   [{ role: "user", content: prompt }],
    });

    const text  = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
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
