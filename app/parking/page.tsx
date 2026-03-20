import { createClient } from "@/lib/supabase/server";
import ParkingLotsClient from "./ParkingLotsClient";
import { GCASH_NUMBER, GCASH_ACCOUNT_NAME } from "@/lib/constants";

export const metadata = {
  title: "Pay Parking — Siargao Island | Travela Siargao",
  description: "Safe, affordable vehicle parking near Dapa Port, Siargao. Reserve your slot online. Cars & motorcycles from ₱250/day.",
  keywords: ["Siargao parking", "Dapa port parking", "Siargao vehicle parking", "park Siargao"],
};

export const dynamic = "force-dynamic";

async function getLotsWithAvailability() {
  try {
    const supabase = await createClient();
    const { data: lots } = await supabase
      .from("parking_lots")
      .select("id, name, slug, address, description, distance_from_port, total_slots_car, total_slots_motorcycle, total_slots_van, car_rate_cents, motorcycle_rate_cents, van_rate_cents, accepts_car, accepts_motorcycle, accepts_van, is_24hrs")
      .eq("is_active", true)
      .order("name");

    if (!lots?.length) return [];

    const [availRes, mediaRes] = await Promise.all([
      supabase.from("parking_slot_availability")
        .select("lot_id, booked_car, booked_motorcycle, booked_van"),
      supabase.from("parking_lot_media")
        .select("id, lot_id, photo_url, is_cover, sort_order")
        .order("sort_order", { ascending: true }),
    ]);

    const availMap = new Map((availRes.data ?? []).map(a => [a.lot_id, a]));
    const mediaByLot = new Map<string, typeof mediaRes.data>(); 
    (mediaRes.data ?? []).forEach(m => {
      if (!mediaByLot.has(m.lot_id)) mediaByLot.set(m.lot_id, []);
      mediaByLot.get(m.lot_id)!.push(m);
    });

    return lots.map(lot => {
      const a = availMap.get(lot.id);
      return {
        ...lot,
        available_car:        lot.total_slots_car        - (a?.booked_car        ?? 0),
        available_motorcycle: lot.total_slots_motorcycle - (a?.booked_motorcycle ?? 0),
        available_van:        lot.total_slots_van        - (a?.booked_van        ?? 0),
        accepts_car:          lot.accepts_car        ?? true,
        accepts_motorcycle:   lot.accepts_motorcycle ?? true,
        accepts_van:          lot.accepts_van        ?? true,
        media:                mediaByLot.get(lot.id) ?? [],
      };
    });
  } catch {
    return [];
  }
}

async function getParkingSettings() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("parking_settings")
      .select("default_car_rate_cents, default_motorcycle_rate_cents, default_van_rate_cents, platform_fee_cents, processing_fee_cents, commission_per_vehicle_cents, max_parking_days, required_documents_text")
      .eq("id", 1)
      .maybeSingle();

    return {
      carRate:        data?.default_car_rate_cents         ?? 25000,
      motorcycleRate: data?.default_motorcycle_rate_cents  ?? 25000,
      vanRate:        data?.default_van_rate_cents         ?? null,
      platformFee:    data?.platform_fee_cents             ?? 3500,
      processingFee:  data?.processing_fee_cents           ?? 3000,
      commission:     data?.commission_per_vehicle_cents   ?? 10000,
      maxDays:        data?.max_parking_days               ?? 45,
      requiredDocs:   data?.required_documents_text        ?? "Valid government-issued ID and complete vehicle papers (OR/CR).",
      // GCash details — same constants used across the whole app
      gcashNumber:    GCASH_NUMBER    ?? "",
      gcashName:      GCASH_ACCOUNT_NAME ?? "",
    };
  } catch {
    return {
      carRate: 25000, motorcycleRate: 25000, vanRate: null,
      platformFee: 3500, processingFee: 3000, commission: 10000,
      maxDays: 45,
      requiredDocs: "Valid ID and OR/CR required.",
      gcashNumber: GCASH_NUMBER    ?? "",
      gcashName:   GCASH_ACCOUNT_NAME ?? "",
    };
  }
}

export default async function ParkingPage() {
  const [lots, settings] = await Promise.all([
    getLotsWithAvailability(),
    getParkingSettings(),
  ]);

  return <ParkingLotsClient lots={lots} settings={settings} />;
}
