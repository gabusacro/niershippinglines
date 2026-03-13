import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { name, email, phone, inquiry_type, message } = body;

    if (!name || !email || !inquiry_type || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = await createClient();

    const { error } = await supabase.from("inquiries").insert({
      name,
      email,
      phone,
      inquiry_type,
      message,
      status: "pending",
    });

    if (error) throw error;

    await resend.emails.send({
      from: "Travela Siargao <support@travelasiargao.com>",
      to: process.env.SUPPORT_EMAIL!,
      subject: `New Inquiry: ${inquiry_type}`,
      html: `
        <h2>New Inquiry Received</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "-"}</p>
        <p><strong>Type:</strong> ${inquiry_type}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}