"use server";

import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export async function submitTakedownRequest(formData: FormData): Promise<void> {
  const recipeSlug = String(formData.get("recipeSlug") ?? "").trim();
  const requesterName = String(formData.get("requesterName") ?? "").trim();
  const requesterEmail = String(formData.get("requesterEmail") ?? "").trim();
  const requestReason = String(formData.get("requestReason") ?? "").trim();

  if (!requesterName || !requesterEmail || !requestReason) {
    throw new Error("Name, email, and reason are required.");
  }

  let recipeId: string | null = null;
  if (recipeSlug) {
    const recipe = await prisma.recipe.findUnique({ where: { slug: recipeSlug } });
    recipeId = recipe?.id ?? null;
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
