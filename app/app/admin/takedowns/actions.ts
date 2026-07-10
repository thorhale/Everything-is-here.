"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function approveTakedown(requestId: string): Promise<void> {
  const req = await prisma.takedownRequest.update({
    where: { id: requestId },
    data: { status: "approved", resolvedAt: new Date() },
  });

  // Hide the specific recipe, or every recipe by the associated brewer if
  // this was a broader "everything under my username" request.
  if (req.recipeId) {
    await prisma.recipe.update({
      where: { id: req.recipeId },
      data: { isHidden: true, takedownStatus: "approved" },
    });
  } else if (req.brewerId) {
    await prisma.recipe.updateMany({
      where: { brewerId: req.brewerId },
      data: { isHidden: true, takedownStatus: "approved" },
    });
  }

  revalidatePath("/admin/takedowns");
}

export async function rejectTakedown(requestId: string): Promise<void> {
  await prisma.takedownRequest.update({
    where: { id: requestId },
    data: { status: "rejected", resolvedAt: new Date() },
  });
  revalidatePath("/admin/takedowns");
}
