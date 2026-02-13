import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";

export const metadata = {
  title: "Booking history",
  description: "All bookings — Nier Shipping Lines Admin",
};

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

type Row = {
  id: string;
  reference: string;
  customer_full_name: string;
  customer_email: string;
  passenger_count: number;
  total_amount_cents: number;
  status: string;
  created_at: string;
  trip: {
    departure_date?: string;
    departure_time?: string;
    route?: { display_name?: string; origin?: string; destination?: string } | null;
  } | null;
};

export default async function AdminBookingsPage() {
  const user = await getAuthUser();
  if (!user || (user.role !== "admin" && user.role !== "ticket_booth")) {
    redirect(ROUTES.dashboard);
  }

  const supabase = await createClient();
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(
      "id, reference, customer_full_name, customer_email, passenger_count, total_amount_cents, status, created_at, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, route:routes(display_name, origin, destination))"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-red-600">Unable to load bookings. {error.message}</p>
        <Link href={user.role === "ticket_booth" ? ROUTES.dashboard : ROUTES.admin} className="mt-4 inline-block text-[#0c7b93] font-medium hover:underline">
          {user.role === "ticket_booth" ? "← Dashboard" : "← Admin dashboard"}
        </Link>
      </div>
    );
  }

  const list = (bookings ?? []) as Row[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#134e4a]">Booking history</h1>
      <p className="mt-1 text-sm text-[#0f766e]">
        All recent bookings (including those made with an admin email by mistake). Use Pending payments to confirm payment.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={user.role === "ticket_booth" ? ROUTES.dashboard : ROUTES.admin}
          className="rounded-xl border-2 border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50"
        >
          {user.role === "ticket_booth" ? "← Dashboard" : "← Admin dashboard"}
        </Link>
        <Link
          href={ROUTES.adminPendingPayments}
          className="rounded-xl bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e]"
        >
          Pending payments
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
        {list.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#0f766e]">No bookings found.</div>
        ) : (
          <table className="min-w-full divide-y divide-teal-100 text-sm">
            <thead>
              <tr className="bg-[#0c7b93]/10">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Reference</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Customer</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Email</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Status</th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Amount</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Trip</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Created</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-100">
              {list.map((b) => {
                const routeName =
                  b.trip?.route?.display_name ??
                  [b.trip?.route?.origin, b.trip?.route?.destination].filter(Boolean).join(" → ") ??
                  "—";
                const tripDate = b.trip?.departure_date
                  ? new Date(b.trip.departure_date + "Z").toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—";
                const created = b.created_at
                  ? new Date(b.created_at).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : "—";
                return (
                  <tr key={b.id} className="hover:bg-teal-50/50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/bookings/${encodeURIComponent(b.reference)}`}
                        className="font-mono font-semibold text-[#0c7b93] hover:underline"
                      >
                        {b.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-[#134e4a]">{b.customer_full_name}</td>
                    <td className="px-4 py-2 text-[#134e4a]">{b.customer_email}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          b.status === "pending_payment"
                            ? "bg-amber-100 text-amber-800"
                            : b.status === "confirmed" || b.status === "checked_in" || b.status === "boarded"
                              ? "bg-teal-100 text-teal-800"
                              : b.status === "refunded"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {statusLabel[b.status] ?? b.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-[#134e4a]">
                      ₱{(b.total_amount_cents / 100).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-[#134e4a]">{routeName} · {tripDate}</td>
                    <td className="px-4 py-2 text-[#134e4a]">{created}</td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/bookings/${encodeURIComponent(b.reference)}`}
                        className="font-semibold text-[#0c7b93] hover:underline"
                      >
                        View details
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
