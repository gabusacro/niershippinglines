import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized", reason: "no_user" }, { status: 401 });

  const allowedRoles = ["admin", "parking_owner", "parking_crew"];
  if (!allowedRoles.includes(user.role as string))
    return NextResponse.json({ error: "Access denied.", role: user.role }, { status: 403 });

  const path = request.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path is required." }, { status: 400 });

  const bucket = path.startsWith("parking-photos/") ? "parking-photos" : "parking-docs";

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl)
    return NextResponse.json({ error: "Could not generate preview URL." }, { status: 500 });

  return NextResponse.json({ url: data.signedUrl });
}