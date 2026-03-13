import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("inquiries")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-6xl mx-auto py-10">

      <h1 className="text-2xl font-bold mb-6">Support Inbox</h1>

      <div className="space-y-4">
        {data?.map((i) => (
          <div key={i.id} className="border rounded-lg p-4">

            <div className="font-semibold">{i.name}</div>
            <div className="text-sm text-gray-500">{i.email}</div>
            <div className="text-sm text-gray-500">{i.phone}</div>

            <p className="mt-3 text-sm">{i.message}</p>

          </div>
        ))}
      </div>

    </div>
  );
}