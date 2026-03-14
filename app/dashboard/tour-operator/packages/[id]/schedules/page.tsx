import { redirect, notFound } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import SchedulesPageClient from "@/app/admin/tours/packages/[id]/schedules/SchedulesPageClient";
import BulkScheduleClient from "@/app/admin/tours/packages/[id]/schedules/BulkScheduleClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Package Schedules" };

export default async function OperatorPackageSchedulesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_operator") redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();

  // Verify ownership
  const { data: pkg } = await supabase
    .from("tour_packages")
    .select("id, title, accepts_joiners, accepts_private, accepts_exclusive, exclusive_unit_label, pickup_time_label, owner_type, owner_id, approval_status")
    .eq("id", id)
    .eq("owner_type", "operator")
    .eq("owner_id", user.id)
    .single();

  if (!pkg) notFound();

  const { data: schedules } = await supabase
    .from("tour_schedules")
    .select("*")
    .eq("tour_id", id)
    .order("available_date", { ascending: true });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-emerald-700 mb-4 flex-wrap">
        <Link href="/dashboard/tour-operator" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <Link href="/dashboard/tour-operator/packages" className="hover:underline">My Packages</Link>
        <span>/</span>
        <span className="font-semibold truncate max-w-[200px]">{pkg.title}</span>
        <span>/</span>
        <span className="font-semibold">Schedules</span>
      </div>

      {/* Approval warning */}
      {pkg.approval_status !== "approved" && (
        <div className="mb-5 rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4">
          <p className="font-bold text-amber-800">⏳ Package pending admin approval</p>
          <p className="text-sm text-amber-700 mt-0.5">
            You can add schedules now, but guests won&apos;t see this package until admin approves it.
          </p>
        </div>
      )}

      <SchedulesPageClient
        pkg={{
          id: pkg.id,
          title: pkg.title,
          accepts_joiners: pkg.accepts_joiners,
          accepts_private: pkg.accepts_private,
          accepts_exclusive: pkg.accepts_exclusive,
          exclusive_unit_label: pkg.exclusive_unit_label,
          pickup_time_label: pkg.pickup_time_label,
        }}
        tourId={id}
        initialSchedules={(schedules ?? []).map(s => ({
          id: s.id,
          available_date: s.available_date,
          departure_time: s.departure_time,
          status: s.status,
          notes: s.notes,
          accepts_joiners: s.accepts_joiners,
          joiner_slots_total: s.joiner_slots_total,
          joiner_slots_booked: s.joiner_slots_booked,
          accepts_private: s.accepts_private,
          private_slots_total: s.private_slots_total,
          private_slots_booked: s.private_slots_booked,
          accepts_exclusive: s.accepts_exclusive,
          exclusive_units_total: s.exclusive_units_total,
          exclusive_units_booked: s.exclusive_units_booked,
        }))}
        today={today}
      />
    </div>
  );
}
