import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import { ConfirmPaymentButton } from "./ConfirmPaymentButton";
import { formatTime } from "@/lib/dashboard/format";

export const metadata = {
  title: "Pending payments",
  description: "Bookings awaiting payment — Nier Shipping Lines Admin",
};

type Row = {
  id: string;
  reference: string;
  customer_full_name: string;
  customer_email: string;
  customer_mobile: string | null;
  passenger_count: number;
  total_amount_cents: number;
  created_at: string;
  trip: {
    departure_date?: string;
    departure_time?: string;
    route?: { display_name?: string; origin?: string; destination?: string } | null;
  } | null;
};

export default async function AdminPendingPaymentsPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    redirect(ROUTES.dashboard);
  }

  const supabase = await createClient();
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(
      "id, reference, customer_full_name, customer_email, customer_mobile, passenger_count, total_amount_cents, created_at, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, route:routes(display_name, origin, destination))"
    )
    .eq("status", "pending_payment")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-red-600">Unable to load pending payments. {error.message}</p>
        <Link href={ROUTES.admin} className="mt-4 inline-block text-[#0c7b93] font-medium hover:underline">
          ← Admin dashboard
        </Link>
      </div>
    );
  }

  const list = (bookings ?? []) as Row[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#134e4a]">Pending payments</h1>
      <p className="mt-1 text-sm text-[#0f766e]">
        Bookings waiting for payment. Verify payment (e.g. GCash) then confirm to mark as paid. Data from Supabase.
      </p>

      <div className="mt-6 space-y-4">
        {list.length === 0 ? (
          <div className="rounded-xl border-2 border-teal-200 bg-white p-8 text-center">
            <p className="text-[#134e4a] font-medium">No pending payments</p>
            <p className="mt-1 text-sm text-[#0f766e]">New bookings will appear here until payment is confirmed.</p>
          </div>
        ) : (
          list.map((b) => {
            const routeName =
              b.trip?.route?.display_name ??
              [b.trip?.route?.origin, b.trip?.route?.destination].filter(Boolean).join(" → ") ??
              "—";
            const dateStr = b.trip?.departure_date
              ? new Date(b.trip.departure_date + "Z").toLocaleDateString("en-PH", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "—";
            const bookedAt = b.created_at
              ? new Date(b.created_at).toLocaleDateString("en-PH", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }) + " at " + new Date(b.created_at).toLocaleTimeString("en-PH", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })
              : "—";
            return (
              <div
                key={b.id}
                className="flex flex-col gap-4 rounded-xl border-2 border-amber-200 bg-amber-50/50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-mono font-bold text-[#0c7b93]">{b.reference}</p>
                  <p className="mt-1 text-sm font-medium text-[#134e4a]">{b.customer_full_name}</p>
                  <p className="text-xs text-[#0f766e]">{b.customer_email}</p>
                  {b.customer_mobile ? (
                    <p className="text-xs text-[#0f766e]">{b.customer_mobile}</p>
                  ) : null}
                  <p className="mt-2 text-xs font-medium text-amber-800">
                    Booked on: {bookedAt}
                  </p>
                  <p className="mt-1 text-sm text-[#134e4a]">
                    {routeName} · {dateStr} · {formatTime(b.trip?.departure_time)}
                  </p>
                  <p className="text-sm text-[#134e4a]">
                    {b.passenger_count} passenger{b.passenger_count !== 1 ? "s" : ""} ·{" "}
                    <strong>₱{(b.total_amount_cents / 100).toLocaleString()}</strong>
                  </p>
                </div>
                <ConfirmPaymentButton reference={b.reference} />
              </div>
            );
          })
        )}
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        <Link
          href={ROUTES.admin}
          className="rounded-xl border-2 border-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/10"
        >
          ← Admin dashboard
        </Link>
        <Link href={ROUTES.adminReports} className="rounded-xl border-2 border-teal-200 px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          Reports
        </Link>
        <Link href={ROUTES.adminVessels} className="rounded-xl border-2 border-teal-200 px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          Vessels
        </Link>
        <Link href={ROUTES.adminSchedule} className="rounded-xl border-2 border-teal-200 px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          Schedule
        </Link>
      </div>
    </div>
  );
}
