"use client";

import { useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────
type ParkingLot = {
  id: string;
  name: string;
  slug: string;
  address: string;
  description: string | null;
  distance_from_port: string | null;
  total_slots_car: number;
  total_slots_motorcycle: number;
  total_slots_van: number;
  total_slots_truck: number;
  car_rate_cents: number | null;
  motorcycle_rate_cents: number | null;
  van_rate_cents: number | null;
  truck_rate_cents: number | null;
  is_24hrs: boolean;
  available_car: number;
  available_motorcycle: number;
  available_van: number;
  available_truck: number;
};

type Settings = {
  carRate: number;
  motorcycleRate: number;
  vanRate: number | null;
  truckRate: number | null;
  platformFee: number;
  processingFee: number;
  commission: number;
  maxDays: number;
  requiredDocs: string;
};

type Props = { lots: ParkingLot[]; settings: Settings };

// ── Helpers ───────────────────────────────────────────────────────────────────
function peso(cents: number) {
  return `₱${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0 })}`;
}

function getRate(lot: ParkingLot, type: string, settings: Settings): number | null {
  if (type === "car")        return lot.car_rate_cents        ?? settings.carRate;
  if (type === "motorcycle") return lot.motorcycle_rate_cents ?? settings.motorcycleRate;
  if (type === "van")        return lot.van_rate_cents        ?? settings.vanRate;
  if (type === "truck")      return lot.truck_rate_cents      ?? settings.truckRate;
  return null;
}

function getAvailable(lot: ParkingLot, type: string): number {
  if (type === "car")        return lot.available_car;
  if (type === "motorcycle") return lot.available_motorcycle;
  if (type === "van")        return lot.available_van;
  if (type === "truck")      return lot.available_truck;
  return 0;
}

function getTotal(lot: ParkingLot, type: string): number {
  if (type === "car")        return lot.total_slots_car;
  if (type === "motorcycle") return lot.total_slots_motorcycle;
  if (type === "van")        return lot.total_slots_van;
  if (type === "truck")      return lot.total_slots_truck;
  return 0;
}

function getTodayLocal() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

const VEHICLE_TYPES = [
  { value: "car",        label: "Car",        emoji: "🚗" },
  { value: "motorcycle", label: "Motorcycle", emoji: "🏍️" },
  { value: "van",        label: "Van",        emoji: "🚐" },
  { value: "truck",      label: "Truck",      emoji: "🚛" },
];

const ID_TYPES = [
  { value: "driver_license", label: "Driver's License" },
  { value: "umid",           label: "UMID" },
  { value: "passport",       label: "Passport" },
  { value: "philsys",        label: "PhilSys / National ID" },
  { value: "prc",            label: "PRC ID" },
  { value: "voter_id",       label: "Voter's ID" },
  { value: "other",          label: "Other Government ID" },
];

// ── Slot Bar ──────────────────────────────────────────────────────────────────
function SlotBar({ available, total, type, emoji }: { available: number; total: number; type: string; emoji: string }) {
  if (total === 0) return null;
  const pct = Math.max(0, Math.min(100, (available / total) * 100));
  const color = available === 0 ? "bg-red-400" : available <= total * 0.2 ? "bg-amber-400" : "bg-emerald-400";
  const textColor = available === 0 ? "text-red-700" : available <= total * 0.2 ? "text-amber-700" : "text-emerald-700";
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm w-5">{emoji}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-16 text-right ${textColor}`}>
        {available === 0 ? "FULL" : `${available}/${total}`}
      </span>
    </div>
  );
}

