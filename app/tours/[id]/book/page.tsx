import { redirect, notFound } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import TourBookingForm from "@/components/tours/TourBookingForm";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("tour_packages").select("title").eq("id", id).single();
  return { title: `Book ${data?.title ?? "Tour"} — Travela Siargao` };
}

export default async function TourBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; schedule?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const { type, schedule: scheduleId } = await searchParams;
  const bookingType = (type === "private" || type === "both" ? type : "joiner") as "joiner" | "private" | "both";

  const supabase = await createClient();

  const { data: tour } = await supabase
    .from("tour_packages")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (!tour) notFound();

  const { data: schedule } = scheduleId
    ? await supabase
        .from("tour_schedules")
        .select("*")
        .eq("id", scheduleId)
        .eq("tour_id", id)
        .single()
    : { data: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, mobile")
    .eq("id", user.id)
    .single();

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#134e4a]">Book {tour.title}</h1>
        {schedule && (
          <p className="text-sm text-gray-500 mt-1">
            📅 {formatDate(schedule.available_date)} · 🕒 {schedule.departure_time?.slice(0, 5)}
          </p>
        )}
      </div>

      <TourBookingForm
        tour={tour}
        schedule={schedule}
        bookingType={bookingType}
        profileName={profile?.full_name ?? ""}
        profileMobile={profile?.mobile ?? ""}
        userEmail={user.email ?? ""}
        userId={user.id}
      />
    </div>
  );
}
