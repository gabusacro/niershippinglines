import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { isDepartureAtLeast24HoursFromNow } from "@/lib/admin/ph-time";
import { APP_NAME, ROUTES, GCASH_NUMBER, GCASH_ACCOUNT_NAME } from "@/lib/constants";
import { TranslatableNotices } from "@/components/booking/TranslatableNotices";
import { passengerTypeLabel } from "@/lib/dashboard/format";
import { PrintTicketsTrigger } from "@/components/tickets/PrintTicketsTrigger";
import { PaymentProofUpload } from "./PaymentProofUpload";
import { ManualReferenceField } from "./ManualReferenceField";
import { AcknowledgeRefundButton } from "./AcknowledgeRefundButton";
import { RequestRefundButton } from "./RequestRefundButton";
import { RequestRescheduleButton } from "./RequestRescheduleButton";

export const metadata = {
  title: "Booking details",
  description: `Booking details — ${APP_NAME}`,
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

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);
  if (user.role !== "passenger") redirect(ROUTES.dashboard);

  const { reference } = await params;
  const refNormalized = reference.trim().toUpperCase();
  if (!refNormalized) notFound();
  const supabase = await createClient();
  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) notFound();

  type BookingRow = {
    id: string;
    reference: string;
    customer_full_name: string;
    customer_email: string;
    customer_mobile?: string | null;
    passenger_names?: string[];
    passenger_count: number;
    fare_type: string;
    total_amount_cents: number;
    status: string;
    payment_proof_path: string | null;
    proof_resend_requested_at?: string | null;
    gcash_transaction_reference?: string | null;
    created_at: string;
    trip_snapshot_vessel_name?: string | null;
    trip_snapshot_route_name?: string | null;
    trip_snapshot_departure_date?: string | null;
    trip_snapshot_departure_time?: string | null;
    refund_acknowledged_at?: string | null;
    refund_requested_at?: string | null;
    refund_request_reason?: string | null;
    refund_request_notes?: string | null;
  };
  let booking: BookingRow | null = null;

  const fullRes = await supabase
    .from("bookings")
    .select(
      "id, reference, customer_full_name, customer_email, customer_mobile, passenger_names, passenger_count, fare_type, total_amount_cents, status, payment_proof_path, proof_resend_requested_at, gcash_transaction_reference, created_at, trip_snapshot_vessel_name, trip_snapshot_route_name, trip_snapshot_departure_date, trip_snapshot_departure_time, refund_acknowledged_at, refund_requested_at, refund_request_reason, refund_request_notes"
    )
    .eq("reference", refNormalized)
    .ilike("customer_email", email)
    .maybeSingle();

  if (fullRes.error) {
    const msg = fullRes.error.message?.toLowerCase() ?? "";
    const missingColumn = msg.includes("column") && (msg.includes("does not exist") || msg.includes("refund_acknowledged") || msg.includes("trip_snapshot"));
    if (missingColumn) {
      const minimalRes = await supabase
        .from("bookings")
        .select("id, reference, customer_full_name, customer_email, passenger_count, fare_type, total_amount_cents, status, payment_proof_path, proof_resend_requested_at, gcash_transaction_reference, created_at, refund_acknowledged_at")
        .eq("reference", refNormalized)
        .ilike("customer_email", email)
        .maybeSingle();
      if (minimalRes.error || !minimalRes.data) {
        console.error("[BookingDetail] Supabase error:", fullRes.error.message, { reference });
        notFound();
      }
      booking = minimalRes.data as BookingRow;
    } else {
      console.error("[BookingDetail] Supabase error:", fullRes.error.message, fullRes.error.code, { reference });
      notFound();
    }
  } else {
    booking = fullRes.data as BookingRow;
  }

  if (!booking) notFound();

  const b = booking as { trip_snapshot_route_name?: string | null; trip_snapshot_vessel_name?: string | null; trip_snapshot_departure_date?: string | null; trip_snapshot_departure_time?: string | null; refund_acknowledged_at?: string | null; customer_full_name?: string; customer_email?: string; customer_mobile?: string | null; passenger_names?: string[] };
  const routeName = b.trip_snapshot_route_name ?? "—";

  // Fetch GCash reference for refunded bookings (refunds table is admin-only; we use admin client after verifying ownership)
  let gcashRef: string | null = null;
  if (booking.status === "refunded") {
    const adminClient = (await import("@/lib/supabase/admin")).createAdminClient();
    if (adminClient) {
      const { data: refund } = await adminClient
        .from("refunds")
        .select("gcash_reference")
        .eq("booking_id", booking.id)
        .maybeSingle();
      gcashRef = refund?.gcash_reference ?? null;
    }
  }

  const canPrintTickets =
    booking.status === "confirmed" ||
    booking.status === "checked_in" ||
    booking.status === "boarded" ||
    booking.status === "completed";

  const canReschedule =
    ["confirmed", "checked_in", "boarded", "pending_payment"].includes(booking.status) &&
    isDepartureAtLeast24HoursFromNow(b.trip_snapshot_departure_date ?? "", b.trip_snapshot_departure_time ?? "");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={ROUTES.myBookings}
          className="text-sm font-semibold text-[#0c7b93] hover:underline"
        >
          ← My bookings
        </Link>
      </div>

      <div className="rounded-2xl border-2 border-teal-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-mono text-xl font-bold text-[#0c7b93]">{booking.reference}</h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              booking.status === "refunded"
                ? "bg-amber-100 text-amber-800"
                : booking.status === "pending_payment"
                ? "bg-amber-100 text-amber-800"
                : canPrintTickets
                ? "bg-teal-100 text-teal-800"
                : booking.status === "completed"
                ? "bg-[#0c7b93]/10 text-[#0f766e]"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {statusLabel[booking.status] ?? booking.status}
          </span>
        </div>

        <p className="mt-2 text-[#134e4a]">{routeName}{b.trip_snapshot_vessel_name ? ` · ${b.trip_snapshot_vessel_name}` : ""}</p>
        <p className="mt-0.5 text-sm text-[#0f766e]">
          {formatDate(b.trip_snapshot_departure_date)} · {formatTime(b.trip_snapshot_departure_time)}
        </p>

        <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50/50 p-4">
          <h3 className="text-sm font-semibold text-[#134e4a]">Passenger details</h3>
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
          {Array.isArray(booking.passenger_names) && booking.passenger_names.length > 0 && (
            <p className="mt-0.5 text-sm text-[#0f766e]">
              <strong>Passengers:</strong> {booking.passenger_names.join(", ")}
            </p>
          )}
        </div>

        <p className="mt-3 text-sm text-[#134e4a]">
          {booking.passenger_count} passenger{booking.passenger_count !== 1 ? "s" : ""} · {passengerTypeLabel(booking.fare_type)} ·{" "}
          <strong>₱{(booking.total_amount_cents / 100).toLocaleString()}</strong>
        </p>

        <div className="mt-4 rounded-lg border-2 border-amber-200 bg-amber-50/50 p-4">
          <TranslatableNotices sliceFrom={2} listClassName="mt-1 list-disc list-outside space-y-0.5 pl-5 ml-1 text-xs text-amber-900" />
        </div>

        {booking.status === "pending_payment" && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            {(b as { proof_resend_requested_at?: string | null }).proof_resend_requested_at && (
              <div className="mb-4 rounded-lg border-2 border-amber-400 bg-amber-100 p-3">
                <p className="text-sm font-semibold text-amber-900">
                  Screenshot Error or No reference number. Kindly resend the photo or enter reference number manually.
                </p>
              </div>
            )}
            <h2 className="text-sm font-semibold text-amber-900">Where to send payment</h2>
            <p className="mt-1 text-sm text-amber-800">
              Send <strong>₱{(booking.total_amount_cents / 100).toLocaleString()}</strong> via GCash to confirm this booking.
            </p>
            {GCASH_NUMBER && (
              <p className="mt-2 text-sm font-medium text-amber-900">
                GCash: <strong>{GCASH_NUMBER}</strong> ({GCASH_ACCOUNT_NAME})
              </p>
            )}
            <p className="mt-1 text-xs text-amber-800">
              Put your booking reference <strong>{booking.reference}</strong> in the message. You can also pay at the ticket booth and present this reference.
            </p>
            <div className="mt-4">
              <PaymentProofUpload reference={booking.reference} hasProof={!!booking.payment_proof_path} />
            </div>
            <div className="mt-4">
              <ManualReferenceField
                reference={booking.reference}
                initialValue={(b as { gcash_transaction_reference?: string | null }).gcash_transaction_reference ?? ""}
              />
            </div>
          </div>
        )}

        {canPrintTickets && (
          <div className="mt-6">
            <PrintTicketsTrigger
              reference={booking.reference}
              passengerCount={booking.passenger_count}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] transition-colors"
            />
          </div>
        )}

        {["confirmed", "checked_in", "boarded", "pending_payment"].includes(booking.status) && (
          <RequestRescheduleButton
            reference={booking.reference}
            totalAmountCents={booking.total_amount_cents}
            passengerCount={booking.passenger_count}
            canReschedule={canReschedule}
          />
        )}

        {["confirmed", "checked_in", "boarded", "pending_payment", "completed"].includes(booking.status) && (
          <RequestRefundButton
            reference={booking.reference}
            refundRequestedAt={(booking as { refund_requested_at?: string | null }).refund_requested_at ?? null}
          />
        )}

        {booking.status === "refunded" && (
          <div className="mt-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-5">
            <h2 className="text-base font-bold text-amber-900">
              Your ticket has been refunded
            </h2>
            <p className="mt-2 text-sm text-amber-800">
              {APP_NAME} has processed a refund for your booking. The amount of{" "}
              <strong>₱{(booking.total_amount_cents / 100).toLocaleString()}</strong> for {routeName} on {formatDate(b.trip_snapshot_departure_date)} at {formatTime(b.trip_snapshot_departure_time)} has been refunded.
            </p>
            {gcashRef && (
              <p className="mt-2 text-sm text-amber-800">
                <strong>GCash transaction reference:</strong> <span className="font-mono">{gcashRef}</span>
                <span className="text-xs block text-amber-700 mt-0.5">(Use this to trace the refund in your GCash account)</span>
              </p>
            )}
            <p className="mt-2 text-sm text-amber-800">
              We apologize for any inconvenience. If you have questions about this refund, please contact us at the ticket booth or via our contact channels.
            </p>
            <p className="mt-3 text-xs text-amber-700">
              Refund processed on your account. You may book a new trip anytime.
            </p>
            <AcknowledgeRefundButton reference={booking.reference} acknowledged={!!b.refund_acknowledged_at} />
          </div>
        )}
      </div>
    </div>
  );
}
