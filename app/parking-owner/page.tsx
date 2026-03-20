import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import ParkingOwnerDashboard from "./ParkingOwnerDashboard";

export const metadata = { title: "Parking Owner Dashboard — Travela Siargao" };
export const dynamic = "force-dynamic";

export default async function ParkingOwnerPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if ((user.role as string) !== "parking_owner") redirect("/dashboard");

  const supabase = await createClient();

  // Get their assigned lot
  const { data: lot } = await supabase
    .from("parking_lots")
    .select("id, name, address, distance_from_port, total_slots_car, total_slots_motorcycle, total_slots_van, car_rate_cents, motorcycle_rate_cents, van_rate_cents, is_active, is_24hrs")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  // Get crew assigned to their lot
  const crew = lot ? await supabase
    .from("parking_lot_crew")
    .select("id, crew_id, is_active, profiles!crew_id(id, full_name, email, avatar_url)")
    .eq("lot_id", lot.id)
    .eq("is_active", true)
    .then(r => (r.data ?? []).map((c: {
      id: string; crew_id: string; is_active: boolean;
      profiles: { id: string; full_name: string | null; email: string | null; avatar_url: string | null } |
                { id: string; full_name: string | null; email: string | null; avatar_url: string | null }[] | null;
    }) => {
      const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
      return { id: c.id, crew_id: c.crew_id, full_name: p?.full_name ?? "—", email: p?.email ?? "—", avatar_url: (p as { avatar_url?: string | null })?.avatar_url ?? null };
    }))
  : [];

  // Get availability
  const avail = lot ? await supabase
    .from("parking_slot_availability")
    .select("booked_car, booked_motorcycle, booked_van")
    .eq("lot_id", lot.id)
    .maybeSingle()
    .then(r => r.data)
  : null;

  // Get owner avatar
  const { data: profile } = await supabase.from("profiles").select("avatar_url, full_name").eq("id", user.id).maybeSingle();

  return (
    <ParkingOwnerDashboard
      ownerId={user.id}
      ownerName={user.fullName ?? user.email ?? "Owner"}
      ownerEmail={user.email ?? ""}
      avatarUrl={profile?.avatar_url ?? null}
      lot={lot ?? null}
      crew={crew}
      availability={avail ?? { booked_car: 0, booked_motorcycle: 0, booked_van: 0 }}
    />
  );
}
