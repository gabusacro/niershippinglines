import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// -----------------------------
// Helpers
// -----------------------------

function extractText(content: any): string {
  return content?.find?.((b: any) => b.type === "text")?.text?.trim?.() ?? "";
}

function stripCodeFences(text: string) {
  return text.replace(/```json|```/g, "").trim();
}

/**
 * Cleans rough admin title/note so AI doesn't treat command-like text as final title.
 * Example:
 * "It was an amazing experience on the SOHOTON Foodie Boodle Fight, make short description no food names..."
 * becomes a cleaner context for generation.
 */
function cleanPromptContext(input?: string) {
  if (!input) return "";

  return input
    .replace(/\s+/g, " ")
    .replace(/make short description/gi, "")
    .replace(/no food names/gi, "")
    .replace(/just amazing people and food/gi, "")
    .replace(/write description/gi, "")
    .trim();
}

/**
 * Optional auto-linking support:
 * Converts specific phrases into HTML anchor tags.
 * Only do this if your frontend renders description with HTML safely.
 */
function autoLinkDescription(text: string) {
  if (!text) return text;

  const rules = [
    {
      phrase: "Siargao Island",
      url: "https://www.travelasiargao.com/",
      internal: true,
    },
    {
      phrase: "Sohoton Cove",
      url: "https://www.travelasiargao.com/attractions/sohoton-cove",
      internal: true,
    },
    {
      phrase: "Sohoton",
      url: "https://www.travelasiargao.com/attractions/sohoton-cove",
      internal: true,
    },
  ];

  let output = text;

  for (const rule of rules) {
    const escaped = rule.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Replace ONLY first occurrence, case-insensitive
    const regex = new RegExp(`\\b(${escaped})\\b`, "i");

    output = output.replace(regex, (match) => {
      return `<a href="${rule.url}" ${
        rule.internal ? "" : `target="_blank" rel="noopener noreferrer"`
      }>${match}</a>`;
    });
  }

  return output;
}

export async function POST(req: NextRequest) {
  try {
    const { title, description, category, mode, enableLinks } = await req.json();

    const safeTitle = cleanPromptContext(title);
    const safeDescription = (description || "").trim();

    // =========================================================
    // MODE: enhance
    // Rewrites attraction description safely + naturally
    // =========================================================
    if (mode === "enhance") {
      const msg = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 700,
        temperature: 0.4,
        messages: [
          {
            role: "user",
            content: `You are a controlled content rewriter for travelasiargao.com, a Siargao Island travel website.

Your job is to rewrite rough attraction notes into a clean, natural, tourism-friendly description.

IMPORTANT:
You are NOT allowed to invent facts, scenery, objects, food names, physical setup, emotions, conversations, traditions, or first-hand experiences unless clearly stated in the user's notes.

You must stay CLOSE to the actual meaning of the input.

ITEM INFO:
Title / rough idea: ${safeTitle || "(none provided)"}
Category: ${category || "Attraction"}
User notes: ${safeDescription || "(no notes provided)"}

WRITING RULES:
- Rewrite ONLY from the meaning of the user's input
- Do NOT hallucinate or add visual details not clearly implied
- Do NOT pretend you were there
- Do NOT use first-person claims like:
  - "I've seen"
  - "I've watched"
  - "I remember"
  - "locals say"
  - "you'll never forget"
- Keep it grounded, simple, warm, and human
- Focus on what travelers would realistically enjoy:
  - the people
  - the experience
  - the atmosphere
  - the place's significance in Siargao
- If food is mentioned but user says "no food names", then mention shared meal / local feast / boodle fight only in general
- Mention Siargao or Sohoton naturally if relevant
- No fake poetic storytelling
- No dramatic brochure language
- No bullet points
- No headers
- 1–2 short paragraphs only
- Target: 70–120 words
- Make it feel real, readable, and website-ready

VERY IMPORTANT SAFETY RULE:
If the user's input is vague, write conservatively.
It is better to be simple than to invent details.

GOOD OUTPUT EXAMPLE STYLE:
"Sohoton’s boodle fight is one of those simple but memorable experiences that brings people together after the adventure. Sharing a meal here feels more special because of the atmosphere, the company, and the feeling of enjoying Siargao with others. It’s not just about the food, but about the laughter, stories, and connection that make the moment worth remembering."

BAD OUTPUT STYLE:
"The moment you settle down on woven mats..."
"I've watched countless travelers..."
"Magical happens..."
"Legendary feast spread..."

Return ONLY the rewritten description text. No intro. No labels. No quotes.`,
          },
        ],
      });

      let text = extractText(msg.content);

      if (enableLinks) {
        text = autoLinkDescription(text);
      }

      return NextResponse.json({ description: text.trim() });
    }

    // =========================================================
    // MODE: title
    // Generates short public-facing title from rough input
    // =========================================================
    if (mode === "title") {
      const msg = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 80,
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: `Generate a SHORT public title for a Siargao attraction/discover page.

INPUT:
Category: ${category || "Attraction"}
Current rough title: ${safeTitle || "(none)"}
Description: ${safeDescription.slice(0, 250) || "(none)"}

RULES:
- 3 to 7 words only
- Clean, public-facing title
- Must NOT sound like an instruction/prompt
- Remove admin-style wording like "make short description"
- Specific if place is obvious
- No quotation marks
- No emoji
- No punctuation at the end
- Natural for website visitors and Google

GOOD EXAMPLES:
- Sohoton Foodie Boodle Fight
- Shared Lunch at Sohoton
- Sohoton Group Dining Experience
- Sohoton Island Food Experience

Return ONLY the title.`,
          },
        ],
      });

      const text = extractText(msg.content);
      return NextResponse.json({ title: text.trim() });
    }

    // =========================================================
    // MODE: seo
    // Generates tags + meta description
    // =========================================================
    if (mode === "seo") {
      const msg = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: `You are an SEO assistant for travelasiargao.com, a Siargao Island travel website.

Generate SEO data for this attraction.

INPUT:
Title: ${safeTitle || "(none)"}
Category: ${category || "Attraction"}
Context: ${safeDescription.slice(0, 300) || "Siargao Island tourist attraction"}

Return ONLY valid JSON in this exact format:
{
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
  "description": "meta description here"
}

RULES FOR TAGS:
- Exactly 6 tags
- Lowercase only
- Real tourist search phrases
- Mix of:
  - location-based
  - activity-based
  - attraction-based
  - year-based if useful
- No hashtags
- No duplicate meaning

RULES FOR DESCRIPTION:
- 120 to 155 characters ONLY
- Must sound natural in Google search
- Must mention Siargao or Sohoton if relevant
- Must be specific
- Must encourage clicks
- No keyword stuffing
- No fake claims

Return ONLY JSON.`,
          },
        ],
      });

      const raw = extractText(msg.content) || "{}";
      const clean = stripCodeFences(raw);

      try {
        const parsed = JSON.parse(clean);

        if (parsed.description && parsed.description.length > 155) {
          parsed.description = parsed.description.slice(0, 152) + "...";
        }

        return NextResponse.json({
          tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [],
          description: parsed.description || "",
        });
      } catch {
        return NextResponse.json({ tags: [], description: "" });
      }
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  } catch (err: any) {
    console.error("[generate-seo]", err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}