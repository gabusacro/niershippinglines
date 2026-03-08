"use client";

import { useState } from "react";
import { BookingCalculator } from "@/components/tours/BookingCalculator";
import BookingPassengers from "@/components/tours/BookingPassengers";

interface Props {
  tour: {
    id: string;
    price_per_pax_cents: number | null;
    private_price_cents: number | null;
    private_is_negotiable: boolean;
    requires_health_declaration: boolean;
  };
  schedule: {
    id: string;
    joiner_slots_total: number;
    joiner_slots_booked: number;
    private_slots_total: number;
    private_slots_booked: number;
    departure_time: string;
  } | null;
  bookingType: "joiner" | "private" | "both";
  profileName: string;
  profileMobile: string;
  userEmail: string;
  userId: string;
}

export default function TourBookingForm({
  tour,
  schedule,
  bookingType,
  profileName,
  profileMobile,
  userEmail,
  userId,
}: Props) {
  const [actualPax, setActualPax] = useState(1);
  const [selectedType, setSelectedType] = useState<"joiner" | "private">(
    bookingType === "private" ? "private" : "joiner"
  );

  const joinersLeft = schedule
    ? schedule.joiner_slots_total - schedule.joiner_slots_booked
    : 20;
  const privateLeft = schedule
    ? schedule.private_slots_total - schedule.private_slots_booked
    : 1;

  return (
    <form action="/api/tours/book" method="POST" encType="multipart/form-data" className="space-y-6">
      {/* Hidden fields */}
      <input type="hidden" name="tour_id" value={tour.id} />
      <input type="hidden" name="schedule_id" value={schedule?.id ?? ""} />
      <input type="hidden" name="booked_by" value={userId} />

      {/* Booking Calculator */}
      <BookingCalculator
        bookingType={bookingType}
        joinerPriceCents={tour.price_per_pax_cents}
        privatePriceCents={tour.private_price_cents}
        privateIsNegotiable={tour.private_is_negotiable ?? false}
        joinersLeft={joinersLeft}
        privateLeft={privateLeft}
        onPaxChange={setActualPax}
        onTypeChange={setSelectedType}
      />

      {/* Contact Info */}
      <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6 space-y-4">
        <h2 className="font-bold text-[#134e4a]">📋 Contact Information</h2>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Full Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="customer_name"
            defaultValue={profileName}
            required
            placeholder="Juan Dela Cruz"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Email Address <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            name="customer_email"
            defaultValue={userEmail}
            required
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Phone Number <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            name="customer_phone"
            defaultValue={profileMobile}
            required
            placeholder="09XX XXX XXXX"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>
      </section>

      {/* Tourist Manifest */}
      <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
        {/* For private — show note about actual headcount vs billing */}
        {selectedType === "private" && (
          <div className="mb-4 rounded-xl bg-teal-50 border border-teal-200 p-3">
            <p className="text-xs text-teal-700 font-semibold">
              🔒 Private tour is billed for 12 pax regardless of group size.
              Please enter details for your <strong>actual number of guests</strong> below (for tourism office records).
            </p>
          </div>
        )}
        <BookingPassengers
          totalPax={actualPax}
          profileName={profileName}
          profileMobile={profileMobile}
        />
      </section>

      {/* GCash Payment */}
      <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6 space-y-4">
        <h2 className="font-bold text-[#134e4a]">💚 GCash Payment</h2>
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
          <p className="text-sm font-semibold text-emerald-800 mb-1">Send payment to:</p>
          <p className="text-2xl font-black text-emerald-700 tracking-wide">0946 365 7331</p>
          <p className="text-xs text-emerald-600 mt-1">Gabriel Sacro · Travela Siargao</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Upload GCash Screenshot <span className="text-red-400">*</span>
          </label>
          <input
            type="file"
            name="gcash_screenshot"
            accept="image/*"
            required
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1 file:text-emerald-700 file:font-semibold hover:file:bg-emerald-100"
          />
        </div>
      </section>

      {/* Health Declaration */}
      {tour.requires_health_declaration && (
        <section className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6">
          <h2 className="font-bold text-amber-900 mb-3">⚕️ Health Declaration</h2>
          <p className="text-sm text-amber-800 mb-4 leading-relaxed">
            I confirm that I and all members of my group are physically fit to join this tour.
            We do not have any serious heart conditions, respiratory illnesses, or physical
            disabilities that may put us at risk during water or land activities.
            We understand that participants must be between 6–65 years old.
          </p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="health_declaration_accepted"
              value="true"
              required
              className="mt-0.5 h-4 w-4 rounded border-amber-300 text-emerald-600 focus:ring-emerald-300"
            />
            <span className="text-sm font-semibold text-amber-900">
              I confirm the above health declaration for all tourists in this booking.
            </span>
          </label>
        </section>
      )}

      {/* Submit */}
      <button
        type="submit"
        className="w-full rounded-2xl bg-emerald-600 py-4 text-base font-bold text-white hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
      >
        Submit Booking →
      </button>
      <p className="text-center text-xs text-gray-400">
        Your booking is pending until payment is verified by our team.
      </p>
    </form>
  );
}
