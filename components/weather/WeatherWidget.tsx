"use client";

import { useEffect, useState } from "react";
import { Sun, Wave } from "@/components/icons";

const SIARGAO_LAT = 9.75;
const SIARGAO_LON = 126.05;

interface WeatherState {
  temp: number;
  feels_like: number;
  description: string;
  humidity: number;
  wind_speed: number; // km/h
  wind_dir: string;
  precip: number;
  is_day: boolean;
  weather_code: number;
  wave_height: number | null; // metres
  wave_period: number | null; // seconds
}

function getWeatherDescription(code: number, isDay: boolean): { label: string; emoji: string } {
  if (code === 0) return { label: isDay ? "Clear sky" : "Clear night", emoji: isDay ? "☀️" : "🌙" };
  if (code <= 2) return { label: "Partly cloudy", emoji: "⛅" };
  if (code === 3) return { label: "Overcast", emoji: "☁️" };
  if (code <= 49) return { label: "Foggy", emoji: "🌫️" };
  if (code <= 59) return { label: "Drizzle", emoji: "🌦️" };
  if (code <= 69) return { label: "Rain", emoji: "🌧️" };
  if (code <= 79) return { label: "Snow / sleet", emoji: "🌨️" };
  if (code <= 82) return { label: "Rain showers", emoji: "🌦️" };
  if (code <= 84) return { label: "Heavy showers", emoji: "⛈️" };
  if (code <= 99) return { label: "Thunderstorm", emoji: "⛈️" };
  return { label: "Unknown", emoji: "🌡️" };
}

function getWindDir(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8] ?? "N";
}

