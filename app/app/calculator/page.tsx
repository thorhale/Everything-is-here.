import { redirect } from "next/navigation";

export const metadata = {
  title: "Recipe calculator — WortHogg",
  description: "Work out gravity, bitterness, colour and alcohol for a grain bill.",
};

// The beer-only calculator has been folded into the one all-drinks recipe
// builder. Kept as a redirect so old links and bookmarks still land somewhere.
export default function CalculatorPage() {
  redirect("/build");
}
