// app/attractions/[slug]/page.tsx
// TEMPORARY TEST — no Supabase, no database, just hardcoded
// This will prove the route works before we add the database back

export const dynamic = "force-dynamic";

export default async function AttractionDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-4">
      <div className="text-6xl">🌴</div>
      <h1 className="text-3xl font-black text-[#134e4a]">
        Route is working!
      </h1>
      <p className="text-lg text-[#0f766e] font-semibold">
        Slug received: <strong>{params.slug}</strong>
      </p>
      <a
        href="/attractions"
        className="mt-4 px-6 py-3 bg-[#0c7b93] text-white rounded-2xl font-bold hover:bg-[#085C52] transition-colors"
      >
        ← Back to Attractions
      </a>
    </div>
  );
}
