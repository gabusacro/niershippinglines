import { NextResponse } from "next/server";
import { getActiveAnnouncements } from "@/lib/announcements/get-announcements";

/** GET: Public list of active announcements (Schedule, Book pages). */
export async function GET() {
  const announcements = await getActiveAnnouncements();
  return NextResponse.json(announcements);
}
