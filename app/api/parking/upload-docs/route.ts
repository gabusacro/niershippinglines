import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Must be logged in." }, { status: 401 });

  try {
    const formData = await request.formData();
    const orCrFile     = formData.get("or_cr")       as File | null;
    const idPhotoFile  = formData.get("id_photo")    as File | null;
    const vehicleIndex = formData.get("vehicle_index") as string;
    const plateNumber  = (formData.get("plate_number") as string ?? "unknown").replace(/\s/g, "-");

    if (!orCrFile)    return NextResponse.json({ error: "OR/CR photo is required." }, { status: 400 });
    if (!idPhotoFile) return NextResponse.json({ error: "ID photo is required." }, { status: 400 });

    const supabase = await createClient();
    const ts       = Date.now();
    const folder   = `parking-docs/${user.id}/${plateNumber}-v${vehicleIndex}-${ts}`;

    // Upload OR/CR
    const orCrExt  = orCrFile.name.split(".").pop() ?? "jpg";
    const orCrPath = `${folder}/or-cr.${orCrExt}`;
    const { error: orCrErr } = await supabase.storage
      .from("parking-docs")
      .upload(orCrPath, orCrFile, { upsert: true, contentType: orCrFile.type });

    if (orCrErr) {
      console.error("[parking/upload-docs] OR/CR upload:", orCrErr.message);
      return NextResponse.json({ error: "OR/CR upload failed: " + orCrErr.message }, { status: 500 });
    }

    // Upload ID photo
    const idExt    = idPhotoFile.name.split(".").pop() ?? "jpg";
    const idPath   = `${folder}/id-photo.${idExt}`;
    const { error: idErr } = await supabase.storage
      .from("parking-docs")
      .upload(idPath, idPhotoFile, { upsert: true, contentType: idPhotoFile.type });

    if (idErr) {
      console.error("[parking/upload-docs] ID upload:", idErr.message);
      return NextResponse.json({ error: "ID photo upload failed: " + idErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok:            true,
      or_cr_path:    orCrPath,
      id_photo_path: idPath,
    });
  } catch (err) {
    console.error("[parking/upload-docs] error:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
