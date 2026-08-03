# Making WortHogg multilingual without machine translation

The app has three kinds of text, and they need three different answers. Treating
them the same is what produces the lame result.

## 1. The reference corpus — do not translate it, route to the authoritative version

This is the important one, and it is the reason machine translation is not just
inelegant here but actively destructive.

Every figure in this project traces to a document someone can go and read. That
is enforced by `validate-sources.mjs` and it is the whole product. A
machine-translated AWRI inoculation rate is no longer AWRI's words — it is our
paraphrase wearing AWRI's citation. The provenance would still *say* AWRI while
the text no longer came from them.

The good news is that the most important sources are already multilingual, in
their own right, published by the bodies themselves:

| Source | Languages | Standing |
|---|---|---|
| **EUR-Lex** (EU beer, cider, wine and spirits law) | **24** | Every language version is **equally authentic** and legally binding. These are parallel originals, not translations. |
| **BJCP style guidelines** | **13** — German, Spanish, French, Italian, Hungarian, Polish, Portuguese, Bulgarian, Russian, Ukrainian, Thai, Japanese, Chinese | Published by BJCP. **BJCP states they are made by local speakers, not by BJCP, and that accuracy has not been independently verified** — so they must be labelled that way, never presented as equivalent to the English. |
| **OIV** (International Organisation of Vine and Wine) | French, English, Spanish | Official languages of the organisation. |
| **UNESCO Intangible Cultural Heritage** | English, French (+ others per entry) | Official. |
| **Japan Sake and Shochu Makers Association** | Japanese original | The English is the secondary version; the Japanese is the source. |
| **Vin Méthode Nature charter** | French original, official English | We currently cite the English; the French is the governing text. |

So the design is **citation routing, not translation**: a reader in Spanish
opening a beer-law entry gets the Spanish EUR-Lex text, because that *is* the
law. A reader in Polish gets the Polish BJCP guideline, with BJCP's own
verification caveat attached.

This is strictly better than translating, and it costs no translation effort —
only a `sourceUrls` map keyed by language on the documents that have one.

**Where no authoritative version exists, say so and show the original.** An
untranslated entry with its real source beats a fluent one that cannot be
checked. That is the same rule already applied to the fermentation archetypes,
where 1 of 32 stays marked "figures pending" rather than being filled in with a
guess.

## 2. The UI chrome — ordinary human-translated i18n

Buttons, labels, navigation, form fields, the explanatory paragraphs. This is a
bounded string set and the only part that needs real translation work.

Mechanism: Next.js App Router internationalised routing with message catalogues
(`next-intl` or the built-in `[locale]` segment). Catalogues are JSON, so they
are reviewable in pull requests and a native speaker can correct one string
without touching code.

**Do not machine-translate this either, but for a different reason:** brewing
has false friends that a general translator gets wrong. German *Malz* is malt
but *Würze* is wort and not "spice"; Spanish *mosto* covers both wort and grape
must; *levadura* is yeast but *fermento* is not interchangeable. A wrong word
in a calculator label produces a wrong beer.

## 3. Names — never translate

Hop varieties, yeast strain codes, maltster names, style names. Cascade is
Cascade everywhere. Kölsch, Hefeweizen, Saison, 白酒, 막걸리 are proper nouns
already. Translating them breaks search, breaks cross-referencing, and erases
the origin the `/origins` page exists to show.

The existing `lib/script.ts` already tags these with the right `lang` attribute
so they are pronounced and rendered correctly inside any surrounding language.

## Which languages first, decided by evidence

The archive itself says who is already here, rather than guessing from market
size. From the recipe titles and brewer names:

- **Korean** — 188 recipes from 31 brewers, the largest single non-English
  community in the corpus by a wide margin
- **Latin-script European languages** — 2,643 titles carrying diacritics
  (Nordic, German, Spanish, Portuguese, Polish, Czech)
- Small but real: Greek, Cyrillic, Hebrew, Devanagari, Thai, Arabic, Han, Kana

Cross-referenced against where authoritative multilingual sources already exist
(BJCP's 13, EUR-Lex's 24), the defensible first set is **Spanish, Portuguese,
German, French and Korean** — the first four because BJCP and EUR-Lex both
already cover them, and Korean because the archive's own users are there even
though no translated guideline exists for them yet.

## Order of work

1. **Citation routing.** Add per-language source URLs to the registry for the
   documents that have authoritative versions. No translation, immediate value,
   and it strengthens provenance rather than diluting it.
2. **Extract UI strings** into a catalogue and wire up locale routing. Ship with
   English only; nothing changes for existing users.
3. **Translate the catalogue** with native speakers, one language at a time, each
   as a reviewable pull request.
4. **Never** put the reference corpus through step 3.

## The rule

A page may be shown in a reader's language only when every number on it still
points at a document that says that number, in a language that document was
actually published in. Where that is not possible, the original stands and the
page says why.
