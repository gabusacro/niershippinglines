"use client";

import { useState } from "react";

export default function ToursContactForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      inquiry_type: formData.get("inquiry_type"),
      message: formData.get("message"),
    };

    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to send inquiry");

      setSuccess(true);
      form.reset();
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="bg-emerald-500 text-white rounded-2xl p-6 text-center shadow">
        <h3 className="text-lg font-semibold">Inquiry Sent</h3>
        <p className="text-sm opacity-90 mt-1">
          Our support team will contact you shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-xl rounded-2xl p-8 border mt-12">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Trip Assistance</h2>
        <p className="text-gray-500 text-sm">
          Send our team a message and we'll help plan your trip.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">

        <input
          name="name"
          required
          placeholder="Full name"
          className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-teal-500"
        />

        <input
          name="phone"
          placeholder="Phone number"
          className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-teal-500"
        />

        <input
          name="email"
          type="email"
          required
          placeholder="Email address"
          className="border rounded-lg px-4 py-2 md:col-span-2 focus:ring-2 focus:ring-teal-500"
        />

        <select
          name="inquiry_type"
          required
          className="border rounded-lg px-4 py-2 md:col-span-2 focus:ring-2 focus:ring-teal-500"
        >
          <option value="">Select inquiry type</option>
          <option value="tour">Tour booking</option>
          <option value="boat">Boat ticket</option>
          <option value="parking">Parking</option>
          <option value="support">General support</option>
        </select>

        <textarea
          name="message"
          rows={4}
          required
          placeholder="How can we help?"
          className="border rounded-lg px-4 py-2 md:col-span-2 focus:ring-2 focus:ring-teal-500"
        />

        {error && (
          <div className="text-red-500 text-sm md:col-span-2">
            {error}
          </div>
        )}

        <button
          disabled={loading}
          className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg py-2 font-medium md:col-span-2 transition"
        >
          {loading ? "Sending..." : "Send Message"}
        </button>

      </form>
    </div>
  );
}