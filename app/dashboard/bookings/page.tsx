import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { APP_NAME, ROUTES, GCASH_NUMBER, GCASH_ACCOUNT_NAME } from "@/lib/constants";
import { passengerTypeLabel } from "@/lib/dashboard/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "My bookings",
  description: `Your ferry bookings — ${APP_NAME}`,
};

function formatTime(t: string | null | undefined) {
  if (!t) return "—";
  const [h, m] = String(t).split(":");
  const hh = parseInt(h, 10);
  const am = hh < 12;
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${m || "00"} ${am ? "AM" : "PM"}`;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d + "Z").toLocaleDateString("en-PH", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(d);
  }
}

const statusLabel: Record<string, string> = {
  pending_payment: "Pending payment",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  boarded: "Boarded",
  completed: "Completed",
  cancelled: "Cancelled",
  changed: "Changed",
  refunded: "Refunded",
};

type TripRow = {
  departure_date?: string;
  departure_time?: string;
  route?: { display_name?: string; origin?: string; destination?: string } | null;
};
type Row = {
  id: string;
  reference: string;
  passenger_count: number;
  fare_type: string;
  total_amount_cents: number;
  status: string;
  created_at: string;
  trip?: TripRow | null;
  trip_snapshot_vessel_name?: string | null;
  trip_snapshot_route_name?: string | null;
  trip_snapshot_departure_date?: string | null;
  trip_snapshot_departure_time?: string | null;
};

export default async function MyBookingsPage() {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);
  if (user.role !== "passenger") redirect(ROUTES.dashboard);

  const supabase = await createClient();
  const fullRes = await supabase
    .from("bookings")
    .select(
      "id, reference, passenger_count, fare_type, total_amount_cents, status, created_at, trip_snapshot_vessel_name, trip_snapshot_route_name, trip_snapshot_departure_date, trip_snapshot_departure_time, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, route:routes(display_name, origin, destination))"
    )
    .ilike("customer_email", (user.email ?? "").trim())
    .order("created_at", { ascending: false })
    .limit(50);

  let list: Row[];
  if (fullRes.error) {
    const msg = fullRes.error.message?.toLowerCase() ?? "";
    const missingColumn = msg.includes("column") && (msg.includes("does not exist") || msg.includes("trip_snapshot"));
    if (missingColumn) {
      const minRes = await supabase
        .from("bookings")
        .select(
          "id, reference, passenger_count, fare_type, total_amount_cents, status, created_at, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, route:routes(display_name, origin, destination))"
        )
        .ilike("customer_email", (user.email ?? "").trim())
        .order("created_at", { ascending: false })
        .limit(50);
      if (minRes.error) {
        console.error("[My Bookings] Supabase error:", minRes.error.message, minRes.error.code);
        return (
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
            <p className="text-red-600">Unable to load bookings. Please try again later.</p>
            {process.env.NODE_ENV === "development" && (
              <p className="mt-2 text-sm text-amber-800 font-mono">{minRes.error.message}</p>
            )}
            <Link href={ROUTES.dashboard} className="mt-4 inline-block text-[#0c7b93] font-medium hover:underline">
              ← Back to dashboard
            </Link>
          </div>
        );
      }
      list = (minRes.data ?? []) as Row[];
    } else {
      console.error("[My Bookings] Supabase error:", fullRes.error.message, fullRes.error.code);
      return (
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <p className="text-red-600">Unable to load bookings. Please try again later.</p>
          {process.env.NODE_ENV === "development" && (
            <p className="mt-2 text-sm text-amber-800 font-mono">{fullRes.error.message}</p>
          )}
          <Link href={ROUTES.dashboard} className="mt-4 inline-block text-[#0c7b93] font-medium hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      );
    }
  } else {
    list = (fullRes.data ?? []) as Row[];
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#134e4a]">My bookings</h1>
          <p className="mt-1 text-sm text-[#0f766e]">
            Bookings for {user.fullName || user.email}
          </p>
        </div>
        <Link
          href={ROUTES.dashboard}
          className="rounded-xl border-2 border-[#0c7b93] px-4 py-2 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/10 transition-colors"
        >
          ← Dashboard
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border-2 border-teal-200 bg-white p-8 text-center shadow-sm">
          <p className="text-[#134e4a] font-medium">No bookings yet</p>
          <p className="mt-1 text-sm text-[#0f766e]">
            Book a trip and your reservations will appear here.
          </p>
          <Link
            href={ROUTES.book}
            className="mt-6 inline-block rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] transition-colors"
          >
            Book a trip
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {list.map((b) => {
            const routeName =
              (b.trip?.route?.display_name ??
                [b.trip?.route?.origin, b.trip?.route?.destination].filter(Boolean).join(" → ")) ||
              b.trip_snapshot_route_name ||
              "—";
            const depDate = b.trip?.departure_date ?? b.trip_snapshot_departure_date;
            const depTime = b.trip?.departure_time ?? b.trip_snapshot_departure_time;
            return (
              <li key={b.id}>
                <Link
                  href={`/dashboard/bookings/${b.reference}`}
                  className="block rounded-2xl border-2 border-teal-200 bg-white p-5 shadow-sm transition-shadow hover:border-[#0c7b93]/50 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono font-bold text-[#0c7b93]">{b.reference}</p>
                      <p className="mt-1 text-sm text-[#134e4a]">{routeName}{b.trip_snapshot_vessel_name ? ` · ${b.trip_snapshot_vessel_name}` : ""}</p>
                      <p className="mt-0.5 text-xs text-[#0f766e]">
                        {formatDate(depDate)} · {formatTime(depTime)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        b.status === "refunded"
                          ? "bg-amber-100 text-amber-800"
                          : b.status === "pending_payment"
                          ? "bg-amber-100 text-amber-800"
                          : b.status === "confirmed" || b.status === "checked_in" || b.status === "boarded"
                          ? "bg-teal-100 text-teal-800"
                          : b.status === "completed"
                          ? "bg-[#0c7b93]/10 text-[#0f766e]"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {statusLabel[b.status] ?? b.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-[#134e4a]">
                    {b.passenger_count} passenger{b.passenger_count !== 1 ? "s" : ""} · {passengerTypeLabel(b.fare_type)} ·{" "}
                    <strong>₱{(b.total_amount_cents / 100).toLocaleString()}</strong>
                  </p>
                  {b.status === "pending_payment" && (
                    <div className="mt-2 text-xs text-[#0f766e]">
                      <p>Pay at the ticket booth and present this reference, or send payment via GCash.</p>
                      {GCASH_NUMBER && (
                        <p className="mt-1 font-medium text-[#134e4a]">
                          GCash: {GCASH_NUMBER} ({GCASH_ACCOUNT_NAME}) — include reference in message.
                        </p>
                      )}
                      <p className="mt-1 text-[#0c7b93] font-medium">Click to view details and upload payment proof →</p>
                    </div>
                  )}
                  {(b.status === "confirmed" || b.status === "checked_in" || b.status === "boarded" || b.status === "completed") && (
                    <p className="mt-3 text-sm font-medium text-[#0c7b93]">
                      Click to view details and print tickets →
                    </p>
                  )}
                  {b.status === "refunded" && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-semibold text-amber-900">
                        Your ticket has been refunded by {APP_NAME}.
                      </p>
                      <p className="mt-1 text-sm text-amber-800">
                        The amount of <strong>₱{(b.total_amount_cents / 100).toLocaleString()}</strong> has been processed. We apologize for any inconvenience. If you have questions, please contact us.
                      </p>
                      <p className="mt-2 text-xs text-[#0c7b93] font-medium">Click for full details →</p>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
