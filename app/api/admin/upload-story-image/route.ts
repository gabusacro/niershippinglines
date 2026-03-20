// app/api/admin/upload-story-image/route.ts
// Handles image upload → WebP compression → AI alt text generation → Supabase storage

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

// sharp must be installed: npm install sharp
// @anthropic-ai/sdk must be installed: npm install @anthropic-ai/sdk

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const storyTitle = formData.get("title") as string ?? "";
    const category = formData.get("category") as string ?? "general";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // ── 1. Read file buffer ──────────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // ── 2. Convert + compress with sharp ────────────────────────────────────
    // Dynamic import so the server doesn't break if sharp isn't installed yet
    const sharp = (await import("sharp")).default;

    const webpBuffer = await sharp(inputBuffer)
      .resize({ width: 1200, withoutEnlargement: true }) // max 1200px wide
      .webp({ quality: 82 })                             // good quality/size balance
      .toBuffer();

    const originalKB  = Math.round(inputBuffer.byteLength  / 1024);
    const compressedKB = Math.round(webpBuffer.byteLength / 1024);

    // ── 3. Generate SEO filename from title ──────────────────────────────────
    const slug = storyTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60);

    const timestamp = Date.now();
    const filename  = `${slug || category}-siargao-${timestamp}.webp`;
    const storagePath = `stories/${filename}`;

    // ── 4. Upload to Supabase storage ────────────────────────────────────────
    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from("story-images")
      .upload(storagePath, webpBuffer, {
        contentType: "image/webp",
        cacheControl: "31536000", // 1 year cache
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError.message);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const { data: publicData } = supabase.storage
      .from("story-images")
      .getPublicUrl(storagePath);

    const publicUrl = publicData.publicUrl;

    // ── 5. Generate alt text with Claude AI ──────────────────────────────────
    let altText = `${storyTitle} — Siargao Island, Philippines`;
    let seoTags: string[] = [];

    try {
      const anthropic = new Anthropic();
      // Convert buffer to base64 for the API
      const base64Image = webpBuffer.toString("base64");

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/webp",
                  data: base64Image,
                },
              },
              {
                type: "text",
                text: `You are writing SEO metadata for a travel website about Siargao Island, Philippines.

The story title is: "${storyTitle}"
The category is: "${category}"

Please respond with ONLY a JSON object (no markdown, no backticks) in this exact format:
{
  "alt": "A concise, descriptive alt text under 120 characters. Include 'Siargao' and relevant location or activity terms.",
  "tags": ["tag1", "tag2", "tag3", "tag4"]
}

The tags should be 3-5 SEO keyword phrases that a tourist searching for Siargao would type into Google.`,
              },
            ],
          },
        ],
      });

      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");

      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      altText = parsed.alt ?? altText;
      seoTags = parsed.tags ?? [];
    } catch (aiError) {
      // Alt text generation is non-critical — we still return the uploaded image
      console.warn("AI alt text generation failed:", aiError);
    }

    // ── 6. Return everything to the admin panel ──────────────────────────────
    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
      alt: altText,
      tags: seoTags,
      compression: {
        original_kb: originalKB,
        compressed_kb: compressedKB,
        saved_percent: Math.round((1 - compressedKB / originalKB) * 100),
      },
    });
  } catch (err) {
    console.error("Upload route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


