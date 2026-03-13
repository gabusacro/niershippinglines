import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const body = await req.json();

  const { name, email, phone, inquiry_type, message } = body;

  const { error } = await supabase
    .from("inquiries")
    .insert([
      {
        name,
        email,
        phone,
        inquiry_type,
        message,
      },
    ]);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Database insert failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}