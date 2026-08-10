// Detecting the writing system a name or title is in, and sorting text so that
// every language lands where it belongs.
//
// WHY THIS EXISTS: 2,853 of the archive's recipes are not written in English —
// 188 in Korean from 31 brewers, plus Greek, Cyrillic, Hebrew, Devanagari,
// Thai, Arabic, Han and Kana, and 2,643 in Latin scripts carrying diacritics
// (Nordic, German, Spanish, Portuguese, Polish, Czech).
//
// JavaScript's default Array.sort() compares UTF-16 code units, which puts
// every accented and non-Latin name after every ASCII one:
//
//   ["Andersson","Bob","Zack","Émile","Ñoño","Ölvisholt","규연 유","맥락"]
//
// That is not a neutral technical detail — it sorts people out of the list by
// alphabet. Intl.Collator compares the way the language does:
//
//   ["Andersson","Bob","Émile","Ñoño","Ölvisholt","Zack","규연 유","맥락"]
//
// The lang attribute matters for the same reason: without it a screen reader
// reads Korean text with English phonetics, and browsers pick the wrong font
// for Han characters (Chinese vs Japanese glyph variants differ).

export type ScriptId =
  | "latin"
  | "latin-ext"
  | "hangul"
  | "kana"
  | "han"
  | "cyrillic"
  | "greek"
  | "arabic"
  | "hebrew"
  | "thai"
  | "devanagari";

export interface ScriptInfo {
  id: ScriptId;
  /** What to show a reader. */
  label: string;
  /** BCP-47 tag for the lang attribute. */
  lang: string;
  /** True for scripts written right to left, which need dir="rtl". */
  rtl?: boolean;
}

// Order matters: the most specific scripts are tested first, because a Japanese
// title mixing kana and kanji should read as Japanese rather than Han.
const SCRIPTS: { info: ScriptInfo; test: RegExp }[] = [
  { info: { id: "hangul", label: "Korean", lang: "ko" }, test: /[가-힯ᄀ-ᇿ㄰-㆏]/ },
  { info: { id: "kana", label: "Japanese", lang: "ja" }, test: /[぀-ヿ]/ },
  { info: { id: "han", label: "Chinese or Japanese", lang: "zh" }, test: /[一-鿿]/ },
  { info: { id: "cyrillic", label: "Cyrillic", lang: "ru" }, test: /[Ѐ-ӿ]/ },
  { info: { id: "greek", label: "Greek", lang: "el" }, test: /[Ͱ-Ͽ]/ },
  { info: { id: "hebrew", label: "Hebrew", lang: "he", rtl: true }, test: /[֐-׿]/ },
  { info: { id: "arabic", label: "Arabic", lang: "ar", rtl: true }, test: /[؀-ۿ]/ },
  { info: { id: "thai", label: "Thai", lang: "th" }, test: /[฀-๿]/ },
  { info: { id: "devanagari", label: "Devanagari", lang: "hi" }, test: /[ऀ-ॿ]/ },
  // Latin with diacritics, checked last: it is the fallback for anything that
  // is not plain ASCII but is still a Latin alphabet.
  { info: { id: "latin-ext", label: "Latin (accented)", lang: "" }, test: /[À-ɏ]/ },
];

const PLAIN: ScriptInfo = { id: "latin", label: "Latin", lang: "" };

/** Which writing system this text is predominantly in. */
export function detectScript(text: string | null | undefined): ScriptInfo {
  if (!text) return PLAIN;
  for (const { info, test } of SCRIPTS) if (test.test(text)) return info;
  return PLAIN;
}

/**
 * Props to spread onto the element wrapping the text, so assistive technology
 * and font selection get it right. Returns nothing for plain ASCII, which needs
 * no override — the page is already lang="en".
 */
export function langProps(text: string | null | undefined): { lang?: string; dir?: "rtl" } {
  const s = detectScript(text);
  const out: { lang?: string; dir?: "rtl" } = {};
  if (s.lang) out.lang = s.lang;
  if (s.rtl) out.dir = "rtl";
  return out;
}

/** True when the text is not plain ASCII Latin. */
export function isNonEnglishScript(text: string | null | undefined): boolean {
  return detectScript(text).id !== "latin";
}

// A single shared collator. Constructing one per comparison is slow, and
// "base" sensitivity means case and accents do not split a name away from its
// neighbours — Émile sorts with E, not after Z.
const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/** Compare two names the way a person reading an alphabetical list expects. */
export function compareNames(a: string | null | undefined, b: string | null | undefined): number {
  return collator.compare(a ?? "", b ?? "");
}

/** Sort a copy of `items` alphabetically by `key`, locale-aware. */
export function sortByName<T>(items: T[], key: (t: T) => string | null | undefined): T[] {
  return [...items].sort((x, y) => compareNames(key(x), key(y)));
}

/**
 * The letter to file a name under in an A–Z index. Accents fold to their base
 * letter (Ö → O) so accented names appear under the letter a reader looks for;
 * non-Latin scripts get their own group rather than being dumped in "#".
 */
export function indexLetter(text: string | null | undefined): string {
  const s = detectScript(text);
  if (s.id !== "latin" && s.id !== "latin-ext") return s.label;
  const first = (text ?? "").trim().normalize("NFD").replace(/[̀-ͯ]/g, "").charAt(0).toUpperCase();
  if (!first) return "#";
  return /[A-Z]/.test(first) ? first : "#";
}
