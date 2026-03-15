import { getTripManifestData } from "@/lib/admin/trip-manifest";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/trip-manifest?trip_id=xxx
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Allow admin, crew, captain, ticket_booth
  const allowed = ["admin", "captain", "crew", "ticket_booth"];
  if (!allowed.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tripId = searchParams.get("trip_id");
  if (!tripId) return NextResponse.json({ error: "trip_id required" }, { status: 400 });

  const manifest = await getTripManifestData(tripId);
  if (!manifest) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  return NextResponse.json(manifest);
}