// ── Booking Modal ─────────────────────────────────────────────────────────────
function BookingModal({ lot, settings, onClose }: { lot: ParkingLot; settings: Settings; onClose: () => void }) {
  const today = getTodayLocal();

  const [vehicles, setVehicles] = useState([{
    vehicle_type: "car" as string,
    plate_number: "",
    make_model: "",
    color: "",
    or_cr_number: "",
    driver_id_type: "driver_license",
    driver_id_number: "",
  }]);
  const [dateStart, setDateStart] = useState(today);
  const [days, setDays]     = useState(1);
  const [step, setStep]     = useState<"vehicles" | "confirm" | "success">("vehicles");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  // Calculate totals
  const vehicleCount = vehicles.length;
  const parkingFee   = vehicles.reduce((sum, v) => {
    const rate = getRate(lot, v.vehicle_type, settings) ?? 0;
    return sum + rate * days;
  }, 0);
  const commission    = settings.commission * vehicleCount;
  const platformFee   = settings.platformFee;
  const processingFee = settings.processingFee;
  const total         = parkingFee + platformFee + processingFee;

  function addVehicle() {
    setVehicles(v => [...v, { vehicle_type: "car", plate_number: "", make_model: "", color: "", or_cr_number: "", driver_id_type: "driver_license", driver_id_number: "" }]);
  }
  function removeVehicle(i: number) {
    setVehicles(v => v.filter((_, idx) => idx !== i));
  }
  function updateVehicle(i: number, field: string, val: string) {
    setVehicles(v => v.map((veh, idx) => idx === i ? { ...veh, [field]: val } : veh));
  }

  function validateVehicles() {
    for (const [i, v] of vehicles.entries()) {
      if (!v.plate_number.trim())    return `Vehicle ${i + 1}: plate number is required.`;
      if (!v.or_cr_number.trim())    return `Vehicle ${i + 1}: OR/CR number is required.`;
      if (!v.driver_id_number.trim()) return `Vehicle ${i + 1}: ID number is required.`;
      const avail = getAvailable(lot, v.vehicle_type);
      if (avail <= 0) return `No available ${v.vehicle_type} slots for this lot.`;
    }
    return null;
  }

  function handleNext() {
    setError(null);
    const err = validateVehicles();
    if (err) { setError(err); return; }
    setStep("confirm");
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/parking/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lot_id: lot.id,
          vehicles,
          park_date_start: dateStart,
          total_days: days,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Reservation failed."); setStep("vehicles"); return; }
      setReference(data.reference);
      setStep("success");
    } catch {
      setError("Network error. Please try again.");
      setStep("vehicles");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "w-full rounded-xl border-2 border-teal-100 bg-white px-3 py-2.5 text-[#134e4a] text-sm focus:border-[#0c7b93] focus:outline-none focus:ring-2 focus:ring-[#0c7b93]/20";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-teal-100 flex items-center justify-between shrink-0"
          style={{ background: "linear-gradient(135deg,#064e3b,#0c7b93)" }}>
          <div>
            <p className="text-xs text-white/60 font-semibold uppercase tracking-wide">Reserve Parking</p>
            <h2 className="text-base font-black text-white">{lot.name}</h2>
            <p className="text-xs text-white/70">📍 {lot.distance_from_port}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors text-lg">×</button>
        </div>

        {step === "success" ? (
          <div className="flex-1 overflow-y-auto p-6 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-xl font-black text-emerald-900">Booking Submitted!</h3>
            <div className="mt-3 inline-block rounded-xl bg-teal-50 border-2 border-teal-200 px-6 py-3">
              <p className="text-xs text-[#0f766e] mb-1">Your reference number</p>
              <span className="font-mono text-xl font-black text-[#0c7b93]">{reference}</span>
            </div>
            <p className="mt-4 text-sm text-gray-600 max-w-xs mx-auto">
              Send your GCash payment and upload the screenshot on your booking page. Admin will confirm shortly.
            </p>
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 text-left">
              <p className="font-semibold mb-2">📋 Bring on arrival:</p>
              <ul className="text-xs space-y-1">
                <li>• Valid government-issued ID</li>
                <li>• OR/CR for each vehicle</li>
                <li>• Reference: <strong>{reference}</strong></li>
              </ul>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Link href="/dashboard" onClick={onClose}
                className="w-full rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-bold text-white hover:bg-[#085f72] transition-colors">
                View My Booking →
              </Link>
              <button onClick={onClose}
                className="w-full rounded-xl border-2 border-teal-200 px-4 py-3 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 transition-colors">
                Close
              </button>
            </div>
          </div>

        ) : step === "confirm" ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <h3 className="font-bold text-[#134e4a]">Review Your Booking</h3>

            {/* Vehicles summary */}
            <div className="rounded-xl border-2 border-teal-100 overflow-hidden">
              <div className="bg-teal-50 px-4 py-2 text-xs font-bold text-[#134e4a] uppercase tracking-wide">
                {vehicles.length} Vehicle{vehicles.length > 1 ? "s" : ""}
              </div>
              {vehicles.map((v, i) => (
                <div key={i} className="px-4 py-3 border-b border-teal-50 last:border-0 text-sm">
                  <div className="flex items-center gap-2">
                    <span>{VEHICLE_TYPES.find(t => t.value === v.vehicle_type)?.emoji}</span>
                    <span className="font-semibold text-[#134e4a]">{v.plate_number.toUpperCase()}</span>
                    <span className="text-gray-400">{v.make_model}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">OR/CR: {v.or_cr_number}</div>
                </div>
              ))}
            </div>

            {/* Dates */}
            <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#0f766e]">Check-in date</span>
                <span className="font-semibold text-[#134e4a]">{dateStart}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[#0f766e]">Duration</span>
                <span className="font-semibold text-[#134e4a]">{days} day{days !== 1 ? "s" : ""}</span>
              </div>
            </div>

            {/* Payment breakdown */}
            <div className="rounded-xl border-2 border-teal-200 overflow-hidden">
              <div className="bg-teal-50 px-4 py-2 text-xs font-bold text-[#134e4a] uppercase tracking-wide">
                Payment Breakdown
              </div>
              <div className="px-4 py-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Parking fee ({vehicles.length} vehicle{vehicles.length > 1 ? "s" : ""} × {days} day{days > 1 ? "s" : ""})</span>
                  <span className="font-semibold text-[#134e4a]">{peso(parkingFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Platform Service Fee</span>
                  <span className="text-[#134e4a]">{peso(platformFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Processing Fee</span>
                  <span className="text-[#134e4a]">{peso(processingFee)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t-2 border-teal-200">
                  <span className="font-black text-[#134e4a]">Total to Pay</span>
                  <span className="font-black text-xl text-[#0c7b93]">{peso(total)}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center">
              No refunds after booking. You may extend your stay from your dashboard.
            </p>

            {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

            <div className="flex gap-3">
              <button onClick={() => setStep("vehicles")}
                className="flex-1 rounded-xl border-2 border-teal-200 px-4 py-3 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
                ← Back
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 rounded-xl bg-[#0c7b93] px-4 py-3 text-sm font-bold text-white hover:bg-[#085f72] disabled:opacity-50 transition-colors">
                {submitting ? "Submitting…" : "Confirm & Pay via GCash"}
              </button>
            </div>
          </div>

        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Date & Duration */}
            <div>
              <p className="text-xs font-bold text-[#134e4a] uppercase tracking-wide mb-3">📅 Parking Duration</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#134e4a] block mb-1">Start Date</label>
                  <input type="date" value={dateStart} min={today}
                    onChange={e => setDateStart(e.target.value)}
                    className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#134e4a] block mb-1">Days (max {settings.maxDays})</label>
                  <input type="number" min={1} max={settings.maxDays} value={days}
                    onChange={e => setDays(Math.max(1, Math.min(settings.maxDays, parseInt(e.target.value) || 1)))}
                    className={inputCls} />
                </div>
              </div>
            </div>

            {/* Vehicles */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-[#134e4a] uppercase tracking-wide">🚗 Vehicles</p>
                <button onClick={addVehicle} type="button"
                  className="text-xs font-bold text-[#0c7b93] hover:underline">
                  + Add vehicle
                </button>
              </div>

              <div className="space-y-4">
                {vehicles.map((v, i) => (
                  <div key={i} className="rounded-xl border-2 border-teal-100 p-4 relative">
                    {vehicles.length > 1 && (
                      <button onClick={() => removeVehicle(i)} type="button"
                        className="absolute top-3 right-3 text-red-400 hover:text-red-600 text-xs font-semibold">
                        Remove
                      </button>
                    )}
                    <p className="text-xs font-bold text-[#0c7b93] mb-3">Vehicle {i + 1}</p>

                    {/* Vehicle type with live slot count */}
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-[#134e4a] block mb-1">Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {VEHICLE_TYPES.filter(t => getTotal(lot, t.value) > 0).map(t => {
                          const avail = getAvailable(lot, t.value);
                          const rate  = getRate(lot, t.value, settings);
                          return (
                            <button key={t.value} type="button"
                              onClick={() => updateVehicle(i, "vehicle_type", t.value)}
                              disabled={avail <= 0}
                              className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                                v.vehicle_type === t.value
                                  ? "border-[#0c7b93] bg-teal-50"
                                  : avail <= 0
                                  ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                                  : "border-teal-100 hover:border-teal-300"
                              }`}>
                              <div className="text-base">{t.emoji}</div>
                              <div className="text-xs font-semibold text-[#134e4a]">{t.label}</div>
                              <div className="text-xs text-[#0f766e]">{rate ? peso(rate) + "/day" : "—"}</div>
                              <div className={`text-xs font-bold ${avail === 0 ? "text-red-500" : avail <= 3 ? "text-amber-600" : "text-emerald-600"}`}>
                                {avail === 0 ? "Full" : `${avail} left`}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <label className="text-xs font-semibold text-[#134e4a] block mb-1">Plate Number *</label>
                        <input type="text" value={v.plate_number}
                          onChange={e => updateVehicle(i, "plate_number", e.target.value.toUpperCase())}
                          placeholder="ABC 1234" className={inputCls}
                          style={{ textTransform: "uppercase" }} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-[#134e4a] block mb-1">Make & Model</label>
                        <input type="text" value={v.make_model}
                          onChange={e => updateVehicle(i, "make_model", e.target.value)}
                          placeholder="Toyota Vios" className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-[#134e4a] block mb-1">Color</label>
                        <input type="text" value={v.color}
                          onChange={e => updateVehicle(i, "color", e.target.value)}
                          placeholder="White" className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-[#134e4a] block mb-1">OR/CR Number *</label>
                        <input type="text" value={v.or_cr_number}
                          onChange={e => updateVehicle(i, "or_cr_number", e.target.value)}
                          placeholder="Registration #" className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-[#134e4a] block mb-1">ID Type *</label>
                        <select value={v.driver_id_type}
                          onChange={e => updateVehicle(i, "driver_id_type", e.target.value)}
                          className={inputCls}>
                          {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-semibold text-[#134e4a] block mb-1">ID Number *</label>
                        <input type="text" value={v.driver_id_number}
                          onChange={e => updateVehicle(i, "driver_id_number", e.target.value)}
                          placeholder="ID number" className={inputCls} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live fee preview */}
            <div className="rounded-xl bg-teal-50 border-2 border-teal-200 px-4 py-3">
              <div className="flex justify-between text-sm">
                <span className="text-[#0f766e]">{vehicles.length} vehicle{vehicles.length > 1 ? "s" : ""} × {days} day{days > 1 ? "s" : ""}</span>
                <span className="font-semibold text-[#134e4a]">{peso(parkingFee)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Platform + Processing fees</span>
                <span>{peso(platformFee + processingFee)}</span>
              </div>
              <div className="flex justify-between font-black text-base mt-2 pt-2 border-t border-teal-200">
                <span className="text-[#134e4a]">Total</span>
                <span className="text-[#0c7b93]">{peso(total)}</span>
              </div>
            </div>

            {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

            <button onClick={handleNext} type="button"
              className="w-full min-h-[52px] rounded-xl bg-[#0c7b93] font-bold text-white text-sm hover:bg-[#085f72] transition-colors shadow-sm">
              Review Booking →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Lot Card ──────────────────────────────────────────────────────────────────
function LotCard({ lot, settings, onBook }: { lot: ParkingLot; settings: Settings; onBook: () => void }) {
  const totalAvailable = lot.available_car + lot.available_motorcycle + lot.available_van + lot.available_truck;
  const totalAll = lot.total_slots_car + lot.total_slots_motorcycle + lot.total_slots_van + lot.total_slots_truck;
  const isFull = totalAvailable === 0;

  return (
    <div className={`rounded-2xl border-2 bg-white shadow-sm overflow-hidden transition-all hover:shadow-md ${isFull ? "border-red-200" : "border-teal-200 hover:border-[#0c7b93]"}`}>
      {/* Color bar */}
      <div className={`h-1.5 ${isFull ? "bg-red-400" : "bg-gradient-to-r from-[#0c7b93] to-emerald-400"}`} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="font-black text-[#134e4a] text-base leading-tight">{lot.name}</h3>
            <p className="text-xs text-[#0f766e] mt-0.5">📍 {lot.distance_from_port ?? lot.address}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
            isFull
              ? "bg-red-100 text-red-700"
              : totalAvailable <= totalAll * 0.2
              ? "bg-amber-100 text-amber-700"
              : "bg-emerald-100 text-emerald-700"
          }`}>
            {isFull ? "FULL" : `${totalAvailable} avail.`}
          </span>
        </div>

        {/* Slot bars */}
        <div className="space-y-2 mb-4">
          {lot.total_slots_car        > 0 && <SlotBar available={lot.available_car}        total={lot.total_slots_car}        type="car"        emoji="🚗" />}
          {lot.total_slots_motorcycle > 0 && <SlotBar available={lot.available_motorcycle} total={lot.total_slots_motorcycle} type="motorcycle" emoji="🏍️" />}
          {lot.total_slots_van        > 0 && <SlotBar available={lot.available_van}        total={lot.total_slots_van}        type="van"        emoji="🚐" />}
          {lot.total_slots_truck      > 0 && <SlotBar available={lot.available_truck}      total={lot.total_slots_truck}      type="truck"      emoji="🚛" />}
        </div>

        {/* Rates row */}
        <div className="flex flex-wrap gap-2 mb-4">
          {lot.total_slots_car > 0 && (
            <span className="rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-xs font-semibold text-[#0c7b93]">
              🚗 {peso(lot.car_rate_cents ?? settings.carRate)}/day
            </span>
          )}
          {lot.total_slots_motorcycle > 0 && (
            <span className="rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-xs font-semibold text-[#0c7b93]">
              🏍️ {peso(lot.motorcycle_rate_cents ?? settings.motorcycleRate)}/day
            </span>
          )}
        </div>

        <button onClick={onBook} disabled={isFull}
          className={`w-full min-h-[44px] rounded-xl font-bold text-sm transition-colors ${
            isFull
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-[#0c7b93] text-white hover:bg-[#085f72] shadow-sm"
          }`}>
          {isFull ? "No slots available" : "Reserve a Slot →"}
        </button>
      </div>
    </div>
  );
}

// ── Main Client Component ─────────────────────────────────────────────────────
export default function ParkingLotsClient({ lots, settings }: Props) {
  const [selectedLot, setSelectedLot] = useState<ParkingLot | null>(null);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f6f0" }}>

      {/* Hero */}
      <div className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#064e3b 0%,#0c7b93 55%,#0891b2 100%)" }}>
        <svg className="absolute bottom-0 left-0 w-full pointer-events-none" viewBox="0 0 1440 80"
          preserveAspectRatio="none" style={{ opacity: 0.12 }}>
          <path d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,20 1440,40 L1440,80 L0,80 Z" fill="white"/>
        </svg>
        <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex items-center gap-5">
            <div className="text-5xl">🚗</div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/60">Travela Siargao</p>
              <h1 className="text-3xl sm:text-4xl font-black text-white mt-1">Pay Parking</h1>
              <p className="text-white/80 text-sm mt-2 max-w-md">
                Safe, monitored parking near Dapa Port. Reserve online, pay via GCash.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">₱250/day</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">Up to {settings.maxDays} days</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">24/7 monitored</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-10">

        {/* Lot cards */}
        <div>
          <h2 className="text-xl font-black text-[#134e4a] mb-1">Available Parking Lots</h2>
          <p className="text-sm text-[#0f766e] mb-5">
            Live slot availability — updated in real time. Click a lot to reserve.
          </p>
          {lots.length === 0 ? (
            <div className="rounded-2xl border-2 border-teal-100 bg-white p-10 text-center">
              <div className="text-4xl mb-3">🚗</div>
              <p className="font-bold text-[#134e4a]">Parking lots coming soon</p>
              <p className="text-sm text-[#0f766e] mt-1">Contact us for walk-in parking.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {lots.map(lot => (
                <LotCard key={lot.id} lot={lot} settings={settings} onBook={() => setSelectedLot(lot)} />
              ))}
            </div>
          )}
        </div>

        {/* How it works */}
        <div>
          <h2 className="text-xl font-black text-[#134e4a] mb-5">How It Works</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { emoji: "📋", title: "Reserve Online", desc: "Pick your lot, vehicle type, and dates. Booking locks your slot immediately." },
              { emoji: "💸", title: "Pay via GCash", desc: "Send payment to our GCash number and upload your screenshot." },
              { emoji: "✅", title: "Get Confirmed", desc: "Admin confirms. You receive a QR code reference to your booking." },
              { emoji: "🔑", title: "Scan & Park", desc: "Arrive with your ID and OR/CR. Staff scans your QR for entry and exit." },
            ].map((s, i) => (
              <div key={i} className="rounded-2xl bg-white border-2 border-teal-100 p-5 relative overflow-hidden">
                <div className="absolute top-3 right-3 text-5xl font-black opacity-[0.04] text-[#0c7b93]">{i + 1}</div>
                <div className="text-3xl mb-3">{s.emoji}</div>
                <h3 className="font-bold text-[#134e4a] text-sm mb-1">{s.title}</h3>
                <p className="text-xs text-[#0f766e] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Requirements */}
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6">
          <h2 className="text-base font-bold text-amber-900 mb-3">📋 Required Documents</h2>
          <p className="text-sm text-amber-800 mb-4">{settings.requiredDocs}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { icon: "🪪", label: "Valid Government-Issued ID", sub: "UMID, Driver's License, Passport, PhilSys, etc." },
              { icon: "📄", label: "OR/CR (Official Receipt & Certificate of Registration)", sub: "Current registration required for every vehicle." },
            ].map(r => (
              <div key={r.label} className="flex items-start gap-3 rounded-xl bg-white/70 p-3 border border-amber-200">
                <span className="text-2xl shrink-0">{r.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-amber-900">{r.label}</p>
                  <p className="text-xs text-amber-700 mt-0.5">{r.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Policy */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-bold text-gray-700 mb-3">⚠️ Parking Policy</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2"><span className="text-teal-500 shrink-0">•</span>Maximum parking duration is <strong>{settings.maxDays} days</strong>. Extend from your dashboard before expiry.</li>
            <li className="flex items-start gap-2"><span className="text-teal-500 shrink-0">•</span>Booking a slot reserves it for your entire selected period. <strong>No refunds</strong> after booking is confirmed.</li>
            <li className="flex items-start gap-2"><span className="text-teal-500 shrink-0">•</span>Rate is locked at booking time and will not change for the duration of your stay.</li>
            <li className="flex items-start gap-2"><span className="text-amber-500 shrink-0">•</span>Overstay beyond your booked period requires settlement before vehicle exit.</li>
          </ul>
        </div>

        {/* CTA links */}
        <div className="flex flex-wrap gap-3 justify-center pb-4">
          <Link href="/#book" className="rounded-xl bg-[#0c7b93] px-6 py-3 text-sm font-bold text-white hover:bg-[#085f72] transition-colors shadow-sm">
            🚢 Book Ferry Ticket
          </Link>
          <Link href="/tours" className="rounded-xl border-2 border-teal-200 bg-white px-6 py-3 text-sm font-semibold text-[#134e4a] hover:bg-teal-50 transition-colors">
            🏝️ Explore Tours
          </Link>
        </div>
      </div>

      {/* Booking modal */}
      {selectedLot && (
        <BookingModal lot={selectedLot} settings={settings} onClose={() => setSelectedLot(null)} />
      )}
    </div>
  );
}
