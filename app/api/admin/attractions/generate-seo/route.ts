import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function extractText(content: any): string {
  return content?.find?.((b: any) => b.type === "text")?.text?.trim?.() ?? "";
}

function stripCodeFences(text: string) {
  return text.replace(/```json|```/g, "").trim();
}

function cleanPromptContext(input?: string) {
  if (!input) return "";
  return input.replace(/\s+/g, " ").replace(/make short description/gi, "")
    .replace(/no food names/gi, "").replace(/just amazing people and food/gi, "")
    .replace(/write description/gi, "").trim();
}

function applyAutoLinks(html: string, links: { phrase: string; url: string; type: string; occurrence: string }[]): string {
  if (!links?.length) return html;
  let output = html;
  for (const rule of links) {
    if (!rule.phrase || !rule.url) continue;
    const escaped = rule.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const isExternal = rule.type === "external";
    const href = isExternal
      ? (rule.url.startsWith("http") ? rule.url : `https://${rule.url}`)
      : (rule.url.startsWith("/") ? rule.url : `/${rule.url}`);
    const attrs = isExternal ? ` target="_blank" rel="noopener noreferrer"` : "";
    const replacement = `<a href="${href}"${attrs} style="color:#0c7b93;text-decoration:underline">$1</a>`;

    if (rule.occurrence === "all") {
      output = output.replace(new RegExp(`\\b(${escaped})\\b`, "gi"), replacement);
    } else if (rule.occurrence === "second") {
      let count = 0;
      output = output.replace(new RegExp(`\\b(${escaped})\\b`, "gi"), (match, p1) => {
        count++;
        return count === 2 ? replacement.replace("$1", p1) : match;
      });
    } else {
      // first occurrence only
      output = output.replace(new RegExp(`\\b(${escaped})\\b`, "i"), replacement);
    }
  }
  return output;
}

// Wraps content in layout-specific HTML blocks
function applyLayoutStyle(html: string, layoutStyle: string, title: string): string {
  if (layoutStyle === "guide") {
    // Split on h2 tags and rebuild — avoids the /s regex flag
    const parts = html.split(/(<h2>.*?<\/h2>)/i);
    return parts.map((part, i) => {
      const h2Match = part.match(/^<h2>(.*?)<\/h2>$/i);
      if (h2Match) {
        const heading = h2Match[1];
        const nextPart = parts[i + 1] ?? "";
        const pMatch = nextPart.match(/^(<p>[\s\S]*?<\/p>)/i);
        const content = pMatch ? pMatch[1] : "";
        return `<div style="border-left:4px solid #1AB5A3;background:#F0FDF8;border-radius:0 12px 12px 0;padding:16px 20px;margin:24px 0">
          <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#085C52;margin-bottom:6px">${heading}</p>
          ${content}
        </div>`;
      }
      // Skip p tags that were already consumed above
      if (i > 0) {
        const prevPart = parts[i - 1] ?? "";
        if (/^<h2>.*?<\/h2>$/i.test(prevPart)) return "";
      }
      return part;
    }).join("");
  }

  if (layoutStyle === "feature") {
    return html.replace(/(<p>[\s\S]*?<\/p>)/i, `$1
      <blockquote style="border-left:3px solid #0c7b93;margin:28px 0;padding:16px 24px;font-size:20px;font-weight:700;color:#085C52;font-style:italic;background:#F0F9FF;border-radius:0 12px 12px 0">
        "${title} is one of Siargao's must-see experiences."
      </blockquote>`);
  }

  if (layoutStyle === "magazine") {
    return html.replace(/<h2>(.*?)<\/h2>/i, `
      <div style="display:flex;align-items:center;gap:12px;margin:32px 0 16px">
        <span style="width:32px;height:3px;background:#1AB5A3;border-radius:2px;display:inline-block"></span>
        <h2 style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;color:#085C52;margin:0">$1</h2>
      </div>`);
  }

  return html;
}

