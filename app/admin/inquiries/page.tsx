import { createClient } from "@/lib/supabase/server";

export default async function AdminInquiries() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("inquiries")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-5xl mx-auto py-10">

      <h1 className="text-2xl font-bold mb-6">Support Inbox</h1>

      <div className="space-y-4">

        {data?.map((i) => (
          <div key={i.id} className="border rounded-xl p-4 bg-white">

            <div className="flex justify-between">

              <div>
                <p className="font-semibold">{i.name}</p>
                <p className="text-sm text-gray-500">{i.email}</p>
                <p className="text-sm text-gray-500">{i.phone}</p>
              </div>

              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                {i.status}
              </span>

            </div>

            <p className="mt-3 text-sm">{i.message}</p>

          </div>
        ))}

      </div>
    </div>
  );
}