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
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-8 text-white shadow-lg sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Admin — Parking</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">🚗 Pay Parking Management</h1>
        <p className="mt-2 max-w-xl text-sm text-white/90">
          Manage parking lots, vehicle check-in/out, reservations, and overstay monitoring.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[
          { href: "/admin/parking/lots",        label: "🅿️ Parking Lots"    },
          { href: "/admin/parking/checkin",      label: "🚘 Check In"        },
          { href: "/admin/parking/sessions",     label: "📋 Active Sessions" },
          { href: "/admin/parking/reservations", label: "📅 Reservations"    },
          { href: "/admin/parking/overstay",     label: "⚠️ Overstay"        },
          { href: "/admin/parking/refunds",      label: "💸 Refunds"         },
          { href: "/admin/parking/expenses",     label: "🧾 Expenses"        },
          { href: "/admin/parking/settings",     label: "⚙️ Settings"        },
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
    </div>
  );
}
