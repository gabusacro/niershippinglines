import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { APP_NAME, ROUTES } from "@/lib/constants";

export const metadata = {
  title: "First admin setup",
  description: `One-time setup to make an account admin — ${APP_NAME}`,
};

export default async function FirstAdminSetupPage() {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);
  if (user.role === "admin") redirect(ROUTES.dashboard);

  const email = user.email ?? "";
  const emailEscaped = email.replace(/'/g, "''");
  const sql = email
    ? `UPDATE public.profiles\nSET role = 'admin', approved_at = NOW()\nWHERE email = '${emailEscaped}';`
    : "-- Log in with an account that has an email first, then open this page again.";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#134e4a]">First admin setup</h1>
      <p className="mt-2 text-[#0f766e]">
        Do this <strong>once</strong> in Supabase. No env keys, no special URL — just run one SQL.
      </p>

      <ol className="mt-6 list-decimal list-inside space-y-3 text-[#0f766e]">
        <li>Open <strong>Supabase Dashboard</strong> → your project.</li>
        <li>Go to <strong>SQL Editor</strong> → New query.</li>
        <li>Paste the SQL below (it already has your email).</li>
        <li>Click <strong>Run</strong>.</li>
        <li>Come back here and <Link href={ROUTES.login} className="font-semibold text-[#0c7b93] underline">log in again</Link>. You’ll see Admin, Crew, Captain.</li>
      </ol>

      <div className="mt-6">
        <p className="text-sm font-medium text-[#134e4a] mb-1">SQL to run (your email is already in it):</p>
        <pre className="rounded-xl bg-[#134e4a] text-[#fef9e7] p-4 text-sm overflow-x-auto whitespace-pre-wrap break-all">
          {sql}
        </pre>
      </div>

      <p className="mt-6 text-sm text-[#0f766e]/80">
        Only the first person who needs admin does this. After that, admins assign Crew and Captain from the app.
      </p>

      <p className="mt-6">
        <Link href={ROUTES.dashboard} className="font-semibold text-[#0c7b93] underline hover:text-[#0f766e]">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
