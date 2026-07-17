"use server";

import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitTakedownRequest(formData: FormData): Promise<void> {
  // Honeypot: real users never see or fill this field. Pretend success so
  // bots don't learn they were filtered.
  const honeypot = String(formData.get("website") ?? "");
  if (honeypot) {
    redirect("/takedown/submitted");
  }

  const recipeSlug = String(formData.get("recipeSlug") ?? "").trim().slice(0, 200);
  const requesterName = String(formData.get("requesterName") ?? "").trim().slice(0, 120);
  const requesterEmail = String(formData.get("requesterEmail") ?? "").trim().slice(0, 200);
  const requestReason = String(formData.get("requestReason") ?? "").trim().slice(0, 4000);

  if (!requesterName || !requestReason || !EMAIL_RE.test(requesterEmail)) {
    redirect("/takedown?error=1");
  }

  let recipeId: string | null = null;
  if (recipeSlug) {
    const recipe = await prisma.recipe.findUnique({ where: { slug: recipeSlug } });
    recipeId = recipe?.id ?? null;
  }

  // Dedupe: one pending request per email+recipe is enough; resubmits
  // just land on the success page.
  const existing = await prisma.takedownRequest.findFirst({
    where: { requesterEmail, recipeId, status: "pending" },
  });
  if (existing) {
    redirect("/takedown/submitted");
  }

  await prisma.takedownRequest.create({
    data: {
      recipeId,
      requesterName,
      requesterEmail,
      requestReason,
      status: "pending",
    },
  });

  redirect("/takedown/submitted");
}
