"use client";

import { useState, useEffect } from "react";

interface PassengerData {
  full_name: string;
  address: string;
  birthdate: string;
  age: string;
  contact_number: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
}

interface Props {
  totalPax: number;
  profileName?: string;
  profileMobile?: string;
  profileAddress?: string;
  profileBirthdate?: string;
  profileEmergencyName?: string;
  profileEmergencyNumber?: string;
}

function calculateAge(birthdate: string): number {
  if (!birthdate) return 0;
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age > 0 ? age : 0;
}

const emptyPassenger = (): PassengerData => ({
  full_name: "", address: "", birthdate: "", age: "",
  contact_number: "", emergency_contact_name: "", emergency_contact_number: "",
});

export default function BookingPassengers({
  totalPax,
  profileName = "", profileMobile = "", profileAddress = "",
  profileBirthdate = "", profileEmergencyName = "", profileEmergencyNumber = "",
}: Props) {
  const [passengers, setPassengers] = useState<PassengerData[]>(() => {
    const p0: PassengerData = {
      full_name: profileName,
      address: profileAddress,
      birthdate: profileBirthdate,
      age: profileBirthdate ? String(calculateAge(profileBirthdate)) : "",
      contact_number: profileMobile,
      emergency_contact_name: profileEmergencyName,
      emergency_contact_number: profileEmergencyNumber,
    };
    const list = [p0];
    for (let i = 1; i < totalPax; i++) list.push(emptyPassenger());
    return list;
  });

  const [expanded, setExpanded] = useState<number[]>([0]);

  // Sync profile prefill into passenger 0
  useEffect(() => {
    setPassengers(prev => {
      const updated = [...prev];
      updated[0] = {
        ...updated[0],
        full_name: profileName || updated[0].full_name,
        contact_number: profileMobile || updated[0].contact_number,
        address: profileAddress || updated[0].address,
        birthdate: profileBirthdate || updated[0].birthdate,
        age: profileBirthdate ? String(calculateAge(profileBirthdate)) : updated[0].age,
        emergency_contact_name: profileEmergencyName || updated[0].emergency_contact_name,
        emergency_contact_number: profileEmergencyNumber || updated[0].emergency_contact_number,
      };
      return updated;
    });
  }, [profileName, profileMobile, profileAddress, profileBirthdate, profileEmergencyName, profileEmergencyNumber]);

  // Sync list size when totalPax changes
  useEffect(() => {
    setPassengers(prev => {
      const updated = [...prev];
      while (updated.length < totalPax) updated.push(emptyPassenger());
      return updated.slice(0, totalPax);
    });
  }, [totalPax]);

  function update(index: number, field: keyof PassengerData, value: string) {
    setPassengers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "birthdate") updated[index].age = value ? String(calculateAge(value)) : "";
      return updated;
    });
  }

  function toggle(index: number) {
    setExpanded(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
  }

  function isComplete(p: PassengerData) {
    return p.full_name && p.address && p.birthdate && p.contact_number &&
      p.emergency_contact_name && p.emergency_contact_number;
  }

  return (
    <div className="space-y-3">
      {/* Single hidden input with all passenger data as JSON */}
      <input type="hidden" name="passengers_json" value={JSON.stringify(passengers)} />

      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-[#134e4a] text-base">🧑‍🤝‍🧑 Tourist Details</h3>
        <span className="text-xs text-gray-400">Required for tourism office manifest</span>
      </div>

      {passengers.map((p, i) => (
        <div key={i} className="rounded-xl border-2 border-emerald-100 bg-white overflow-hidden">
          <button type="button" onClick={() => toggle(i)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-emerald-50 transition-colors">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center">{i + 1}</span>
              <span className="font-semibold text-[#134e4a] text-sm">
                {p.full_name || (i === 0 ? "Lead Tourist (You)" : `Tourist ${i + 1}`)}
              </span>
              {i === 0 && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Lead</span>}
            </div>
            <div className="flex items-center gap-2">
              {isComplete(p) && <span className="text-emerald-500 text-sm">✅</span>}
              <span className="text-gray-400 text-sm">{expanded.includes(i) ? "▲" : "▼"}</span>
            </div>
          </button>

          {expanded.includes(i) && (
            <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-emerald-50">

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Full Name <span className="text-red-400">*</span></label>
                <input type="text" value={p.full_name}
                  onChange={e => update(i, "full_name", e.target.value)}
                  placeholder="Juan Dela Cruz"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Address <span className="text-red-400">*</span></label>
                <input type="text" value={p.address}
                  onChange={e => update(i, "address", e.target.value)}
                  placeholder="Barangay, City, Province"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Birthdate <span className="text-red-400">*</span></label>
                <input type="date" value={p.birthdate}
                  onChange={e => update(i, "birthdate", e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Age <span className="text-xs text-emerald-600 font-normal">(auto-calculated)</span></label>
                <input type="text" value={p.age} readOnly placeholder="—"
                  className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-emerald-700 font-bold cursor-not-allowed" />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Contact Number <span className="text-red-400">*</span></label>
                <input type="tel" value={p.contact_number}
                  onChange={e => update(i, "contact_number", e.target.value)}
                  placeholder="09XX XXX XXXX"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Emergency Contact Name <span className="text-red-400">*</span></label>
                <input type="text" value={p.emergency_contact_name}
                  onChange={e => update(i, "emergency_contact_name", e.target.value)}
                  placeholder="Maria Dela Cruz"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Emergency Contact Number <span className="text-red-400">*</span></label>
                <input type="tel" value={p.emergency_contact_number}
                  onChange={e => update(i, "emergency_contact_number", e.target.value)}
                  placeholder="09XX XXX XXXX"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              </div>

            </div>
          )}
        </div>
      ))}

      <p className="text-xs text-gray-400 text-center pt-1">
        All tourist information is kept confidential and used for tourism office records only.
      </p>
    </div>
  );
}
