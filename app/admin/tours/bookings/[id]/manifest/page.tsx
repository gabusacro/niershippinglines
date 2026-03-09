import { notFound, redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "./PrintButton";

export const metadata = { title: "Tourist Manifest" };

export default async function ManifestPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("tour_bookings")
    .select(
      "*, tour:tour_packages(title, pickup_time_label), schedule:tour_schedules(available_date, departure_time)"
    )
    .eq("id", id)
    .single();

  if (!booking) notFound();

  const { data: passengers } = await supabase
    .from("tour_booking_passengers")
    .select("*")
    .eq("booking_id", id)
    .order("passenger_number", { ascending: true });

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const tourTitle = (booking.tour as { title?: string } | null)?.title ?? "—";
  const scheduleDate = (booking.schedule as { available_date?: string } | null)?.available_date;
  const departureTime = (booking.schedule as { departure_time?: string } | null)?.departure_time?.slice(0, 5) ?? "—";
  const pickupTime = (booking.tour as { pickup_time_label?: string } | null)?.pickup_time_label ?? "—";

  const printedAt = new Date().toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const backHref = "/admin/tours/bookings/" + id;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          @page { margin: 16mm 12mm; }
        }
        body { font-family: Arial, sans-serif; }
      `}</style>

      {/* Top bar — hidden on print */}
      <div className="no-print flex items-center gap-3 px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <PrintButton />
        <a
          href={backHref}
          className="rounded-xl border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          Back to Booking
        </a>
        <span className="ml-auto text-xs text-gray-400">
          Printed: {printedAt}
        </span>
      </div>

      {/* Manifest document */}
      <div className="mx-auto max-w-3xl px-8 py-8 text-gray-800">

        {/* Header */}
        <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">
            Travela Siargao
          </p>
          <h1 className="text-2xl font-bold tracking-tight uppercase">
            Tourist Manifest
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Coast Guard Boarding Pass · For Official Use
          </p>
        </div>

        {/* Booking summary */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm mb-6 border border-gray-300 rounded-lg p-4 bg-gray-50">
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">Reference</span>
            <p className="font-bold font-mono text-base">{booking.reference}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">Tour</span>
            <p className="font-semibold">{tourTitle}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">Date</span>
            <p className="font-semibold">
              {scheduleDate ? formatDate(scheduleDate) : "—"}
            </p>
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">Departure</span>
            <p className="font-semibold">{departureTime}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">Pickup Time</span>
            <p className="font-semibold">{pickupTime}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">Booking Type</span>
            <p className="font-semibold capitalize">{booking.booking_type}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">Lead Customer</span>
            <p className="font-semibold">{booking.customer_name}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">Contact</span>
            <p className="font-semibold">{booking.customer_phone ?? "—"}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">Total Passengers</span>
            <p className="font-bold text-lg">{booking.total_pax}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">Status</span>
            <p className="font-bold uppercase">{booking.status}</p>
          </div>
        </div>

        {/* Passenger table */}
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3">
          Passenger List
        </h2>

        {!passengers || passengers.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No passenger details recorded.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="border border-gray-700 px-2 py-2 text-left w-6">#</th>
                <th className="border border-gray-700 px-2 py-2 text-left">Full Name</th>
                <th className="border border-gray-700 px-2 py-2 text-left">Birthdate</th>
                <th className="border border-gray-700 px-2 py-2 text-center w-10">Age</th>
                <th className="border border-gray-700 px-2 py-2 text-left">Address</th>
                <th className="border border-gray-700 px-2 py-2 text-left">Contact</th>
                <th className="border border-gray-700 px-2 py-2 text-left">Emergency Contact</th>
              </tr>
            </thead>
            <tbody>
              {passengers.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="border border-gray-200 px-2 py-2 text-center font-bold text-gray-500">
                    {p.passenger_number}
                  </td>
                  <td className="border border-gray-200 px-2 py-2 font-semibold">
                    {p.full_name}
                    {p.passenger_number === 1 && (
                      <span className="ml-1 text-[10px] text-gray-400">(Lead)</span>
                    )}
                  </td>
                  <td className="border border-gray-200 px-2 py-2">
                    {p.birthdate
                      ? new Date(p.birthdate + "T00:00:00").toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="border border-gray-200 px-2 py-2 text-center font-bold">
                    {p.age ?? "—"}
                  </td>
                  <td className="border border-gray-200 px-2 py-2">
                    {p.address || "—"}
                  </td>
                  <td className="border border-gray-200 px-2 py-2">
                    {p.contact_number || "—"}
                  </td>
                  <td className="border border-gray-200 px-2 py-2">
                    {p.emergency_contact_name
                      ? p.emergency_contact_name + (p.emergency_contact_number ? " · " + p.emergency_contact_number : "")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Health declaration */}
        <div className="mt-6 border border-gray-300 rounded-lg p-4 bg-gray-50 text-xs text-gray-600">
          <p className="font-bold text-gray-700 mb-1 uppercase tracking-wide text-[11px]">
            Health Declaration
          </p>
          <p>
            {booking.health_declaration_accepted
              ? "Accepted by " + booking.customer_name
              : "Not accepted"}
            {booking.health_declaration_accepted_at
              ? " on " + new Date(booking.health_declaration_accepted_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })
              : ""}
          </p>
          <p className="mt-1 italic text-gray-400">
            All passengers confirm they are in good health, have no known heart
            conditions, and are within the permitted age range (6-65 years).
            Minors aged 6-17 are accompanied by a parent or guardian.
          </p>
        </div>

        {/* Signature block */}
        <div className="mt-8 grid grid-cols-3 gap-6 text-xs text-center">
          {["Prepared by", "Verified by", "Received by (Coast Guard)"].map((label) => (
            <div key={label}>
              <div className="h-10 border-b border-gray-400 mb-1" />
              <p className="text-gray-500 uppercase tracking-wide text-[10px]">{label}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-[10px] text-gray-400 border-t border-gray-200 pt-3">
          <p>Travela Siargao · Siargao Island, Philippines</p>
          <p className="mt-0.5">Generated: {printedAt} · Ref: {booking.reference}</p>
        </div>

      </div>
    </>
  );
}
