import Link from "next/link";
import { ROUTES } from "@/lib/constants";

export default function BookingNotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-[#134e4a]">Booking not found</h1>
      <p className="mt-3 text-sm text-[#0f766e]">
        This booking could not be loaded. Make sure you&apos;re logged in with the <strong>same email</strong> you used when you made the booking.
      </p>
      <p className="mt-2 text-sm text-[#0f766e]">
        If you have the reference (e.g. L7HHU7NCHR), try again from the dashboard &quot;Find a booking by reference&quot; box while logged in with that email.
      </p>
      <Link
        href={ROUTES.dashboard}
        className="mt-6 inline-block rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e]"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
