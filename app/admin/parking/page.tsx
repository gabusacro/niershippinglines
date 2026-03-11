import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";

export const metadata = {
  title: "Pay Parking — Admin",
  description: "Manage parking lots, sessions, and reservations",
};

export default async function AdminParkingPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-8 text-white shadow-lg sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Admin — Parking</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">🚗 Pay Parking Management</h1>
        <p className="mt-2 max-w-xl text-sm text-white/90">
          Manage parking lots, vehicle check-in/out, reservations, and overstay monitoring.
        </p>
      </div>

      {/* Nav grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[
          { href: "/admin/parking/lots",          label: "🅿️ Parking Lots"      },
          { href: "/admin/parking/checkin",        label: "🚘 Check In"          },
          { href: "/admin/parking/sessions",       label: "📋 Active Sessions"   },
          { href: "/admin/parking/reservations",   label: "📅 Reservations"      },
          { href: "/admin/parking/overstay",       label: "⚠️ Overstay"          },
          { href: "/admin/parking/refunds",        label: "💸 Refunds"           },
          { href: "/admin/parking/expenses",       label: "🧾 Expenses"          },
          { href: "/admin/parking/settings",       label: "⚙️ Settings"          },
        ].map(({ href, label }) => (
          <Link key={href} href={href}
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-800 text-center transition-colors hover:border-blue-400 hover:bg-blue-50">
            {label}
          </Link>
        ))}
        <Link href="/admin"
          className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50">
          ← Back to Admin
        </Link>
      </div>

      {/* Coming soon notice */}
      <div className="mt-8 rounded-2xl border-2 border-blue-200 bg-blue-50 p-8 text-center">
        <div className="text-5xl mb-4">🚗</div>
        <h2 className="text-xl font-bold text-blue-900">Pay Parking Module — Coming Soon</h2>
        <p className="mt-2 text-sm text-blue-700 max-w-md mx-auto">
          Staff check-in/out tools, online reservations, overstay monitoring, and receipt generation are being built next.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-4 max-w-sm mx-auto text-center">
          <div className="rounded-xl bg-white border border-blue-200 p-3">
            <div className="text-2xl font-bold text-blue-700">₱250</div>
            <div className="text-xs text-blue-600 mt-1">Default rate/day</div>
          </div>
          <div className="rounded-xl bg-white border border-blue-200 p-3">
            <div className="text-2xl font-bold text-blue-700">45</div>
            <div className="text-xs text-blue-600 mt-1">Max days</div>
          </div>
          <div className="rounded-xl bg-white border border-blue-200 p-3">
            <div className="text-2xl font-bold text-blue-700">✅</div>
            <div className="text-xs text-blue-600 mt-1">DB ready</div>
          </div>
        </div>
      </div>

{/* 🔔 TODO: Add <PromoPopup /> to the Pay Parking PUBLIC page when it is built */}

    </div>
  );
}