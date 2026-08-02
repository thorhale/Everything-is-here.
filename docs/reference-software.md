# What to mimic, per beverage

Research into the software professionals and hobbyists actually use, so each
part of WortHogg borrows from the right reference instead of forcing everything
into a beer-shaped UI. The headline finding: **beer is the only category with a
mature consumer recipe-design app to imitate. Everything else is either
heavyweight commercial ERP or an untapped gap — which is the opportunity.**

## Beer — imitate Brewfather, reference the rest
A crowded, mature category of consumer recipe-design apps. This is where we
match an existing bar rather than set one.
- **Brewfather** — the modern benchmark. Mobile-first, clean recipe builder,
  inventory, batch/brew-day tracking, device integration (Tilt, iSpindel).
  **This is the feel to mimic for the beer side of the builder.**
- **BeerSmith** — the deep, classic desktop tool; older UI, exhaustive.
- **Brewer's Friend** — web, strong per-calculator SEO, freemium.
- **Grainfather / Brewtarget** — hardware-tied and open-source respectively.
- **Borrow:** the mobile-first single-screen recipe builder, live stats as you
  edit, an inventory concept, and a batch log.

## Wine & Cider — the leaders are winery ERPs, not hobby tools
The popular professional software is operations/compliance, not recipe design.
- **InnoVint** (2,000+ wineries), **vintrace** (also does cider), **Process2Wine**,
  **Vinsight**, **vinCreative** — production, lot/barrel tracking, inventory,
  costing, compliance. Winery ERPs, the equivalent of Ekos/Ollie in beer.
- Hobby winemaking runs on spreadsheets and standalone calculators.
- **Borrow (not the whole ERP):** fermentation-curve tracking, an additions
  log, and lot/batch identity. Cider commercially lives inside the wine tools,
  so treat it like small-scale wine, not beer.

## Mead — community + calculators, no dominant app
- **GotMead** (the community/forum), **Meadmakr** and **Brewer's Friend** mead
  calculators. No equivalent of Brewfather.
- **Borrow:** staggered nutrient scheduling (TOSNA) and additions timing — which
  the builder already computes in `lib/must.ts`. We are already competitive here.

## Sake — no recipe-design software exists (opportunity)
- What turned up is **consumer discovery**: Sakenomy, Sakeist (label scanning,
  e-commerce, sommelier-facing). Production is craft/traditional; automation is
  an active *research* area, not a shipping consumer tool.
- **There is no "Brewfather for sake."** The reference is the *process and
  classification*, not a UI: kōji → moto/shubo → moromi (multiple parallel
  fermentation), and the legal grades (ginjō, daiginjō, junmai) we already
  encode in the SAKE guidelines. This is white space WortHogg could own.

## Baijiu & Huangjiu (China) — industrial only (opportunity)
- Production is solid-state fermentation with qū/jiuqu starters; the software
  is factory automation/MES and academic process control. **No consumer or
  hobby recipe tool.**
- The reference is the process and the **GB national standards** already in the
  CHINA guidelines. Another gap, not a UI to copy.

## India — commercial wineries, little hobby tooling
- **Sula** and peers run standard commercial winery operations; homebrewing is
  legally constrained, so there is little consumer software. Regional country
  liquors are essentially undocumented in software.
- Reference the process + any legal standard (the INDIA guidelines), not an app.

## Distilling / spirits — hobby calculators + the wine/spirit ERPs
- Hobby: ABV/proofing, cuts and yield calculators (StillDragon community and
  the like). Commercial: the same ERP tier as wine.
- **Borrow:** proofing-down, collection-strength and yield math — already in the
  builder's spirit path (`washYield`, `proofDown` in `lib/must.ts`).

## The strategic read
1. **Beer:** match Brewfather's polish — mobile-first builder, inventory, batch
   log. This is catch-up, and the bar is known.
2. **Everything else:** there is no consumer tool to lose to. For sake, baijiu,
   huangjiu, mead, cider and the regional ferments, a clean recipe + reference
   experience built on the process and the legal/style classification we
   already hold would make WortHogg the *first* decent tool in each. The moat is
   that nobody else treats all of these as first-class.
3. So the UI plan is **two-tier**: a Brewfather-grade beer experience, and a
   shared, process-driven builder/reference for every other ferment that leans
   on the guidelines data rather than a competitor's layout.
