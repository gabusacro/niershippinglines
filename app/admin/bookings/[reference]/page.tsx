import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import { passengerTypeLabel } from "@/lib/dashboard/format";
import { getPaymentProofSignedUrl } from "@/lib/admin/payment-proof-url";
import { PaymentProofViewer } from "@/components/admin/PaymentProofViewer";
import { PassengerRestrictionActions } from "@/components/admin/PassengerRestrictionActions";
import { ResendProofButton } from "@/components/admin/ResendProofButton";
import { RefundBookingButton } from "@/components/admin/RefundBookingButton";

export const metadata = {
  title: "Booking details",
  description: "View booking — Nier Shipping Lines Admin",
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
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return String(d);
  }
}

type PassengerDetail = { fare_type?: string; full_name?: string };

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const user = await getAuthUser();
  if (!user || (user.role !== "admin" && user.role !== "ticket_booth")) {
    notFound();
  }

  const { reference } = await params;
  const refNormalized = reference.trim().toUpperCase();
  if (!refNormalized) notFound();

  const supabase = await createClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      "id, reference, created_by, customer_full_name, customer_email, customer_mobile, notify_also_email, passenger_count, fare_type, total_amount_cents, status, payment_proof_path, gcash_transaction_reference, created_at, trip_id, trip_snapshot_vessel_name, trip_snapshot_route_name, trip_snapshot_departure_date, trip_snapshot_departure_time, passenger_details, passenger_names, refund_requested_at, refund_request_reason, refund_request_notes"
    )
    .eq("reference", refNormalized)
    .maybeSingle();

  if (error || !booking) {
    console.error("[AdminBookingDetail]", error?.message, { reference: refNormalized });
    notFound();
  }

  const b = booking as {
    passenger_details?: PassengerDetail[] | null;
    passenger_names?: string[] | null;
    trip_snapshot_route_name?: string | null;
    trip_snapshot_vessel_name?: string | null;
    trip_snapshot_departure_date?: string | null;
    trip_snapshot_departure_time?: string | null;
    notify_also_email?: string | null;
    refund_requested_at?: string | null;
    refund_request_reason?: string | null;
    refund_request_notes?: string | null;
  };
  const routeName = b.trip_snapshot_route_name ?? "—";
  const vesselName = b.trip_snapshot_vessel_name;
  const departureDate = b.trip_snapshot_departure_date;
  const departureTime = b.trip_snapshot_departure_time;

  const passengerDetails = (b.passenger_details ?? []) as PassengerDetail[];
  const passengerNames = Array.isArray(b.passenger_names) ? b.passenger_names : [];
  const proofUrl = booking.payment_proof_path
    ? await getPaymentProofSignedUrl(booking.payment_proof_path)
    : null;

  let passengerRestriction: { booking_warnings: number; booking_blocked_at: string | null } | null = null;
  const createdBy = (booking as { created_by?: string | null }).created_by;
  let creatorIsPassenger = false;
  if (createdBy) {
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", createdBy)
      .maybeSingle();
    creatorIsPassenger = creatorProfile?.role === "passenger";
    if (creatorIsPassenger) {
      const { data: restriction } = await supabase
        .from("passenger_booking_restrictions")
        .select("booking_warnings, booking_blocked_at")
        .eq("profile_id", createdBy)
        .maybeSingle();
      passengerRestriction = restriction
        ? { booking_warnings: restriction.booking_warnings ?? 0, booking_blocked_at: restriction.booking_blocked_at ?? null }
        : { booking_warnings: 0, booking_blocked_at: null };
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={ROUTES.adminBookings}
          className="text-sm font-semibold text-[#0c7b93] hover:underline"
        >
          ← Booking history
        </Link>
        {booking.status === "pending_payment" && (
          <Link
            href={ROUTES.adminPendingPayments}
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Confirm payment
          </Link>
        )}
      </div>

      <div className="rounded-2xl border-2 border-teal-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-mono text-xl font-bold text-[#0c7b93]">{booking.reference}</h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              booking.status === "pending_payment"
                ? "bg-amber-100 text-amber-800"
                : booking.status === "confirmed" || booking.status === "checked_in" || booking.status === "boarded"
                  ? "bg-teal-100 text-teal-800"
                  : booking.status === "refunded"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-gray-100 text-gray-700"
            }`}
          >
            {statusLabel[booking.status] ?? booking.status}
          </span>
        </div>

        <p className="mt-2 text-[#134e4a]">
          {routeName}
          {vesselName ? ` · ${vesselName}` : ""}
        </p>
        <p className="mt-0.5 text-sm text-[#0f766e]">
          {formatDate(departureDate)} · {formatTime(departureTime)}
        </p>

        <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50/50 p-4">
          <h3 className="text-sm font-semibold text-[#134e4a]">Customer</h3>
          <p className="mt-1 text-sm text-[#0f766e]">
            <strong>Name:</strong> {booking.customer_full_name ?? "—"}
          </p>
          <p className="mt-0.5 text-sm text-[#0f766e]">
            <strong>Email:</strong> {booking.customer_email ?? "—"}
          </p>
          {booking.customer_mobile && (
            <p className="mt-0.5 text-sm text-[#0f766e]">
              <strong>Mobile:</strong> {booking.customer_mobile}
            </p>
          )}
          {b.notify_also_email && (
            <p className="mt-0.5 text-sm text-[#0f766e]">
              <strong>Also notify:</strong> {b.notify_also_email}
            </p>
          )}
        </div>

        {createdBy && creatorIsPassenger && passengerRestriction !== null && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
            <h3 className="text-sm font-semibold text-[#134e4a]">Passenger restrictions</h3>
            <p className="mt-1 text-sm text-[#0f766e]">
              This booking was made by a registered account. Warnings and blocks limit online ticket purchases.
            </p>
            <p className="mt-1 text-sm font-medium text-[#134e4a]">
              Warnings: {passengerRestriction.booking_warnings}
              {passengerRestriction.booking_blocked_at ? (
                <span className="ml-2 rounded bg-red-200 px-1.5 py-0.5 text-red-900">Blocked from booking</span>
              ) : null}
            </p>
            <PassengerRestrictionActions
              profileId={createdBy}
              bookingWarnings={passengerRestriction.booking_warnings}
              isBlocked={!!passengerRestriction.booking_blocked_at}
            />
          </div>
        )}

        <div className="mt-4 rounded-lg border border-teal-100 bg-white p-4">
          <h3 className="text-sm font-semibold text-[#134e4a]">Passengers ({booking.passenger_count})</h3>
          {passengerDetails.length > 0 ? (
            <ul className="mt-2 space-y-1.5 text-sm text-[#134e4a]">
              {passengerDetails.map((p, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{p.full_name ?? "—"}</span>
                  <span className="text-[#0f766e]">({passengerTypeLabel(p.fare_type)})</span>
                </li>
              ))}
            </ul>
          ) : passengerNames.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-[#134e4a]">
              {passengerNames.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[#0f766e]">
              {booking.customer_full_name ?? "—"} · {passengerTypeLabel(booking.fare_type)} ({booking.passenger_count} passenger{booking.passenger_count !== 1 ? "s" : ""})
            </p>
          )}
        </div>

        <p className="mt-4 text-sm text-[#134e4a]">
          <strong>Total:</strong> ₱{(booking.total_amount_cents / 100).toLocaleString()}
        </p>
        <p className="mt-0.5 text-xs text-[#0f766e]">
          Created {booking.created_at ? new Date(booking.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "—"}
        </p>

        {b.refund_requested_at && booking.status !== "refunded" && (
          <div className="mt-6 rounded-lg border-2 border-amber-400 bg-amber-100 p-4">
            <h3 className="text-sm font-bold text-amber-900">Passenger requested refund</h3>
            <p className="mt-1 text-sm text-amber-800">
              <strong>Reason:</strong>{" "}
              {b.refund_request_reason === "weather_disturbance" ? "Weather disturbance" : b.refund_request_reason === "vessel_cancellation" ? "Vessel cancellation" : b.refund_request_reason ?? "—"}
            </p>
            {b.refund_request_notes && (
              <p className="mt-1 text-sm text-amber-800">
                <strong>Notes:</strong> {b.refund_request_notes}
              </p>
            )}
            <p className="mt-1 text-xs text-amber-700">
              Requested {b.refund_requested_at ? new Date(b.refund_requested_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "—"}
            </p>
            <p className="mt-2 text-xs text-amber-800">
              Process via the Refund button below when validated.
            </p>
          </div>
        )}

        {booking.status === "pending_payment" && ((booking as { gcash_transaction_reference?: string | null }).gcash_transaction_reference || proofUrl || booking.payment_proof_path) && (
          <div className="mt-6 rounded-lg border-2 border-amber-200 bg-amber-50/50 p-4">
            {(booking as { gcash_transaction_reference?: string | null }).gcash_transaction_reference && (
              <p className="mb-3 text-sm font-medium text-amber-900">
                <strong>Manual reference (from passenger):</strong>{" "}
                <span className="font-mono">{(booking as { gcash_transaction_reference?: string | null }).gcash_transaction_reference}</span>
              </p>
            )}
            {proofUrl && (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-amber-900">Payment proof</h3>
                    <p className="mt-0.5 text-xs text-amber-800">
                      Click to view full size. Verify amount and GCash transaction reference before confirming.
                    </p>
                  </div>
                  <ResendProofButton reference={booking.reference} />
                </div>
                <div className="mt-3">
                  <PaymentProofViewer
                    proofUrl={proofUrl}
                    isPdf={booking.payment_proof_path?.toLowerCase().endsWith(".pdf")}
                    thumbnailClassName="max-h-64 w-auto max-w-full rounded object-contain"
                  />
                </div>
              </>
            )}
            {booking.payment_proof_path && !proofUrl && (
              <p className="text-xs text-amber-700">Proof uploaded (preview unavailable)</p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {booking.trip_id && (
            <Link
              href={`/admin/reports/trip/${booking.trip_id}`}
              className="inline-flex rounded-xl bg-[#0c7b93] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e]"
            >
              View trip manifest
            </Link>
          )}
          {["confirmed", "checked_in", "boarded", "pending_payment", "completed"].includes(booking.status) && (
            <RefundBookingButton
              bookingId={booking.id}
              totalAmountCents={booking.total_amount_cents ?? 0}
            />
          )}
        </div>
      </div>
    </div>
  );
}
