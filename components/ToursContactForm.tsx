"use client";

import { useState } from "react";

export default function ToursContactForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: any) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.target);

    const data = {
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      inquiry_type: form.get("type"),
      message: form.get("message"),
    };

    const res = await fetch("/api/inquiry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    setLoading(false);

    if (res.ok) {
      setSent(true);
      e.target.reset();
    }
  }

  if (sent) {
    return (
      <div className="mt-12 rounded-2xl bg-emerald-600 p-6 text-center text-white">
        ✅ Your inquiry has been sent!  
        Our team will contact you shortly.
      </div>
    );
  }

  return (
    <div className="mt-12 rounded-2xl bg-gradient-to-br from-[#0c7b93] to-[#0f766e] p-6 text-white">

      <p className="font-bold text-lg text-center">
        Need help planning your trip?
      </p>

      <p className="text-sm text-white/80 text-center mb-6">
        Contact our support team.
      </p>

      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">

        <input name="name" placeholder="Full Name" required
          className="rounded-xl px-4 py-2.5 text-gray-800" />

        <input name="phone" placeholder="Contact Number"
          className="rounded-xl px-4 py-2.5 text-gray-800" />

        <input name="email" type="email" placeholder="Email Address" required
          className="rounded-xl px-4 py-2.5 text-gray-800 sm:col-span-2" />

        <select name="type" required
          className="rounded-xl px-4 py-2.5 text-gray-800 sm:col-span-2">
          <option value="">Select Inquiry Type</option>
          <option value="Tours Inquiry">Tours Inquiry</option>
          <option value="Boat Ticket">Boat Ticket</option>
          <option value="Pay Parking">Pay Parking</option>
          <option value="Support">General Support</option>
        </select>

        <textarea name="message" rows={4} required
          placeholder="Write your inquiry..."
          className="rounded-xl px-4 py-2.5 text-gray-800 sm:col-span-2"
        />

        <button
          disabled={loading}
          className="sm:col-span-2 rounded-xl bg-white px-5 py-2.5 font-semibold text-[#0c7b93] hover:bg-white/90"
        >
          {loading ? "Sending..." : "Send Inquiry"}
        </button>

      </form>
    </div>
  );
}