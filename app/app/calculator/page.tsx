import { redirect } from "next/navigation";

// The beer-only calculator has been folded into the one all-drinks recipe
// builder. Kept as a redirect so old links and bookmarks still land somewhere.
export default function CalculatorPage() {
  redirect("/build");
}
