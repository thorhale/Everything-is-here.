"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : null;
}

function str(formData: FormData, key: string, fallback = ""): string {
  return String(formData.get(key) ?? fallback).trim();
}

// Persist (or update) the yeast pitching + propagation protocol attached to a
// recipe. Server actions are publicly-invokable POST endpoints, so this
// enforces admin auth itself - the page-level gate protects nothing.
export async function savePitchingProtocol(recipeSlug: string, formData: FormData): Promise<void> {
  await requireAdmin();

  const recipe = await prisma.recipe.findUnique({ where: { slug: recipeSlug } });
  if (!recipe) throw new Error("Recipe not found");

  const data = {
    volume: num(formData, "volume") ?? 0,
    volumeUnit: str(formData, "volumeUnit", "gal"),
    og: num(formData, "og") ?? 0,
    pitchType: str(formData, "pitchType", "ale"),
    source: str(formData, "source", "liquid"),
    packs: num(formData, "packs"),
    grams: num(formData, "grams"),
    slurryMl: num(formData, "slurryMl"),
    yeastFractionPct: num(formData, "yeastFractionPct"),
    ageDays: num(formData, "ageDays"),
    decayModel: str(formData, "decayModel", "classic"),
    starterType: str(formData, "starterType", "none"),
    starterMl: num(formData, "starterMl"),
    notes: str(formData, "notes").slice(0, 2000) || null,
    updatedBy: "admin",
  };

  await prisma.recipePitchingProtocol.upsert({
    where: { recipeId: recipe.id },
    create: { recipeId: recipe.id, ...data },
    update: data,
  });

  revalidatePath(`/recipes/${recipeSlug}`);
}

export async function deletePitchingProtocol(recipeSlug: string): Promise<void> {
  await requireAdmin();

  const recipe = await prisma.recipe.findUnique({ where: { slug: recipeSlug } });
  if (!recipe) throw new Error("Recipe not found");

  await prisma.recipePitchingProtocol.deleteMany({ where: { recipeId: recipe.id } });
  revalidatePath(`/recipes/${recipeSlug}`);
}
