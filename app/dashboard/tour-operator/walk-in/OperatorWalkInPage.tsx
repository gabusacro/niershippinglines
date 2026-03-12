"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface TourPackage {
  id: string;
  title: string;
  slug: string;
  accepts_joiners: boolean;
  accepts_private: boolean;
  joiner_price_cents: number | null;
  private_price_cents: number | null;
}
interface Schedule {
  id: string;
  available_date: string;
  departure_time: string;
  joiner_slots_total: number;
  joiner_slots_booked: number;
  private_slots_total: number;
  private_slots_booked: number;
  status: string;
}
interface Guest {
  full_name: string;
  birthdate: string;
  age: string;
  address: string;
  contact_number: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
}
const emptyGuest = (): Guest => ({
  full_name: "", birthdate: "", age: "", address: "",
  contact_number: "", emergency_contact_name: "", emergency_contact_number: "",
});

export default function OperatorWalkInPage() {
  const [tours, setTours] = useState<TourPackage[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedTour, setSelectedTour] = useState<TourPackage | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [bookingType, setBookingType] = useState<"joiner" | "private">("joiner");
  const [guests, setGuests] = useState<Guest[]>([emptyGuest()]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [healthDeclaration, setHealthDeclaration] = useState(false);
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ reference: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/tours/packages/list")
      .then((r) => r.json())
      .then((d) => setTours(d.packages ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTour) { setSchedules([]); return; }
    fetch(`/api/admin/tours/schedules/list?tour_id=${selectedTour.id}`)
      .then((r) => r.json())
      .then((d) => setSchedules(d.schedules ?? []));
  }, [selectedTour]);

  const pricePerPax =
    bookingType === "joiner"
      ? (selectedTour?.joiner_price_cents ?? 0)
      : (selectedTour?.private_price_cents ?? 0);

  const totalAmount = pricePerPax * guests.length;

  function updateGuest(i: number, field: keyof Guest, value: string) {
    setGuests((prev) => prev.map((g, idx) => idx === i ? { ...g, [field]: value } : g));
  }

  function addGuest() { setGuests((prev) => [...prev, emptyGuest()]); }
  function removeGuest(i: number) { setGuests((prev) => prev.filter((_, idx) => idx !== i)); }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("tour_id", selectedTour!.id);
      formData.set("schedule_id", selectedSchedule!.id);
      formData.set("booking_type", bookingType);
      formData.set("customer_name", customerName);
      formData.set("customer_email", customerEmail);
      formData.set("customer_phone", customerPhone);
      formData.set("health_declaration_accepted", healthDeclaration ? "true" : "false");
      formData.set("notes", notes);
      formData.set("passengers", JSON.stringify(guests));
      formData.set("source", "operator_walk_in");

      const res = await fetch("/api/dashboard/tour-operator/walk-in", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create booking");
      setSuccess({ reference: data.reference });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-10">
          <p className="text-4xl mb-4">🎉</p>
          <h1 className="text-2xl font-bold text-emerald-800 mb-2">Walk-in Booking Created!</h1>
          <p className="text-emerald-700 mb-1">Reference:</p>
          <p className="font-mono text-2xl font-bold text-emerald-700 mb-6">{success.reference}</p>
          <p className="text-sm text-emerald-600 mb-6">
            💵 Cash payment collected directly by you.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => { setSuccess(null); setStep(1); setSelectedTour(null); setSelectedSchedule(null); setGuests([emptyGuest()]); setCustomerName(""); setCustomerEmail(""); setCustomerPhone(""); setHealthDeclaration(false); setNotes(""); }}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
              + New Walk-in
            </button>
            <Link href="/dashboard/tour-operator/bookings"
              className="rounded-xl border-2 border-emerald-200 px-5 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
              My Bookings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-emerald-700 mb-6">
        <Link href="/dashboard/tour-operator" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="font-semibold">Walk-in Booking</span>
      </div>

      <h1 className="text-2xl font-bold text-[#134e4a] mb-1">Walk-in Booking</h1>
      <p className="text-sm text-gray-500 mb-6">Cash payment collected directly by you as the operator.</p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
              step === s ? "border-emerald-500 bg-emerald-500 text-white" :
              step > s   ? "border-emerald-400 bg-emerald-100 text-emerald-700" :
                           "border-gray-200 bg-white text-gray-400"
            }`}>{s}</div>
            <span className={`text-xs font-medium ${step === s ? "text-emerald-700" : "text-gray-400"}`}>
              {s === 1 ? "Tour & Schedule" : s === 2 ? "Guest Details" : "Confirm"}
            </span>
            {s < 3 && <div className="w-6 h-0.5 bg-gray-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* STEP 1 — Tour & Schedule */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
            <h2 className="font-bold text-[#134e4a] mb-4">Select Tour</h2>
            {loading ? (
              <p className="text-sm text-gray-400">Loading tours...</p>
            ) : (
              <div className="grid gap-3">
                {tours.map((t) => (
                  <button key={t.id} onClick={() => { setSelectedTour(t); setSelectedSchedule(null); }}
                    className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                      selectedTour?.id === t.id
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-100 hover:border-emerald-200"
                    }`}>
                    <p className="font-semibold text-sm text-[#134e4a]">{t.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t.accepts_joiners && `Joiner ₱${((t.joiner_price_cents ?? 0) / 100).toLocaleString()}`}
                      {t.accepts_joiners && t.accepts_private && " · "}
                      {t.accepts_private && `Private ₱${((t.private_price_cents ?? 0) / 100).toLocaleString()}`}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedTour && (
            <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
              <h2 className="font-bold text-[#134e4a] mb-4">Booking Type</h2>
              <div className="flex gap-3">
                {selectedTour.accepts_joiners && (
                  <button onClick={() => setBookingType("joiner")}
                    className={`flex-1 rounded-xl border-2 py-3 text-sm font-semibold transition-colors ${
                      bookingType === "joiner" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-gray-200 text-gray-500"
                    }`}>
                    Joiner<br />
                    <span className="text-xs font-normal">₱{((selectedTour.joiner_price_cents ?? 0) / 100).toLocaleString()}/pax</span>
                  </button>
                )}
                {selectedTour.accepts_private && (
                  <button onClick={() => setBookingType("private")}
                    className={`flex-1 rounded-xl border-2 py-3 text-sm font-semibold transition-colors ${
                      bookingType === "private" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-gray-200 text-gray-500"
                    }`}>
                    Private<br />
                    <span className="text-xs font-normal">₱{((selectedTour.private_price_cents ?? 0) / 100).toLocaleString()}/pax</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {selectedTour && schedules.length > 0 && (
            <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
              <h2 className="font-bold text-[#134e4a] mb-4">Select Schedule</h2>
              <div className="grid gap-3">
                {schedules.map((s) => {
                  const slotsLeft = bookingType === "joiner"
                    ? s.joiner_slots_total - s.joiner_slots_booked
                    : s.private_slots_total - s.private_slots_booked;
                  const full = slotsLeft <= 0;
                  return (
                    <button key={s.id} disabled={full || s.status !== "active"}
                      onClick={() => setSelectedSchedule(s)}
                      className={`rounded-xl border-2 px-4 py-3 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        selectedSchedule?.id === s.id
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-100 hover:border-emerald-200"
                      }`}>
                      <p className="font-semibold text-sm text-[#134e4a]">
                        {new Date(s.available_date + "T00:00:00").toLocaleDateString("en-PH", {
                          weekday: "long", month: "long", day: "numeric", year: "numeric"
                        })}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Departure: {s.departure_time?.slice(0, 5)} · {full ? "Full" : `${slotsLeft} slots left`}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            disabled={!selectedTour || !selectedSchedule}
            onClick={() => setStep(2)}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-40 hover:bg-emerald-700 transition-colors">
            Next: Guest Details →
          </button>
        </div>
      )}

      {/* STEP 2 — Guest Details */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
            <h2 className="font-bold text-[#134e4a] mb-4">Lead Customer</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Full Name *</label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                  placeholder="Customer full name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Email</label>
                  <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                    placeholder="email@example.com" type="email" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Phone</label>
                  <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                    placeholder="09XXXXXXXXX" />
                </div>
              </div>
            </div>
          </div>

          {/* Guests */}
          <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#134e4a]">Guests ({guests.length})</h2>
              <button onClick={addGuest}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50">
                + Add Guest
              </button>
            </div>
            <div className="space-y-6">
              {guests.map((g, i) => (
                <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                      Guest {i + 1}{i === 0 ? " (Lead)" : ""}
                    </span>
                    {i > 0 && (
                      <button onClick={() => removeGuest(i)}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold">
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">Full Name *</label>
                      <input value={g.full_name} onChange={(e) => updateGuest(i, "full_name", e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                        placeholder="Full name" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Birthdate</label>
                      <input type="date" value={g.birthdate} onChange={(e) => updateGuest(i, "birthdate", e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Age</label>
                      <input type="number" value={g.age} onChange={(e) => updateGuest(i, "age", e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                        placeholder="Age" min="1" max="120" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">Address</label>
                      <input value={g.address} onChange={(e) => updateGuest(i, "address", e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                        placeholder="Address" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Contact Number</label>
                      <input value={g.contact_number} onChange={(e) => updateGuest(i, "contact_number", e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                        placeholder="09XXXXXXXXX" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Emergency Contact Name</label>
                      <input value={g.emergency_contact_name} onChange={(e) => updateGuest(i, "emergency_contact_name", e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                        placeholder="Emergency contact" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">Emergency Contact Number</label>
                      <input value={g.emergency_contact_number} onChange={(e) => updateGuest(i, "emergency_contact_number", e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                        placeholder="09XXXXXXXXX" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Health Declaration */}
          <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={healthDeclaration} onChange={(e) => setHealthDeclaration(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-600" />
              <span className="text-sm text-gray-600">
                I confirm that all guests are in good health and have no conditions that would prevent them from joining the tour. Health declaration accepted on their behalf.
              </span>
            </label>
          </div>

          {/* Notes */}
          <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
            <label className="text-xs font-semibold text-gray-500 mb-2 block">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 resize-none"
              placeholder="Any special notes..." />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)}
              className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-500 hover:border-gray-300">
              ← Back
            </button>
            <button
              disabled={!customerName || guests.some(g => !g.full_name) || !healthDeclaration}
              onClick={() => setStep(3)}
              className="flex-[2] rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-40 hover:bg-emerald-700 transition-colors">
              Next: Confirm →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — Confirm */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
            <h2 className="font-bold text-[#134e4a] mb-4">Booking Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Tour</span>
                <span className="font-semibold text-[#134e4a]">{selectedTour?.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Date</span>
                <span className="font-semibold text-[#134e4a]">
                  {selectedSchedule && new Date(selectedSchedule.available_date + "T00:00:00").toLocaleDateString("en-PH", {
                    weekday: "short", month: "long", day: "numeric", year: "numeric"
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Departure</span>
                <span className="font-semibold text-[#134e4a]">{selectedSchedule?.departure_time?.slice(0, 5)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Type</span>
                <span className="font-semibold text-[#134e4a] capitalize">{bookingType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Customer</span>
                <span className="font-semibold text-[#134e4a]">{customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Guests</span>
                <span className="font-semibold text-[#134e4a]">{guests.length}</span>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between">
                <span className="text-gray-400">Price per Guest</span>
                <span className="font-semibold">₱{(pricePerPax / 100).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-[#134e4a]">Total Amount</span>
                <span className="font-bold text-emerald-700 text-lg">₱{(totalAmount / 100).toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
              <p className="text-sm font-semibold text-emerald-700">
                💵 Walk-in — Cash collected directly by you
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">This booking will be marked as walk-in and assigned to your account.</p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-600 font-semibold">❌ {error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)}
              className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-500 hover:border-gray-300">
              ← Back
            </button>
            <button onClick={handleSubmit} disabled={submitting}
              className="flex-[2] rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50 hover:bg-emerald-700 transition-colors">
              {submitting ? "Creating..." : "✅ Confirm Walk-in Booking"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
