"use client";

import { useState } from "react";

interface Props {
  bookingType: "joiner" | "private" | "both";
  joinerPriceCents: number | null;
  privatePriceCents: number | null;
  privateIsNegotiable: boolean;
  joinersLeft: number;
  privateLeft: number;
}

export function BookingCalculator({
  bookingType,
  joinerPriceCents,
  privatePriceCents,
  privateIsNegotiable,
  joinersLeft,
  privateLeft,
}: Props) {
  const [selectedType, setSelectedType] = useState<"joiner" | "private">(
    bookingType === "private" ? "private" : "joiner"
  );
  const [pax, setPax] = useState(1);

  const joinerPrice = joinerPriceCents ? joinerPriceCents / 100 : 0;
  const privatePrice = privatePriceCents ? privatePriceCents / 100 : null;

  const totalPrice = selectedType === "joiner"
    ? joinerPrice * pax
    : privatePrice ?? null;

  const maxPax = selectedType === "joiner" ? Math.min(joinersLeft, 20) : 10;

  return (
    <div className="space-y-4">

      {/* Booking type selector */}
      {bookingType === "both" && (
        <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
          <h2 className="font-bold text-[#134e4a] mb-4">Booking Type</h2>
          <div className="grid grid-cols-2 gap-3">
            {joinersLeft > 0 && (
              <label className={`cursor-pointer rounded-xl border-2 p-4 transition-colors ${selectedType === "joiner" ? "border-emerald-500 bg-emerald-50" : "border-emerald-200 hover:border-emerald-400"}`}>
                <input type="radio" name="booking_type" value="joiner"
                  checked={selectedType === "joiner"}
                  onChange={() => { setSelectedType("joiner"); setPax(1); }}
                  className="sr-only" />
                <div className="font-bold text-emerald-800 mb-1">👥 Joiner</div>
                <div className="text-xs text-gray-500 mb-2">Join a shared group trip</div>
                <div className="text-lg font-bold text-emerald-700">
                  ₱{joinerPrice.toLocaleString()}/pax
                </div>
                <div className="text-xs text-gray-400 mt-1">{joinersLeft} slots left</div>
              </label>
            )}
            {privateLeft > 0 && (
              <label className={`cursor-pointer rounded-xl border-2 p-4 transition-colors ${selectedType === "private" ? "border-teal-500 bg-teal-50" : "border-teal-200 hover:border-teal-400"}`}>
                <input type="radio" name="booking_type" value="private"
                  checked={selectedType === "private"}
                  onChange={() => { setSelectedType("private"); setPax(1); }}
                  className="sr-only" />
                <div className="font-bold text-teal-800 mb-1">🔒 Private</div>
                <div className="text-xs text-gray-500 mb-2">Exclusive trip for your group</div>
                <div className="text-lg font-bold text-teal-700">
                  {privateIsNegotiable ? "Negotiable" : privatePrice ? `₱${privatePrice.toLocaleString()}` : "Contact us"}
                </div>
                <div className="text-xs text-gray-400 mt-1">{privateLeft} slot{privateLeft > 1 ? "s" : ""} left</div>
              </label>
            )}
          </div>
        </section>
      )}

      {/* Hidden input if only one type */}
      {bookingType !== "both" && (
        <input type="hidden" name="booking_type" value={bookingType} />
      )}

      {/* Pax counter */}
      <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
        <h2 className="font-bold text-[#134e4a] mb-4">Number of Guests</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <button type="button"
              onClick={() => setPax(p => Math.max(1, p - 1))}
              className="w-10 h-10 rounded-full border-2 border-emerald-200 text-emerald-700 font-bold text-lg hover:bg-emerald-50 transition-colors flex items-center justify-center">
              −
            </button>
            <input type="number" name="total_pax" value={pax} readOnly
              className="w-16 rounded-xl border-2 border-emerald-200 px-2 py-2 text-center text-xl font-bold focus:outline-none" />
            <button type="button"
              onClick={() => setPax(p => Math.min(maxPax, p + 1))}
              className="w-10 h-10 rounded-full border-2 border-emerald-200 text-emerald-700 font-bold text-lg hover:bg-emerald-50 transition-colors flex items-center justify-center">
              +
            </button>
          </div>
          <span className="text-sm text-gray-400">Max {maxPax} guests</span>
        </div>
      </section>

      {/* Price summary */}
      <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5">
        <h2 className="font-bold text-emerald-900 mb-3">💰 Price Summary</h2>
        {selectedType === "joiner" ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>₱{joinerPrice.toLocaleString()} × {pax} guest{pax > 1 ? "s" : ""}</span>
              <span className="font-semibold">₱{(joinerPrice * pax).toLocaleString()}</span>
            </div>
            <div className="border-t border-emerald-200 pt-2 flex justify-between">
              <span className="font-bold text-emerald-900">Total to pay via GCash</span>
              <span className="text-xl font-bold text-emerald-700">₱{(joinerPrice * pax).toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <div className="text-sm">
            {privateIsNegotiable || !privatePrice ? (
              <p className="text-teal-700 font-semibold">
                Private tour price is negotiable. Send a message to confirm the rate before paying.
              </p>
            ) : (
              <div className="flex justify-between">
                <span className="font-bold text-emerald-900">Total to pay via GCash</span>
                <span className="text-xl font-bold text-emerald-700">₱{privatePrice.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Total amount hidden input for backend */}
        <input type="hidden" name="total_amount_cents"
          value={selectedType === "joiner" ? joinerPrice * pax * 100 : (privatePrice ?? 0) * 100} />
      </section>

    </div>
  );
}