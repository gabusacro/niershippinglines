// app/api/admin/upload-attraction/route.ts
// Upload image → WebP compress → SEO rename → Supabase storage → AI alt text

import { NextRequest, NextResponse } from "next/server";

// ✅ Tells Vercel to allow up to 60s and larger payloads
export const maxDuration = 60;
export const dynamic     = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file     = formData.get("file") as File | null;
    const title    = (formData.get("title")    as string) ?? "";
    const category = (formData.get("category") as string) ?? "attraction";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // ── 1. Read buffer ───────────────────────────────────────────────────────
    const inputBuffer = Buffer.from(await file.arrayBuffer());

    // ── 2. Convert + compress with sharp ────────────────────────────────────
    // ✅ Panorama fix: cap at 1920px wide (handles wide panoramas gracefully)
    // ✅ Also cap height at 1200px so tall portrait shots don't bloat either
    const sharp = (await import("sharp")).default;

    const metadata   = await sharp(inputBuffer).metadata();
    const isPanorama = metadata.width && metadata.height
      ? metadata.width / metadata.height > 2.5
      : false;

    const webpBuffer = await sharp(inputBuffer)
      .resize({
        width:              isPanorama ? 1920 : 1400,
        height:             isPanorama ? 800  : 1200,
        fit:                isPanorama ? "inside" : "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();

    const originalKB   = Math.round(inputBuffer.byteLength / 1024);
    const compressedKB = Math.round(webpBuffer.byteLength / 1024);

    // ── 3. SEO filename from title ───────────────────────────────────────────
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 55);
    const filename    = `${base || category}-siargao-${Date.now()}.webp`;

    // ── 4. Upload to Supabase storage ────────────────────────────────────────
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { error: uploadError } = await supabase.storage
      .from("Attractions")
      .upload(filename, webpBuffer, {
        contentType:  "image/webp",
        cacheControl: "31536000",
        upsert:       false,
      });

    if (uploadError) {
      console.error("[upload-attraction] Storage:", uploadError.message);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicData } = supabase.storage
      .from("Attractions")
      .getPublicUrl(filename);

    const publicUrl = publicData.publicUrl;

    // ── 5. AI alt text via Claude ────────────────────────────────────────────
    let altText = `${title || "Siargao Island attraction"} — Philippines`;
    let seoTags: string[] = [];

    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const anthropic  = new Anthropic();
      const b64        = webpBuffer.toString("base64");

      const response = await anthropic.messages.create({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/webp", data: b64 },
            },
            {
              type: "text",
              text: `You are writing SEO image metadata for travelasiargao.com — a local travel booking website for Siargao Island, Philippines.

Post title: "${title}"
Category: "${category}"

Respond ONLY with valid JSON — no markdown, no backticks, nothing else:
{
  "alt": "Descriptive alt text under 120 characters. Must mention Siargao and describe what is visible in the photo.",
  "tags": ["keyword phrase 1", "keyword phrase 2", "keyword phrase 3", "keyword phrase 4"]
}

Tags should be 3-5 word phrases that Filipino and international tourists search when looking for Siargao content.`,
            },
          ],
        }],
      });

      const raw    = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("");
      const parsed = JSON.parse(raw.trim());
      altText      = parsed.alt  ?? altText;
      seoTags      = parsed.tags ?? [];
    } catch (aiErr) {
      console.warn("[upload-attraction] AI alt text skipped:", aiErr);
    }

    // ── 6. Return to admin form ──────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      url:      publicUrl,
      filename,
      alt:      altText,
      tags:     seoTags,
      compression: {
        original_kb:   originalKB,
        compressed_kb: compressedKB,
        saved_percent: Math.round((1 - compressedKB / originalKB) * 100),
      },
    });

  } catch (err) {
    console.error("[upload-attraction] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
