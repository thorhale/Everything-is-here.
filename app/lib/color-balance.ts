// Malt-bill colour rebalancing.
//
// The same variety differs in colour between maltsters (kiln and roast differ),
// so a substitution can push the beer's SRM off target. This flags the shift
// and offers ways to bring the grist back to a target colour. SRM comes from
// srmOfBill in the recipe engine, so these results always agree with the
// builder's own colour readout.
import { srmOfBill } from "@/lib/recipe-engine";

export interface BillItem {
  key: string;
  name: string;
  colorLovibond: number | null;
  massG: number;
  isBase: boolean; // base malt vs specialty/dark
}

export type RebalanceMethod = "specialty" | "swap-base" | "inform" | "custom";

export interface RebalanceResult {
  method: RebalanceMethod;
  bill: BillItem[]; // adjusted masses (unchanged for inform/custom)
  resultSrm: number;
  targetSrm: number;
  reachable: boolean;
  note: string;
}

/** Predicted SRM before/after changing one item's colour (a substitution). */
export function colorShift(
  bill: BillItem[],
  key: string,
  newColor: number | null,
  batchVolumeL: number
): { before: number; after: number; delta: number } {
  const before = srmOfBill(bill, batchVolumeL);
  const after = srmOfBill(
    bill.map((b) => (b.key === key ? { ...b, colorLovibond: newColor } : b)),
    batchVolumeL
  );
  return { before, after, delta: after - before };
}

const f1 = (n: number) => n.toFixed(1);

export function rebalance(
  bill: BillItem[],
  targetSrm: number,
  method: RebalanceMethod,
  batchVolumeL: number,
  opts?: { lighterBaseKey?: string; darkThresholdLov?: number }
): RebalanceResult {
  const cur = srmOfBill(bill, batchVolumeL);

  if (method === "inform" || method === "custom") {
    return {
      method,
      bill,
      resultSrm: cur,
      targetSrm,
      reachable: true,
      note:
        method === "inform"
          ? `Predicted ${f1(cur)} SRM against a target of ${f1(targetSrm)} — nothing changed.`
          : `Adjust weights by hand; the colour updates live. Now ${f1(cur)} SRM, target ${f1(targetSrm)}.`,
    };
  }

  if (method === "specialty") {
    // Scale the specialty/dark group; base malt (and gravity) held. SRM is
    // monotonic in the group's scale factor, so bisect for the target.
    const darkThreshold = opts?.darkThresholdLov ?? 20;
    const isDark = (b: BillItem) => !b.isBase || (b.colorLovibond ?? 0) >= darkThreshold;
    if (!bill.some(isDark)) {
      return {
        method,
        bill,
        resultSrm: cur,
        targetSrm,
        reachable: false,
        note: "No specialty or dark malt to scale — adjust the base malt or add a colour malt instead.",
      };
    }
    const withFactor = (fac: number) =>
      srmOfBill(bill.map((b) => (isDark(b) ? { ...b, massG: b.massG * fac } : b)), batchVolumeL);
    const srmMin = withFactor(0); // specialty removed entirely
    const srmMax = withFactor(4);
    let reachable = true;
    let factor: number;
    if (targetSrm <= srmMin) {
      factor = 0;
      reachable = false;
    } else if (targetSrm >= srmMax) {
      factor = 4;
      reachable = false;
    } else {
      let lo = 0;
      let hi = 4;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (withFactor(mid) < targetSrm) lo = mid;
        else hi = mid;
      }
      factor = (lo + hi) / 2;
    }
    const adjusted = bill.map((b) => (isDark(b) ? { ...b, massG: b.massG * factor } : b));
    const resultSrm = srmOfBill(adjusted, batchVolumeL);
    return {
      method,
      bill: adjusted,
      resultSrm,
      targetSrm,
      reachable,
      note: reachable
        ? `Scaled the specialty/dark malts to ${factor.toFixed(2)}× to reach ${f1(resultSrm)} SRM.`
        : `Target ${f1(targetSrm)} SRM is out of reach by scaling specialty alone — closest is ${f1(resultSrm)}.`,
    };
  }

  // swap-base: shift mass between the darkest base and a chosen lighter base,
  // holding total base mass (an approximation of gravity — exact only if the two
  // bases share extract potential).
  const lighterKey = opts?.lighterBaseKey;
  const bases = bill.filter((b) => b.isBase);
  if (!lighterKey || bases.length < 2) {
    return {
      method,
      bill,
      resultSrm: cur,
      targetSrm,
      reachable: false,
      note: "Swap-base needs a darker base plus a chosen lighter base to move mass between.",
    };
  }
  const dark = bases.reduce((a, b) => ((b.colorLovibond ?? 0) > (a.colorLovibond ?? 0) ? b : a));
  const light = bill.find((b) => b.key === lighterKey);
  if (!light || dark.key === light.key) {
    return { method, bill, resultSrm: cur, targetSrm, reachable: false, note: "Pick a distinct lighter base malt." };
  }
  const totalBaseMass = dark.massG + light.massG;
  const withFracDark = (fracDark: number) =>
    bill.map((b) =>
      b.key === dark.key
        ? { ...b, massG: totalBaseMass * fracDark }
        : b.key === light.key
        ? { ...b, massG: totalBaseMass * (1 - fracDark) }
        : b
    );
  const srmAllDark = srmOfBill(withFracDark(1), batchVolumeL);
  const srmAllLight = srmOfBill(withFracDark(0), batchVolumeL);
  let reachable = true;
  let frac: number;
  if (targetSrm >= srmAllDark) {
    frac = 1;
    reachable = false;
  } else if (targetSrm <= srmAllLight) {
    frac = 0;
    reachable = false;
  } else {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (srmOfBill(withFracDark(mid), batchVolumeL) > targetSrm) hi = mid;
      else lo = mid;
    }
    frac = (lo + hi) / 2;
  }
  const adjusted = withFracDark(frac);
  const resultSrm = srmOfBill(adjusted, batchVolumeL);
  return {
    method,
    bill: adjusted,
    resultSrm,
    targetSrm,
    reachable,
    note: reachable
      ? `Shifted base malt toward the lighter option to reach ${f1(resultSrm)} SRM (total base weight held).`
      : `Closest this base swap reaches is ${f1(resultSrm)} SRM.`,
  };
}
