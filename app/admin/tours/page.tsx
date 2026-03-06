import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";

export const metadata = {
  title: "Tours — Admin",
  description: "Manage tour packages, schedules, and bookings",
};

export default async function AdminToursPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-8 text-white shadow-lg sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Admin — Tours</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">🏝️ Tour Management</h1>
        <p className="mt-2 max-w-xl text-sm text-white/90">
          Manage packages, schedules, bookings, and reviews for all Kuya Gab tour services.
        </p>
      </div>

      {/* Nav grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[
          { href: "/admin/tours/packages",       label: "📦 Packages"          },
          { href: "/admin/tours/bookings",        label: "🎫 Bookings"          },
          { href: "/admin/tours/manual-booking",  label: "✍️ Walk-in Booking"   },
          { href: "/admin/tours/reviews",         label: "⭐ Reviews"           },
          { href: "/admin/tours/refunds",         label: "💸 Refunds"           },
          { href: "/admin/tours/expenses",        label: "🧾 Expenses"          },
          { href: "/admin/tours/categories",      label: "🗂️ Categories"        },
          { href: "/admin/tours/settings",        label: "⚙️ Settings"          },
        ].map(({ href, label }) => (
          <Link key={href} href={href}
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50">
            {label}
          </Link>
        ))}
        <Link href="/admin"
          className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50">
          ← Back to Admin
        </Link>
      </div>

      {/* Coming soon notice */}
      <div className="mt-8 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="text-5xl mb-4">🏝️</div>
        <h2 className="text-xl font-bold text-emerald-900">Tours Module — Coming Soon</h2>
        <p className="mt-2 text-sm text-emerald-700 max-w-md mx-auto">
          Database is ready. Package management, schedule slots, and booking flow are being built next.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-4 max-w-sm mx-auto text-center">
          <div className="rounded-xl bg-white border border-emerald-200 p-3">
            <div className="text-2xl font-bold text-emerald-700">9</div>
            <div className="text-xs text-emerald-600 mt-1">Packages ready</div>
          </div>
          <div className="rounded-xl bg-white border border-emerald-200 p-3">
            <div className="text-2xl font-bold text-emerald-700">0</div>
            <div className="text-xs text-emerald-600 mt-1">Bookings so far</div>
          </div>
          <div className="rounded-xl bg-white border border-emerald-200 p-3">
            <div className="text-2xl font-bold text-emerald-700">✅</div>
            <div className="text-xs text-emerald-600 mt-1">DB live</div>
          </div>
        </div>
      </div>

    </div>
  );
}
