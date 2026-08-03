import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectScript, langProps, compareNames, sortByName, indexLetter, isNonEnglishScript,
} from "@/lib/script";

test("detects the writing system of real archive titles", () => {
  assert.equal(detectScript("맥락: American IPA").id, "hangul");
  assert.equal(detectScript("絶望した！(Zetsubou Shita!)").id, "kana"); // kana wins over han
  assert.equal(detectScript("左手 Stout").id, "han");
  assert.equal(detectScript("Имперский стаут").id, "cyrillic");
  assert.equal(detectScript("ρομφαια pils").id, "greek");
  assert.equal(detectScript("ניסוי שמרים").id, "hebrew");
  assert.equal(detectScript("الأمريكية بني").id, "arabic");
  assert.equal(detectScript("หมัดดาวใต้").id, "thai");
  assert.equal(detectScript("Kaddoo कद्दू").id, "devanagari");
  assert.equal(detectScript("Mørestout").id, "latin-ext");
  assert.equal(detectScript("Plain Pale Ale").id, "latin");
  assert.equal(detectScript(null).id, "latin");
});

test("emits lang and dir so screen readers and fonts behave", () => {
  assert.deepEqual(langProps("맥락"), { lang: "ko" });
  assert.deepEqual(langProps("ניסוי שמרים"), { lang: "he", dir: "rtl" });
  assert.deepEqual(langProps("الأمريكية"), { lang: "ar", dir: "rtl" });
  // Plain ASCII needs no override; the document is already English.
  assert.deepEqual(langProps("Pale Ale"), {});
  // Accented Latin needs no lang guess — we cannot tell Swedish from German
  // from one word, and guessing wrong is worse than staying quiet.
  assert.deepEqual(langProps("Mørestout"), {});
});

test("accented names sort with their base letter, not after Z", () => {
  const names = ["Ölvisholt", "Zack", "Andersson", "Émile", "Ñoño", "Bob"];
  assert.deepEqual(sortByName(names, (n) => n), [
    "Andersson", "Bob", "Émile", "Ñoño", "Ölvisholt", "Zack",
  ]);
  // The bug this replaces: default sort puts all three accented names last.
  assert.deepEqual([...names].sort(), [
    "Andersson", "Bob", "Zack", "Émile", "Ñoño", "Ölvisholt",
  ]);
});

test("numbers inside names sort numerically", () => {
  assert.deepEqual(sortByName(["Batch 10", "Batch 2"], (n) => n), ["Batch 2", "Batch 10"]);
});

test("index letters fold accents and group non-Latin scripts", () => {
  assert.equal(indexLetter("Ölvisholt"), "O");
  assert.equal(indexLetter("Émile"), "E");
  assert.equal(indexLetter("andersson"), "A");
  assert.equal(indexLetter("맥락"), "Korean");
  assert.equal(indexLetter("ρομφαια"), "Greek");
  assert.equal(indexLetter("42 Pale"), "#");
  assert.equal(indexLetter(""), "#");
});

test("isNonEnglishScript flags anything beyond plain ASCII Latin", () => {
  assert.equal(isNonEnglishScript("맥락"), true);
  assert.equal(isNonEnglishScript("Mørestout"), true);
  assert.equal(isNonEnglishScript("Pale Ale"), false);
});
