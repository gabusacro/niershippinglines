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

interface Passenger {
  full_name: string;
  birthdate: string;
  age: string;
  address: string;
  contact_number: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
}

const emptyPassenger = (): Passenger => ({
  full_name: "",
  birthdate: "",
  age: "",
  address: "",
  contact_number: "",
  emergency_contact_name: "",
  emergency_contact_number: "",
});

export default function ManualBookingPage() {
  const [tours, setTours] = useState<TourPackage[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedTour, setSelectedTour] = useState<TourPackage | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [bookingType, setBookingType] = useState<"joiner" | "private">("joiner");
  const [passengers, setPassengers] = useState<Passenger[]>([emptyPassenger()]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [healthDeclaration, setHealthDeclaration] = useState(false);
  const [customPrice, setCustomPrice] = useState("");
  const [selectedOperatorId, setSelectedOperatorId] = useState("");
  const [operators, setOperators] = useState<{id: string; full_name: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
const [healthText, setHealthText] = useState("I confirm that all passengers are in good health, have no known heart conditions, and are between 6 and 65 years old. Passengers aged 6-17 are accompanied by a parent or guardian.");

useEffect(() => {
  fetch("/api/admin/tours/settings")
    .then((r) => r.json())
    .then((d) => { if (d.settings?.health_declaration_text) setHealthText(d.settings.health_declaration_text); })
    .catch(() => {});
}, []);

  // Load tours on mount
  useEffect(() => {
  fetch("/api/admin/tours/team/operators")
    .then((r) => r.json())
    .then((d) => setOperators(d.operators ?? []))
    .catch(() => {});
}, []);
  useEffect(() => {
    fetch("/api/tours")
      .then((r) => r.json())
      .then((data) => setTours(data.tours ?? data ?? []))
      .catch(() => setError("Failed to load tours"));
  }, []);

  // Load schedules when tour selected
  useEffect(() => {
    if (!selectedTour) return;
    setLoadingSchedules(true);
    setSelectedSchedule(null);
    fetch("/api/tours/availability?tour_id=" + selectedTour.id)
      .then((r) => r.json())
      .then((data) => setSchedules(data.schedules ?? data ?? []))
      .catch(() => setError("Failed to load schedules"))
      .finally(() => setLoadingSchedules(false));
  }, [selectedTour]);

  // Auto-fill customer name from first passenger
useEffect(() => {
  if (passengers[0]?.full_name) {
    setCustomerName(passengers[0].full_name);
  }
}, [passengers[0]?.full_name]);

  function updatePassenger(index: number, field: keyof Passenger, value: string) {
    setPassengers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Auto-calculate age from birthdate
      if (field === "birthdate" && value) {
        const birth = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - birth.getFullYear();
        updated[index].age = String(age);
      }
      return updated;
    });
  }

  function addPassenger() {
    setPassengers((prev) => [...prev, emptyPassenger()]);
  }

  function removePassenger(index: number) {
    if (passengers.length === 1) return;
    setPassengers((prev) => prev.filter((_, i) => i !== index));
  }

  function getUnitPrice(): number {
    if (customPrice) return Math.round(parseFloat(customPrice) * 100);
    if (bookingType === "joiner") return selectedTour?.joiner_price_cents ?? 0;
    if (bookingType === "private") return selectedTour?.private_price_cents ?? 0;
    return 0;
  }

  function getTotalAmount(): number {
    const unit = getUnitPrice();
    if (bookingType === "joiner") return unit * passengers.length;
    return unit; // private = per group
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function getSlotsLeft(): number {
    if (!selectedSchedule) return 0;
    if (bookingType === "joiner") {
      return selectedSchedule.joiner_slots_total - selectedSchedule.joiner_slots_booked;
    }
    return selectedSchedule.private_slots_total - selectedSchedule.private_slots_booked;
  }

  async function handleSubmit() {
    if (!selectedTour || !selectedSchedule) return;
    if (!healthDeclaration) {
      setError("Health declaration must be accepted.");
      return;
    }
    if (passengers.some((p) => !p.full_name || !p.birthdate || !p.address || !p.contact_number || !p.emergency_contact_name || !p.emergency_contact_number)) {
      setError("All passenger fields are required.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("schedule_id", selectedSchedule.id);
    formData.append("tour_id", selectedTour.id);
    formData.append("booking_type", bookingType);
    formData.append("customer_name", customerName || passengers[0].full_name);
    formData.append("customer_email", customerEmail);
    formData.append("customer_phone", customerPhone);
    formData.append("total_pax", String(passengers.length));
    formData.append("unit_price_cents", String(getUnitPrice()));
    formData.append("total_amount_cents", String(getTotalAmount()));
    formData.append("health_declaration_accepted", "true");
    formData.append("passengers", JSON.stringify(passengers));
    if (selectedOperatorId) formData.append("tour_operator_id", selectedOperatorId);


    const response = await fetch("/api/admin/tours/bookings/walk-in", {
      method: "POST",
      body: formData,
      redirect: "follow",
    });

    if (response.redirected) {
      window.location.href = response.url;
    } else {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const canProceedStep1 = selectedTour && selectedSchedule && getSlotsLeft() > 0;
  const canProceedStep2 = passengers.every(
    (p) => p.full_name && p.birthdate && p.address && p.contact_number && p.emergency_contact_name && p.emergency_contact_number
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-emerald-700 mb-4">
        <Link href="/admin" className="hover:underline">Admin</Link>
        <span>/</span>
        <Link href="/admin/tours" className="hover:underline">Tours</Link>
        <span>/</span>
        <span className="font-semibold">Walk-in Booking</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#134e4a]">✍️ Walk-in Booking</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cash collected in person. Booking is confirmed immediately.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {["Tour & Date", "Guests", "Review & Confirm"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold " +
              (step > i + 1
                ? "bg-emerald-600 text-white"
                : step === i + 1
                ? "bg-emerald-600 text-white"
                : "bg-gray-200 text-gray-500")
            }>
              {step > i + 1 ? "✓" : i + 1}
            </div>
            <span className={"text-xs font-medium " + (step === i + 1 ? "text-emerald-700" : "text-gray-400")}>
              {label}
            </span>
            {i < 2 && <div className="w-8 h-px bg-gray-200" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── STEP 1: Tour & Date ── */}
      {step === 1 && (
        <div className="space-y-4">

          {/* Select Tour */}
          <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
            <h2 className="font-bold text-[#134e4a] mb-4">1. Select Tour</h2>
            <div className="grid grid-cols-1 gap-3">
              {tours.filter(t => t.accepts_joiners || t.accepts_private).map((tour) => (
                <button
                  key={tour.id}
                  onClick={() => { setSelectedTour(tour); setBookingType(tour.accepts_joiners ? "joiner" : "private"); }}
                  className={
                    "w-full text-left rounded-xl border-2 px-4 py-3 transition-all " +
                    (selectedTour?.id === tour.id
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 hover:border-emerald-300")
                  }
                >
                  <div className="font-semibold text-[#134e4a]">{tour.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {tour.accepts_joiners && tour.joiner_price_cents
                      ? "Joiners: ₱" + (tour.joiner_price_cents / 100).toLocaleString() + "/pax"
                      : ""}
                    {tour.accepts_joiners && tour.accepts_private ? " · " : ""}
                    {tour.accepts_private
                      ? tour.private_price_cents
                        ? "Private: ₱" + (tour.private_price_cents / 100).toLocaleString()
                        : "Private: Negotiable"
                      : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Booking Type */}
          {selectedTour && (
            <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
              <h2 className="font-bold text-[#134e4a] mb-4">2. Booking Type</h2>
              <div className="flex gap-3">
                {selectedTour.accepts_joiners && (
                  <button
                    onClick={() => setBookingType("joiner")}
                    className={
                      "flex-1 rounded-xl border-2 py-3 text-sm font-bold transition-all " +
                      (bookingType === "joiner"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 text-gray-600 hover:border-emerald-300")
                    }
                  >
                    👥 Joiners
                    <div className="text-xs font-normal mt-0.5">
                      {selectedTour.joiner_price_cents
                        ? "₱" + (selectedTour.joiner_price_cents / 100).toLocaleString() + "/pax"
                        : "—"}
                    </div>
                  </button>
                )}
                {selectedTour.accepts_private && (
                  <button
                    onClick={() => setBookingType("private")}
                    className={
                      "flex-1 rounded-xl border-2 py-3 text-sm font-bold transition-all " +
                      (bookingType === "private"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 text-gray-600 hover:border-emerald-300")
                    }
                  >
                    🔒 Private
                    <div className="text-xs font-normal mt-0.5">
                      {selectedTour.private_price_cents
                        ? "₱" + (selectedTour.private_price_cents / 100).toLocaleString() + " group"
                        : "Negotiable"}
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Select Schedule */}
          {selectedTour && (
            <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
              <h2 className="font-bold text-[#134e4a] mb-4">3. Select Date</h2>
              {loadingSchedules ? (
                <p className="text-sm text-gray-400">Loading schedules...</p>
              ) : schedules.length === 0 ? (
                <p className="text-sm text-gray-400">No open schedules available for this tour.</p>
              ) : (
                <div className="space-y-2">
                  {schedules.map((sched) => {
                    const slotsLeft = bookingType === "joiner"
                      ? sched.joiner_slots_total - sched.joiner_slots_booked
                      : sched.private_slots_total - sched.private_slots_booked;
                    const isFull = slotsLeft <= 0;
                    return (
                      <button
                        key={sched.id}
                        disabled={isFull}
                        onClick={() => setSelectedSchedule(sched)}
                        className={
                          "w-full text-left rounded-xl border-2 px-4 py-3 transition-all " +
                          (isFull
                            ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                            : selectedSchedule?.id === sched.id
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-gray-200 hover:border-emerald-300")
                        }
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-[#134e4a] text-sm">
                              {formatDate(sched.available_date)}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              Departure: {sched.departure_time.slice(0, 5)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={"text-xs font-bold " + (isFull ? "text-red-500" : "text-emerald-600")}>
                              {isFull ? "FULL" : slotsLeft + " slots left"}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Custom Price Override */}
          {selectedTour && selectedSchedule && (
            <div className="rounded-2xl border-2 border-amber-100 bg-amber-50 p-6">
              <h2 className="font-bold text-amber-900 mb-1">Price Override (Optional)</h2>
              <p className="text-xs text-amber-700 mb-3">
                Leave blank to use the default price. For negotiated rates, enter the agreed price here.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-amber-800">₱</span>
                <input
                  type="number"
                  placeholder={
                    bookingType === "joiner" && selectedTour.joiner_price_cents
                      ? String(selectedTour.joiner_price_cents / 100)
                      : bookingType === "private" && selectedTour.private_price_cents
                      ? String(selectedTour.private_price_cents / 100)
                      : "Enter amount"
                  }
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm w-40 focus:outline-none focus:border-amber-400"
                />
                <span className="text-xs text-amber-600">
                  {bookingType === "joiner" ? "per person" : "per group"}
                </span>
              </div>
            </div>
          )}

{/* Assign Operator */}
          <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
            <h2 className="font-bold text-[#134e4a] mb-1">Assign Tour Operator <span className="text-gray-400 font-normal text-sm">(Optional)</span></h2>
            <p className="text-xs text-gray-500 mb-3">Assign this booking to a tour operator. They will see it in their dashboard.</p>
            <select
              value={selectedOperatorId}
              onChange={(e) => setSelectedOperatorId(e.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400">
              <option value="">— No operator assigned —</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>{op.full_name}</option>
              ))}
            </select>
          </div>



          <button
            disabled={!canProceedStep1}
            onClick={() => setStep(2)}
            className={
              "w-full rounded-xl py-3 text-sm font-bold transition-all " +
              (canProceedStep1
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-gray-200 text-gray-400 cursor-not-allowed")
            }
          >
            Next: Add Passengers
          </button>
        </div>
      )}

      {/* ── STEP 2: Passengers ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#134e4a]">Guest Details</h2>
              <span className="text-xs text-gray-400">{passengers.length} guest/s</span>
            </div>

            <div className="space-y-6">
              {passengers.map((p, i) => (
                <div key={i} className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-emerald-700">
                      Passenger {i + 1} {i === 0 ? "(Lead)" : ""}
                    </span>
                    {i > 0 && (
                      <button
                        onClick={() => removePassenger(i)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">Full Name *</label>
                      <input
                        type="text"
                        value={p.full_name}
                        onChange={(e) => updatePassenger(i, "full_name", e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                        placeholder="Juan Dela Cruz"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Birthdate *</label>
                      <input
                        type="date"
                        value={p.birthdate}
                        onChange={(e) => updatePassenger(i, "birthdate", e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Age</label>
                      <input
                        type="number"
                        value={p.age}
                        onChange={(e) => updatePassenger(i, "age", e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                        placeholder="Auto-filled"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">Address *</label>
                      <input
                        type="text"
                        value={p.address}
                        onChange={(e) => updatePassenger(i, "address", e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                        placeholder="City, Province"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Contact Number *</label>
                      <input
                        type="tel"
                        value={p.contact_number}
                        onChange={(e) => updatePassenger(i, "contact_number", e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                        placeholder="09XX XXX XXXX"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Emergency Contact Name *</label>
                      <input
                        type="text"
                        value={p.emergency_contact_name}
                        onChange={(e) => updatePassenger(i, "emergency_contact_name", e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                        placeholder="Maria Cruz"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 mb-1 block">Emergency Contact Number *</label>
                      <input
                        type="tel"
                        value={p.emergency_contact_number}
                        onChange={(e) => updatePassenger(i, "emergency_contact_number", e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                        placeholder="09XX XXX XXXX"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {bookingType === "joiner" && (
              <button
                onClick={addPassenger}
                className="mt-4 w-full rounded-xl border-2 border-dashed border-emerald-300 py-2.5 text-sm font-semibold text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50 transition-all"
              >
                + Add Another Guest
              </button>
            )}
          </div>

          {/* Customer contact info */}
          <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
            <h2 className="font-bold text-[#134e4a] mb-4">Lead Customer Contact</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Full Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                  placeholder="Auto-filled from Guest 1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Email (optional)</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Phone (optional)</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                  placeholder="09XX XXX XXXX"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              disabled={!canProceedStep2}
              onClick={() => setStep(3)}
              className={
                "flex-1 rounded-xl py-3 text-sm font-bold transition-all " +
                (canProceedStep2
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed")
              }
            >
              Next: Review
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Review & Confirm ── */}
      {step === 3 && selectedTour && selectedSchedule && (
        <div className="space-y-4">

          {/* Summary */}
          <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
            <h2 className="font-bold text-[#134e4a] mb-4">Booking Summary</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Tour</p>
                <p className="font-semibold text-[#134e4a]">{selectedTour.title}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Date</p>
                <p className="font-semibold text-[#134e4a]">{formatDate(selectedSchedule.available_date)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Departure</p>
                <p className="font-semibold text-[#134e4a]">{selectedSchedule.departure_time.slice(0, 5)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Type</p>
                <p className="font-semibold text-[#134e4a] capitalize">{bookingType}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Guests</p>
                <p className="font-semibold text-[#134e4a]">{passengers.length}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Payment</p>
                <p className="font-semibold text-emerald-600">💵 Cash (Walk-in)</p>
              </div>
            </div>

            {/* Price breakdown */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              {bookingType === "joiner" ? (
                <>
                  <div className="flex justify-between text-sm text-gray-500 mb-1">
                    <span>₱{(getUnitPrice() / 100).toLocaleString()} x {passengers.length} pax</span>
                    <span>₱{(getTotalAmount() / 100).toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-sm text-gray-500 mb-1">
                  <span>Private group rate</span>
                  <span>₱{(getTotalAmount() / 100).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-emerald-700 mt-2">
                <span>Total Collected</span>
                <span>₱{(getTotalAmount() / 100).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Passengers preview */}
          <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
            <h2 className="font-bold text-[#134e4a] mb-3">Guests</h2>
            <div className="space-y-2">
              {passengers.map((p, i) => (
                <div key={i} className="flex items-start justify-between text-sm py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-semibold text-[#134e4a]">{p.full_name}</p>
                    <p className="text-xs text-gray-400">{p.address} · Age {p.age}</p>
                  </div>
                  <span className="text-xs text-gray-400">{p.contact_number}</span>
                </div>
              ))}
            </div>
          </div>

     {/* Health declaration */}
<div className="rounded-2xl border-2 border-amber-100 bg-amber-50 p-6">
  <label className="flex items-start gap-3 cursor-pointer">
    <input
      type="checkbox"
      checked={healthDeclaration}
      onChange={(e) => setHealthDeclaration(e.target.checked)}
      className="mt-0.5 w-4 h-4 accent-emerald-600"
    />
    <span className="text-sm text-amber-800">
      <strong>Health Declaration — </strong>
      {healthText} Cash payment of{" "}
      <strong>₱{(getTotalAmount() / 100).toLocaleString()}</strong> has been collected.
    </span>
  </label>
</div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              disabled={!healthDeclaration || loading}
              onClick={handleSubmit}
              className={
                "flex-1 rounded-xl py-3 text-sm font-bold transition-all " +
                (healthDeclaration && !loading
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed")
              }
            >
              {loading ? "Creating booking..." : "✅ Confirm Walk-in Booking"}
            </button>
          </div>

          <p className="text-center text-xs text-gray-400">
            This booking will be immediately confirmed. No GCash verification needed.
          </p>
        </div>
      )}

    </div>
  );
}
