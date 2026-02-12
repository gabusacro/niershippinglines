import { NextResponse } from "next/server";

const SIARGAO_LAT = 9.75;
const SIARGAO_LON = 126.05;

/**
 * GET /api/tide — automatic tide for Siargao Island, Philippines (WorldTides API).
 * Add WORLD_TIDES_API_KEY to .env.local (get key at worldtides.info). If not set, widget falls back to Supabase manual tide.
 */
export async function GET() {
  const key = process.env.WORLD_TIDES_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Tide API not configured", fallback: "supabase" },
      { status: 501 }
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const url = `https://www.worldtides.info/api/v3?extremes&date=${today}&lat=${SIARGAO_LAT}&lon=${SIARGAO_LON}&days=2&localtime&key=${key}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    const data = await res.json();

    if (data.status !== 200 || !Array.isArray(data.extremes)) {
      return NextResponse.json(
        { error: data.error || "Tide data unavailable", fallback: "supabase" },
        { status: res.ok ? 200 : 502 }
      );
    }

    const now = new Date();
    const nowMs = now.getTime();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    type Extreme = { dt: number; date: string; type: string; height: number };
    const extremes = (data.extremes as Extreme[])
      .filter((e) => e.dt * 1000 >= todayStart - 60 * 60 * 1000)
      .sort((a, b) => a.dt - b.dt);

    const formatTime = (dt: number) => {
      const d = new Date(dt * 1000);
      const h = d.getHours();
      const m = d.getMinutes();
      const h12 = h % 12 || 12;
      const ampm = h < 12 ? "AM" : "PM";
      return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
    };

    const todayExtremes = extremes.filter((e) => e.dt * 1000 >= todayStart && e.dt * 1000 < todayEnd);
    const todayHigh = todayExtremes.find((e) => e.type === "High");
    const todayLow = todayExtremes.find((e) => e.type === "Low");
    const allLows = extremes.filter((e) => e.type === "Low");
    const nextLow = allLows.find((e) => e.dt * 1000 > nowMs) ?? allLows[0];
    const tideNow = (() => {
      const next = extremes.find((e) => e.dt * 1000 > nowMs);
      const prev = [...extremes].reverse().find((e) => e.dt * 1000 <= nowMs);
      if (!next && !prev) return null;
      if (!next) return prev!.type === "High" ? "high" : "low";
      if (!prev) return next.type === "High" ? "low" : "high";
      return prev.type === "High" ? "high" : "low";
    })();

    const extremesToday: { type: "High" | "Low"; time: string }[] = todayExtremes.map((e) => ({
      type: e.type as "High" | "Low",
      time: formatTime(e.dt),
    }));

    return NextResponse.json({
      source: "worldtides",
      highTideTime: todayHigh ? formatTime(todayHigh.dt) : null,
      lowTideTime: todayLow ? formatTime(todayLow.dt) : null,
      nextLowTideTime: nextLow ? formatTime(nextLow.dt) : null,
      tideNow: tideNow ?? (todayLow && nowMs < todayLow.dt * 1000 ? "high" : "low"),
      extremesToday,
      copyright: data.copyright ?? "Tidal data from WorldTides",
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Tide request failed", fallback: "supabase" },
      { status: 500 }
    );
  }
}