function getSeaCondition(windKmh: number, waveM: number | null): {
  label: string;
  sublabel: string;
  color: string;
  bg: string;
  border: string;
  safe: boolean;
} {
  // Use wave height if available, otherwise fall back to wind
  const waveScore = waveM !== null ? waveM : windKmh / 20;

  if (waveScore < 0.3) return {
    label: "Calm",
    sublabel: waveM !== null ? `${waveM.toFixed(1)}m waves — excellent sailing` : "Light wind — smooth sailing",
    color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", safe: true,
  };
  if (waveScore < 0.8) return {
    label: "Light chop",
    sublabel: waveM !== null ? `${waveM.toFixed(1)}m waves — generally safe` : "Mild conditions",
    color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", safe: true,
  };
  if (waveScore < 1.5) return {
    label: "Moderate",
    sublabel: waveM !== null ? `${waveM.toFixed(1)}m waves — exercise caution` : "Moderate conditions",
    color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", safe: false,
  };
  if (waveScore < 2.5) return {
    label: "Rough",
    sublabel: waveM !== null ? `${waveM.toFixed(1)}m waves — small vessels at risk` : "Rough conditions",
    color: "text-red-700", bg: "bg-red-50", border: "border-red-200", safe: false,
  };
  return {
    label: "Very Rough",
    sublabel: waveM !== null ? `${waveM.toFixed(1)}m waves — sailing not advised` : "Dangerous conditions",
    color: "text-red-700", bg: "bg-red-50", border: "border-red-200", safe: false,
  };
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch weather + marine data in parallel from Open-Meteo (free, no API key)
        const [weatherRes, marineRes] = await Promise.all([
          fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${SIARGAO_LAT}&longitude=${SIARGAO_LON}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day` +
            `&wind_speed_unit=kmh&timezone=Asia%2FManila`
          ),
          fetch(
            `https://marine-api.open-meteo.com/v1/marine?latitude=${SIARGAO_LAT}&longitude=${SIARGAO_LON}` +
            `&current=wave_height,wave_period` +
            `&timezone=Asia%2FManila`
          ).catch(() => null), // marine API is optional — don't break if unavailable
        ]);

        if (!weatherRes.ok) throw new Error("weather fetch failed");
        const w = await weatherRes.json();
        const c = w.current;

        // Marine data (optional)
        let waveHeight: number | null = null;
        let wavePeriod: number | null = null;
        if (marineRes?.ok) {
          const m = await marineRes.json();
          waveHeight = m.current?.wave_height ?? null;
          wavePeriod = m.current?.wave_period ?? null;
        }

        setWeather({
          temp: Math.round(c.temperature_2m),
          feels_like: Math.round(c.apparent_temperature),
          humidity: c.relative_humidity_2m,
          wind_speed: Math.round(c.wind_speed_10m),
          wind_dir: getWindDir(c.wind_direction_10m),
          precip: c.precipitation ?? 0,
          is_day: c.is_day === 1,
          weather_code: c.weather_code,
          description: getWeatherDescription(c.weather_code, c.is_day === 1).label,
          wave_height: waveHeight !== null ? Math.round(waveHeight * 10) / 10 : null,
          wave_period: wavePeriod !== null ? Math.round(wavePeriod) : null,
        });

        setLastUpdated(
          new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true })
        );
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-teal-200 bg-white/80 p-5 animate-pulse">
        <div className="h-5 w-40 bg-teal-100 rounded mx-auto mb-3" />
        <div className="h-10 w-24 bg-teal-100 rounded mx-auto" />
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="rounded-2xl border border-teal-200 bg-white/80 p-5 text-center">
        <p className="text-sm text-[#0f766e]">
          Weather unavailable. Check{" "}
          <a href="https://www.pagasa.dost.gov.ph" target="_blank" rel="noopener noreferrer"
            className="font-bold text-[#0c7b93] underline">PAGASA</a>{" "}
          for the official forecast.
        </p>
      </div>
    );
  }

  const { label: wxLabel, emoji } = getWeatherDescription(weather.weather_code, weather.is_day);
  const sea = getSeaCondition(weather.wind_speed, weather.wave_height);
  const isRain = weather.precip > 0 || weather.weather_code >= 51;

  return (
    <div className="rounded-2xl border border-teal-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-center gap-2 bg-[#0c7b93]/10 px-4 py-2.5 border-b border-teal-100">
        <Sun size={16} className="text-[#f59e0b] shrink-0" />
        <span className="text-sm font-bold text-[#134e4a]">Siargao Live Weather</span>
        {lastUpdated && (
          <span className="text-xs text-[#0f766e]/60 ml-1">· {lastUpdated}</span>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-3">

        {/* Temp + description */}
        <div className="flex items-center justify-center gap-4">
          <span className="text-5xl">{emoji}</span>
          <div className="text-center">
            <p className="text-4xl font-black text-[#134e4a]">{weather.temp}°C</p>
            <p className="text-sm font-semibold text-[#0f766e]">{wxLabel}</p>
            <p className="text-xs text-[#0f766e]/70">Feels like {weather.feels_like}°C</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-teal-50 border border-teal-100 px-2 py-2.5">
            <p className="text-[10px] font-bold text-[#0f766e] uppercase tracking-wide">Humidity</p>
            <p className="text-lg font-black text-[#134e4a]">{weather.humidity}%</p>
          </div>
          <div className="rounded-xl bg-teal-50 border border-teal-100 px-2 py-2.5">
            <p className="text-[10px] font-bold text-[#0f766e] uppercase tracking-wide">Wind</p>
            <p className="text-base font-black text-[#134e4a]">{weather.wind_speed}<span className="text-xs font-semibold"> km/h</span></p>
            <p className="text-xs text-[#0f766e]">{weather.wind_dir}</p>
          </div>
          <div className="rounded-xl bg-teal-50 border border-teal-100 px-2 py-2.5">
            <p className="text-[10px] font-bold text-[#0f766e] uppercase tracking-wide">
              {weather.wave_height !== null ? "Waves" : "Rain"}
            </p>
            <p className="text-base font-black text-[#134e4a]">
              {weather.wave_height !== null
                ? <>{weather.wave_height}<span className="text-xs font-semibold">m</span></>
                : <>{weather.precip}<span className="text-xs font-semibold">mm</span></>
              }
            </p>
            {weather.wave_period !== null && (
              <p className="text-xs text-[#0f766e]">{weather.wave_period}s period</p>
            )}
          </div>
        </div>

        {/* Sea condition */}
        <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${sea.bg} ${sea.border}`}>
          <Wave size={20} className={`shrink-0 ${sea.color}`} />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#134e4a]">
              Sea Conditions — <span className={sea.color}>{sea.label}</span>
            </p>
            <p className={`text-sm font-semibold ${sea.color}`}>{sea.sublabel}</p>
          </div>
        </div>

        {/* Rain notice */}
        {isRain && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-2">
            <span className="text-lg shrink-0">🌧️</span>
            <p className="text-sm font-semibold text-blue-800">
              Rain expected — bring a rain jacket and waterproof your bags.
            </p>
          </div>
        )}

        {/* Magpupungko */}
        <div className="rounded-xl border border-[#0c7b93]/20 bg-[#f0fdfa] px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">🏊</span>
            <p className="text-xs font-bold uppercase tracking-wide text-[#134e4a]">Magpupungko Rock Pools</p>
          </div>
          <p className="text-sm font-semibold text-[#0f766e]">
            Best visited at <strong className="text-[#134e4a]">low tide</strong> — natural rock pools are only visible and swimmable during low tide.
          </p>
          <p className="text-xs text-[#0f766e]/80 mt-1">
            Check tide times at{" "}
            <a href="https://tides.net/asia/philippines/siargao" target="_blank" rel="noopener noreferrer"
              className="font-bold text-[#0c7b93] hover:underline">tides.net</a>
            {" "}or ask your hotel before heading out.
          </p>
        </div>

        {/* Sources */}
        <p className="text-center text-xs text-[#0f766e]/60">
          Data:{" "}
          <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer"
            className="font-bold text-[#0c7b93] hover:underline">Open-Meteo</a>
          {" · "}
          Official PH forecast:{" "}
          <a href="https://www.pagasa.dost.gov.ph/marine/gale-warning" target="_blank" rel="noopener noreferrer"
            className="font-bold text-[#0c7b93] hover:underline">PAGASA Gale Warning</a>
          {" · "}
          <a href="https://www.pagasa.dost.gov.ph/weather#daily-weather-forecast" target="_blank" rel="noopener noreferrer"
            className="font-bold text-[#0c7b93] hover:underline">Daily Forecast</a>
        </p>
      </div>
    </div>
  );
}
