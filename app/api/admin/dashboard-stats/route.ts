import { getDashboardStats } from "@/lib/admin/dashboard-stats";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

type Period = "today" | "week" | "month" | "year" | "custom";

const VALID_PERIODS: Period[] = ["today", "week", "month", "year", "custom"];

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawPeriod = searchParams.get("period") ?? "today";
  const start = searchParams.get("start") ?? undefined;
  const end   = searchParams.get("end")   ?? undefined;

  const period: Period = VALID_PERIODS.includes(rawPeriod as Period)
    ? (rawPeriod as Period)
    : "today";

  const stats = await getDashboardStats(period, start, end);
  return NextResponse.json(stats);
}
