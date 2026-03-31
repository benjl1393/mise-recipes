"use client";

import { UnitPreference } from "@/lib/types";

interface UnitToggleProps {
  value: UnitPreference;
  onChange: (unit: UnitPreference) => void;
}

export function UnitToggle({ value, onChange }: UnitToggleProps) {
  return (
    <div className="flex items-center border border-border">
      <button
        onClick={() => onChange("metric")}
        className={`px-3 py-1 text-[10px] uppercase tracking-[0.12em] font-[family-name:var(--font-open-gorton)] transition-colors ${
          value === "metric"
            ? "bg-navy text-white"
            : "bg-transparent text-text-secondary hover:text-navy"
        }`}
      >
        Metric
      </button>
      <div className="w-px h-4 bg-border" />
      <button
        onClick={() => onChange("imperial")}
        className={`px-3 py-1 text-[10px] uppercase tracking-[0.12em] font-[family-name:var(--font-open-gorton)] transition-colors ${
          value === "imperial"
            ? "bg-navy text-white"
            : "bg-transparent text-text-secondary hover:text-navy"
        }`}
      >
        Imperial
      </button>
    </div>
  );
}
