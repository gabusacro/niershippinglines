import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Reviews — Tours Admin",
  description: "Manage tour reviews and ratings",
};

interface Review {
  id: string;
  booking_id: string | null;
  tour_id: string | null;
  reviewer_name: string;
  reviewer_email: string | null;
  rating: number;
  comment: string | null;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  tour: { title: string } | null;
  booking: { reference: string } | null;
}

export default async function ToursReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tour?: string }>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const filterStatus = params.status ?? "pending";
  const filterTour = params.tour ?? "";

  const supabase = await createClient();

  // Fetch reviews
  let query = supabase
    .from("tour_reviews")
    .select("*, tour:tour_packages(title), booking:tour_bookings(reference)")
    .order("created_at", { ascending: false });

  if (filterStatus !== "all") {
    query = query.eq("status", filterStatus);
  }
  if (filterTour) {
    query = query.eq("tour_id", filterTour);
  }

  const { data: reviews } = await query;

  // Counts per status
  const { count: pendingCount } = await supabase
    .from("tour_reviews")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: approvedCount } = await supabase
    .from("tour_reviews")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved");

  const { count: rejectedCount } = await supabase
    .from("tour_reviews")
    .select("*", { count: "exact", head: true })
    .eq("status", "rejected");

  // Tour packages for filter
  const { data: packages } = await supabase
    .from("tour_packages")
    .select("id, title")
    .order("title");

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-PH", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function StarRating({ rating }: { rating: number }) {
    return (
      <span className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <span key={s} className={s <= rating ? "text-amber-400" : "text-gray-200"}>
            ★
          </span>
        ))}
      </span>
    );
  }

  const statusTab = (label: string, value: string, count: number | null) => {
    const active = filterStatus === value;
    return (
      <Link
        href={"/admin/tours/reviews?status=" + value + (filterTour ? "&tour=" + filterTour : "")}
        className={
          "px-4 py-2 rounded-xl text-sm font-semibold transition-colors " +
          (active
            ? "bg-emerald-600 text-white shadow"
            : "bg-white border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700")
        }
      >
        {label}
        <span className={"ml-1.5 text-xs px-1.5 py-0.5 rounded-full " +
          (active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500")}>
          {count ?? 0}
        </span>
      </Link>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-8 text-white shadow-lg sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Admin — Tours</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Reviews Queue</h1>
        <p className="mt-2 text-sm text-white/90">
          Approve or reject customer reviews before they appear publicly.
        </p>
      </div>

      {/* Back link */}
      <div className="mt-4">
        <Link href="/admin/tours" className="text-sm text-emerald-600 hover:underline">
          Back to Tour Management
        </Link>
      </div>

      {/* Status tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {statusTab("Pending", "pending", pendingCount)}
        {statusTab("Approved", "approved", approvedCount)}
        {statusTab("Rejected", "rejected", rejectedCount)}
        {statusTab("All", "all", (pendingCount ?? 0) + (approvedCount ?? 0) + (rejectedCount ?? 0))}
      </div>

      {/* Tour filter */}
      {packages && packages.length > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            <Link
              href={"/admin/tours/reviews?status=" + filterStatus}
              className={"px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors " +
                (!filterTour
                  ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                  : "bg-white border-gray-200 text-gray-500 hover:border-emerald-200")}
            >
              All Tours
            </Link>
            {packages.map((p) => (
              <Link
                key={p.id}
                href={"/admin/tours/reviews?status=" + filterStatus + "&tour=" + p.id}
                className={"px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors " +
                  (filterTour === p.id
                    ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                    : "bg-white border-gray-200 text-gray-500 hover:border-emerald-200")}
              >
                {p.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Reviews list */}
      <div className="mt-6 space-y-4">
        {!reviews || reviews.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
            <p className="text-4xl mb-3">⭐</p>
            <p className="font-semibold text-gray-500">No {filterStatus !== "all" ? filterStatus : ""} reviews yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Reviews submitted by customers will appear here for moderation.
            </p>
          </div>
        ) : (
          (reviews as Review[]).map((review) => (
            <div key={review.id}
              className="rounded-2xl border-2 border-gray-100 bg-white p-6 hover:border-emerald-200 transition-all">

              {/* Top row */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-bold text-[#134e4a]">{review.reviewer_name}</p>
                    <StarRating rating={review.rating} />
                    <span className={
                      "text-xs font-bold px-2 py-0.5 rounded-full " +
                      (review.status === "pending"
                        ? "bg-amber-100 text-amber-700"
                        : review.status === "approved"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-600")
                    }>
                      {review.status.toUpperCase()}
                    </span>
                  </div>
                  {review.reviewer_email && (
                    <p className="text-xs text-gray-400 mt-0.5">{review.reviewer_email}</p>
                  )}
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap">{formatDate(review.created_at)}</p>
              </div>

              {/* Tour + booking */}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                {review.tour && (
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                    {review.tour.title}
                  </span>
                )}
                {review.booking && (
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                    {review.booking.reference}
                  </span>
                )}
              </div>

              {/* Comment */}
              {review.comment && (
                <p className="mt-3 text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  {review.comment}
                </p>
              )}

              {/* Admin note if rejected */}
              {review.admin_note && (
                <p className="mt-2 text-xs text-red-500 italic">
                  Admin note: {review.admin_note}
                </p>
              )}

              {/* Action buttons — only for pending */}
              {review.status === "pending" && (
                <div className="mt-4 flex gap-2">
                  <form action={"/api/admin/tours/reviews/approve"} method="POST">
                    <input type="hidden" name="review_id" value={review.id} />
                    <button type="submit"
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors">
                      Approve
                    </button>
                  </form>
                  <form action={"/api/admin/tours/reviews/reject"} method="POST">
                    <input type="hidden" name="review_id" value={review.id} />
                    <button type="submit"
                      className="px-4 py-2 rounded-xl bg-red-50 text-red-600 border border-red-200 text-sm font-semibold hover:bg-red-100 transition-colors">
                      Reject
                    </button>
                  </form>
                </div>
              )}

              {/* Reviewed at */}
              {review.reviewed_at && (
                <p className="mt-2 text-xs text-gray-400">
                  {review.status === "approved" ? "Approved" : "Rejected"} on {formatDate(review.reviewed_at)}
                </p>
              )}
            </div>
          ))
        )}
      </div>

    </div>
  );
}