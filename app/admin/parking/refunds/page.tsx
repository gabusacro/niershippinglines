"use client";
import Link from "next/link";
export default function ParkingParkingRefundsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-8 text-white shadow-lg">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Pay Parking — Admin</p>
        <h1 className="mt-1 text-2xl font-bold">💸 Parking Refunds</h1>
        <p className="mt-2 text-sm text-white/90">Process parking refund requests.</p>
      </div>
      <div className="mt-6 flex gap-3 flex-wrap">
        <Link href="/admin/parking" className="rounded-xl border-2 border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-50">← Back to Parking</Link>
        <Link href="/admin" className="rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Admin Dashboard</Link>
      </div>
      <div className="mt-8 rounded-2xl border-2 border-blue-200 bg-blue-50 p-10 text-center">
        <div className="text-5xl mb-4">💸</div>
        <h2 className="text-xl font-bold text-blue-900">Parking Refunds — Coming Soon</h2>
        <p className="mt-2 text-sm text-blue-700 max-w-md mx-auto">Process parking refund requests. This section is being built.</p>
      </div>
    </div>
  );
}
