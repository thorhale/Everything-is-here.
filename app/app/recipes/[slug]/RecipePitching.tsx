"use client";

import { useState } from "react";
import PitchingForm, {
  type PitchingFormInitial,
  type PitchingFormState,
} from "@/app/pitching/PitchingForm";
import {
  DECAY_MODEL_LABELS,
  STARTER_LABELS,
  type DecayModelKey,
  type StarterType,
} from "@/lib/pitching/formulas";
import { savePitchingProtocol, deletePitchingProtocol } from "./actions";

export interface SavedProtocol {
  volume: number;
  volumeUnit: string;
  og: number;
  pitchType: string;
  source: string;
  packs: number | null;
  grams: number | null;
  slurryMl: number | null;
  yeastFractionPct: number | null;
  ageDays: number | null;
  decayModel: string;
  starterType: string;
  starterMl: number | null;
  notes: string | null;
  updatedAt: string;
}

function n(v: number | null | undefined): string | undefined {
  return v == null ? undefined : String(v);
}

function savedToInitial(s: SavedProtocol): PitchingFormInitial {
  return {
    volume: String(s.volume),
    volumeUnit: s.volumeUnit === "L" ? "L" : "gal",
    og: String(s.og),
    pitchType: (s.pitchType as PitchingFormInitial["pitchType"]) ?? "ale",
    source: (s.source as PitchingFormInitial["source"]) ?? "liquid",
    decayModel: (s.decayModel as PitchingFormInitial["decayModel"]) ?? "classic",
    ageDays: n(s.ageDays),
    packs: n(s.packs),
    grams: n(s.grams),
    slurryMl: n(s.slurryMl),
    yeastFractionPct: n(s.yeastFractionPct),
    starterType: (s.starterType as PitchingFormInitial["starterType"]) ?? "none",
    starterMl: n(s.starterMl),
  };
}

// Embedded on the recipe page so a recipe can carry the exact yeast pitching
// + propagation protocol used. When one has been saved it is shown to every
// visitor and pre-fills the live calculator; admins can save or update it.
export default function RecipePitching({
  recipeSlug,
  defaults,
  saved,
  yeastName,
  canEdit,
}: {
  recipeSlug: string;
  defaults: PitchingFormInitial;
  saved: SavedProtocol | null;
  yeastName?: string;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const initial = saved ? savedToInitial(saved) : defaults;
  const save = savePitchingProtocol.bind(null, recipeSlug);
  const remove = deletePitchingProtocol.bind(null, recipeSlug);

  return (
    <section style={{ marginTop: "2rem" }}>
      {saved && (
        <div
          style={{
            background: "var(--wh-bg-warm)",
            border: "1px solid var(--wh-border)",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            marginBottom: "0.75rem",
            fontSize: "0.9rem",
          }}
        >
          <strong>Yeast propagation protocol.</strong>{" "}
          {describe(saved, yeastName)}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="wh-btn-secondary"
        style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
        aria-expanded={open}
      >
        {open ? "▾" : "▸"} {saved ? "Adjust pitching & propagation" : "Yeast pitching & propagation"}
      </button>

      {open && (
        <div style={{ marginTop: "1rem" }}>
          <p style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", marginTop: 0 }}>
            {saved ? "Loaded from this recipe's saved protocol" : "Pre-filled from this recipe's batch size and gravity"}
            {yeastName ? <> — pitching <strong>{yeastName}</strong></> : null}. Pick
            a starter method to work out the exact propagation protocol.
          </p>
          <PitchingForm
            initial={initial}
            compact
            footer={canEdit ? (state) => <SaveControls state={state} save={save} remove={remove} hasSaved={!!saved} savedNotes={saved?.notes ?? ""} /> : undefined}
          />
        </div>
      )}
    </section>
  );
}

function SaveControls({
  state,
  save,
  remove,
  hasSaved,
  savedNotes,
}: {
  state: PitchingFormState;
  save: (formData: FormData) => void | Promise<void>;
  remove: () => void | Promise<void>;
  hasSaved: boolean;
  savedNotes: string;
}) {
  return (
    <form action={save} style={{ marginTop: "1.25rem", borderTop: "1px solid var(--wh-border-light)", paddingTop: "1rem" }}>
      {/* Capture the current calculator state as the saved protocol. */}
      {(Object.keys(state) as (keyof PitchingFormState)[]).map((k) => (
        <input key={k} type="hidden" name={k} value={state[k]} />
      ))}
      <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
        Protocol notes (optional)
        <textarea
          name="notes"
          defaultValue={savedNotes}
          rows={2}
          style={{ display: "block", width: "100%", marginTop: "0.25rem", padding: "0.3rem", border: "1px solid #ccc", borderRadius: 4 }}
        />
      </label>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button type="submit" className="wh-btn">
          {hasSaved ? "Update protocol" : "Save protocol to recipe"}
        </button>
        {hasSaved && (
          <button type="submit" formAction={remove} className="wh-btn-secondary">
            Remove
          </button>
        )}
      </div>
    </form>
  );
}

function describe(s: SavedProtocol, yeastName?: string): string {
  const parts: string[] = [];
  if (s.source === "liquid") parts.push(`${s.packs ?? 1} pack(s) of ${yeastName ?? "liquid yeast"}`);
  else if (s.source === "dry") parts.push(`${s.grams ?? 0} g dry ${yeastName ?? "yeast"}`);
  else parts.push(`${s.slurryMl ?? 0} mL slurry (${s.yeastFractionPct ?? 0}% solids)`);

  const starter = STARTER_LABELS[(s.starterType as StarterType)] ?? s.starterType;
  if (s.starterType && s.starterType !== "none") {
    parts.push(`${s.starterMl ?? 0} mL ${starter.toLowerCase()} starter`);
  } else {
    parts.push("pitched directly (no starter)");
  }

  const decay = DECAY_MODEL_LABELS[(s.decayModel as DecayModelKey)] ?? s.decayModel;
  parts.push(`${s.ageDays ?? 0} days old · ${decay.replace(/\s*\(.*\)$/, "")}`);

  let text = parts.join(" · ");
  if (s.notes) text += ` — ${s.notes}`;
  return text;
}
