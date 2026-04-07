import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import { ConfirmPaymentButton } from "./ConfirmPaymentButton";
import { PendingPaymentActions } from "@/components/admin/PendingPaymentActions";
import { ResendProofButton } from "@/components/admin/ResendProofButton";
import { formatTime } from "@/lib/dashboard/format";
import { getPaymentProofSignedUrl } from "@/lib/admin/payment-proof-url";
import { PaymentProofViewer } from "@/components/admin/PaymentProofViewer";
import { ConfirmRescheduleFeeButton } from "./ConfirmRescheduleFeeButton";

export const metadata = {
  title: "Pending Payments",
  description: "Bookings awaiting payment — Travela Siargao Admin",
};

type Row = {
  id: string;
  reference: string;
  created_by: string | null;
  customer_full_name: string;
  customer_email: string;
  customer_mobile: string | null;
  passenger_count: number;
  total_amount_cents: number;
  created_at: string;
  payment_proof_path: string | null;
  gcash_transaction_reference: string | null;
  trip: {
    departure_date?: string;
    departure_time?: string;
    route?: { display_name?: string; origin?: string; destination?: string } | null;
  } | null;
};

export default async function AdminPendingPaymentsPage() {
  const user = await getAuthUser();
  if (!user || (user.role !== "admin" && user.role !== "ticket_booth")) {
    redirect(ROUTES.dashboard);
  }

  const supabase = await createClient();
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(
      "id, reference, created_by, customer_full_name, customer_email, customer_mobile, passenger_count, total_amount_cents, created_at, payment_proof_path, gcash_transaction_reference, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, route:routes(display_name, origin, destination))"
    )
    .eq("status", "pending_payment")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-red-600">Unable to load pending payments. {error.message}</p>
        <Link href={user.role === "ticket_booth" ? ROUTES.dashboard : ROUTES.admin} className="mt-4 inline-block text-[#0c7b93] font-medium hover:underline">
          {user.role === "ticket_booth" ? "← Dashboard" : "← Admin dashboard"}
        </Link>
      </div>
    );
  }

  const list = (bookings ?? []) as Row[];



                            const { data: pendingReschedules } = await supabase
                              .from("booking_changes")
                              .select(`
  id,
  booking_id,
  additional_fee_cents,
  proof_path,
  proof_uploaded_at,
  changed_at,
  booking:bookings!booking_changes_booking_id_fkey (
    reference,
    customer_full_name,
    customer_email,
    trip_snapshot_route_name,
    trip_snapshot_departure_date,
    trip_snapshot_departure_time,
    trip_snapshot_vessel_name
  )
`)
                              .eq("fee_paid", false)
                              .not("additional_fee_cents", "is", null)
                              .order("changed_at", { ascending: false })
                              .limit(50);

                            const rescheduleList = (pendingReschedules ?? []) as {
                              id: string;
                              booking_id: string;
                              additional_fee_cents: number;
                              proof_path: string | null;
                              proof_uploaded_at: string | null;
                              changed_at: string;
booking: any;
                            }[];


  // Resolve profile by email for guest bookings so Warning/Spam can target the account that owns that email
  const guestEmailsSet = new Set(list.filter((b) => !b.created_by && b.customer_email?.trim()).map((b) => b.customer_email!.trim().toLowerCase()));
  const { data: passengerProfiles } = guestEmailsSet.size > 0
    ? await supabase.from("profiles").select("id, email").eq("role", "passenger").not("email", "is", null)
    : { data: [] };
  const profileIdByEmail = new Map<string, string>();
  for (const p of passengerProfiles ?? []) {
    const e = (p as { email?: string | null }).email;
    if (e && guestEmailsSet.has(e.trim().toLowerCase())) profileIdByEmail.set(e.trim().toLowerCase(), p.id);
  }
  const listWithProofUrls = await Promise.all(
    list.map(async (b) => ({
      ...b,
      proofUrl: b.payment_proof_path
        ? await getPaymentProofSignedUrl(b.payment_proof_path)
        : null,
      profileId: b.created_by ?? (b.customer_email ? profileIdByEmail.get(b.customer_email.trim().toLowerCase()) ?? null : null),
    }))
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#134e4a]">Pending Payments</h1>
      <p className="mt-1 text-sm text-[#0f766e]">
        Bookings waiting for payment. When a walk-in shows their reference (or phone), find them here and confirm to mark as paid (cash or GCash).
      </p>



                {rescheduleList.length > 0 && (
                        <div className="mt-6">
                          <h2 className="text-lg font-bold text-[#134e4a]">Pending Reschedule Payments</h2>
                          <p className="mt-1 text-sm text-[#0f766e]">Passengers who rescheduled but have not paid the reschedule fee yet.</p>
                          <div className="mt-3 space-y-4">
                            {rescheduleList.map((r) => {
const b = Array.isArray(r.booking) ? r.booking[0] : r.booking;
if (!b) return null;
                              const changedAt = r.changed_at
                                ? new Date(r.changed_at).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) +
                                  " at " + new Date(r.changed_at).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true })
                                : "—";
                              return (
                                <div key={r.id} className="flex flex-col gap-4 rounded-xl border-2 border-orange-200 bg-orange-50/50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-800 mb-1">Reschedule Fee</span>
                                    <Link href={`/admin/bookings/${encodeURIComponent(b.reference)}`} className="block font-mono font-bold text-[#0c7b93] hover:underline">
                                      {b.reference}
                                    </Link>
                                    <p className="mt-1 text-sm font-medium text-[#134e4a]">{b.customer_full_name}</p>
                                    <p className="text-xs text-[#0f766e]">{b.customer_email}</p>
                                    <p className="mt-1 text-xs text-orange-800">Rescheduled: {changedAt}</p>
                                    {b.trip_snapshot_route_name && (
                                      <p className="mt-1 text-sm text-[#134e4a]">
                                        {b.trip_snapshot_route_name}
                                        {b.trip_snapshot_vessel_name ? ` · ${b.trip_snapshot_vessel_name}` : ""}
                                      </p>
                                    )}
                                    <p className="mt-1 text-sm font-bold text-orange-900">
                                      Fee due: ₱{(r.additional_fee_cents / 100).toFixed(0)}
                                    </p>
                                    {r.proof_path ? (
                                      <p className="mt-1 text-xs font-semibold text-teal-700">✓ Payment screenshot uploaded — verify and confirm</p>
                                    ) : (
                                      <p className="mt-1 text-xs text-orange-700">No screenshot uploaded yet.</p>
                                    )}
                                  </div>
                                  <div className="flex flex-col items-stretch gap-2 sm:items-end">
                                    {/* Confirm reschedule fee paid button */}
                                    <ConfirmRescheduleFeeButton changeId={r.id} reference={b.reference} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}









      <div className="mt-6 space-y-4">
        {list.length === 0 ? (
          <div className="rounded-xl border-2 border-teal-200 bg-white p-8 text-center">
            <p className="text-[#134e4a] font-medium">No pending payments</p>
            <p className="mt-1 text-sm text-[#0f766e]">New bookings will appear here until payment is confirmed.</p>
          </div>
        ) : (
          listWithProofUrls.map((b) => {
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
                  <Link
                    href={`/admin/bookings/${encodeURIComponent(b.reference)}`}
                    className="font-mono font-bold text-[#0c7b93] hover:underline"
                  >
                    {b.reference}
                  </Link>
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
                  {b.gcash_transaction_reference && (
                    <p className="mt-2 text-sm font-medium text-amber-900">
                      <strong>Manual reference:</strong>{" "}
                      <span className="font-mono">{b.gcash_transaction_reference}</span>
                    </p>
                  )}
                  {b.proofUrl ? (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-amber-900">Payment proof</p>
                      <PaymentProofViewer
                        proofUrl={b.proofUrl}
                        isPdf={b.payment_proof_path?.toLowerCase().endsWith(".pdf")}
                        thumbnailClassName="h-24 w-auto max-w-[160px] rounded object-contain"
                      />
                      <p className="mt-0.5 text-xs text-amber-800">
                        Click to view full size. Verify amount and GCash transaction reference.
                      </p>
                    </div>
                  ) : b.payment_proof_path ? (
                    <p className="mt-2 text-xs text-amber-700">Proof uploaded (preview unavailable)</p>
                  ) : null}
                </div>
                <div className="flex flex-col items-stretch gap-3 sm:items-end">
                  <PendingPaymentActions
                    bookingId={b.id}
                    reference={b.reference}
                    profileId={(b as { profileId?: string | null }).profileId ?? b.created_by}
                  />
                  <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                    {b.payment_proof_path && <ResendProofButton reference={b.reference} />}
                    <ConfirmPaymentButton reference={b.reference} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

<div className="mt-8 flex flex-wrap gap-4">
        <Link
          href={user.role === "ticket_booth" ? ROUTES.dashboard : ROUTES.admin}
          className="rounded-xl border-2 border-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/10"
        >
          {user.role === "ticket_booth" ? "← Dashboard" : "← Admin dashboard"}
        </Link>
        <Link href={ROUTES.adminBookings} className="rounded-xl border-2 border-teal-200 px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          Booking history
        </Link>
        <Link href={ROUTES.adminReports} className="rounded-xl border-2 border-teal-200 px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          Reports
        </Link>
        {user.role === "admin" && (
          <Link href={ROUTES.adminVessels} className="rounded-xl border-2 border-teal-200 px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
            Vessels
          </Link>
        )}
      </div>
    </div>
  );
}