export async function POST(req: NextRequest) {
  try {
    const { title, description, category, mode, enableLinks, autoLinks, layoutStyle } = await req.json();
    const safeTitle       = cleanPromptContext(title);
    const safeDescription = (description || "").trim();

    // ── MODE: full ────────────────────────────────────────────────────────────
    if (mode === "full") {
      const msg = await client.messages.create({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: `You are an SEO content writer for travelasiargao.com, a Siargao Island ferry booking and travel website.

Write a complete, rankable attraction page. Return ONLY valid HTML — no markdown, no code fences, no preamble.

ATTRACTION: ${safeTitle}
CATEGORY: ${category || "attraction"}
ADMIN NOTES: ${safeDescription || "none"}

OUTPUT FORMAT — use these exact HTML tags:

<h2>What is ${safeTitle}?</h2>
<p>[2 paragraphs. What it is, where on Siargao Island, why tourists visit. Mention the attraction name, Siargao Island, and nearest municipality naturally.]</p>

<h2>What to Expect</h2>
<p>[2 paragraphs. The actual experience. What visitors see, do, feel. Stay grounded — no invented facts beyond what admin notes say.]</p>

<h2>How to Get There</h2>
<p>[1 paragraph. From Dapa Port or General Luna. Mention that visitors can book their Surigao City to Siargao ferry at travelasiargao.com naturally.]</p>

<h2>Best Time to Visit</h2>
<p>[1 paragraph. Time of day, season, tide if applicable.]</p>

<h2>Tips Before You Go</h2>
<p>[3-4 practical tips as sentences. What to bring, fees, rules, what to expect.]</p>

RULES:
- Total 500-700 words
- Warm, readable, tourism-friendly tone
- NO invented facts beyond admin notes
- NO first-person claims
- NO bullet points — prose only
- Mention Siargao Island naturally 2-3 times
- Mention ferry from Surigao City once
- End tips section with sentence about booking ferry via Travela Siargao

Return ONLY the HTML content. Nothing else.`,
        }],
      });

      let html = extractText(msg.content);
      // Clean any accidental markdown
      html = html.replace(/```html|```/g, "").trim();
      // Apply auto-links if provided
      if (autoLinks?.length) html = applyAutoLinks(html, autoLinks);
      // Apply layout styling
      if (layoutStyle && layoutStyle !== "standard") html = applyLayoutStyle(html, layoutStyle, safeTitle);

      return NextResponse.json({ fullDescription: html });
    }

    // ── MODE: enhance ─────────────────────────────────────────────────────────
    if (mode === "enhance") {
      const msg = await client.messages.create({
        model:       "claude-sonnet-4-20250514",
        max_tokens:  700,
        messages: [{
          role: "user",
          content: `You are a controlled content rewriter for travelasiargao.com.

Rewrite rough attraction notes into clean, natural, tourism-friendly description HTML.

ITEM: ${safeTitle || "(none)"}
CATEGORY: ${category || "Attraction"}
NOTES: ${safeDescription || "(none)"}

RULES:
- Return ONLY HTML paragraphs using <p> tags
- No invented facts
- No first-person claims
- Warm, grounded tone
- 70-120 words
- Mention Siargao naturally if relevant

Return ONLY the HTML. No intro. No labels.`,
        }],
      });

      let text = extractText(msg.content).replace(/```html|```/g, "").trim();
      if (enableLinks && autoLinks?.length) text = applyAutoLinks(text, autoLinks);
      return NextResponse.json({ description: text });
    }

    // ── MODE: title ───────────────────────────────────────────────────────────
    if (mode === "title") {
      const msg = await client.messages.create({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 80,
        messages: [{
          role: "user",
          content: `Generate a SHORT public title for a Siargao attraction page.
Category: ${category || "Attraction"}
Rough title: ${safeTitle || "(none)"}
Description: ${safeDescription.slice(0, 250) || "(none)"}

RULES: 3-7 words, clean, public-facing, no quotes, no emoji, no punctuation at end.
Return ONLY the title.`,
        }],
      });
      return NextResponse.json({ title: extractText(msg.content).trim() });
    }

    // ── MODE: seo ─────────────────────────────────────────────────────────────
    if (mode === "seo") {
      const msg = await client.messages.create({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `SEO assistant for travelasiargao.com Siargao Island travel website.

INPUT:
Title: ${safeTitle || "(none)"}
Category: ${category || "Attraction"}
Context: ${safeDescription.slice(0, 300) || "Siargao Island tourist attraction"}

Return ONLY valid JSON:
{
  "tags": ["tag1","tag2","tag3","tag4","tag5","tag6"],
  "description": "meta description here"
}

Tags: exactly 6, lowercase, real tourist search phrases, no hashtags.
Description: 120-155 chars, natural, specific, click-worthy.
Return ONLY JSON.`,
        }],
      });

      const raw    = extractText(msg.content) || "{}";
      const clean  = stripCodeFences(raw);
      try {
        const parsed = JSON.parse(clean);
        if (parsed.description?.length > 155) parsed.description = parsed.description.slice(0, 152) + "...";
        return NextResponse.json({
          tags:        Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [],
          description: parsed.description || "",
        });
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