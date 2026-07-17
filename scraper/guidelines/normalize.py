"""Normalize competition style guidelines into one common JSON shape.

Sources (fetched into data/guidelines/raw/):
- BJCP 2021 (beerjson JSON), 2015 (styleguide JSON incl. mead+cider),
  2008 (lrdodge JSON incl. mead+cider)
- Brewers Association 2015-2026 PDFs (the judging basis for both the
  World Beer Cup and the Great American Beer Festival)

Output: data/guidelines/<system>-<year>.json
  { system, year, title, sourceUrl, attribution, categories:
    [{ code, name, styles: [{ code, name, ogMin..abvMax, impression,
       aroma, appearance, flavor, mouthfeel, comments, history,
       ingredients, comparison, examples, tags }] }] }

Usage: python3 scraper/guidelines/normalize.py
"""
from __future__ import annotations

import json
import os
import re

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "guidelines", "raw")
OUT = os.path.join(RAW, "..")


def num(s):
    if s is None:
        return None
    m = re.search(r"-?\d+\.?\d*", str(s))
    return float(m.group(0)) if m else None


def style_row(code, name, **kw):
    row = {
        "code": code, "name": name,
        "ogMin": None, "ogMax": None, "fgMin": None, "fgMax": None,
        "ibuMin": None, "ibuMax": None, "srmMin": None, "srmMax": None,
        "abvMin": None, "abvMax": None,
        "impression": None, "aroma": None, "appearance": None,
        "flavor": None, "mouthfeel": None, "comments": None,
        "history": None, "ingredients": None, "comparison": None,
        "examples": None, "tags": None,
    }
    row.update({k: v for k, v in kw.items() if k in row})
    return row


def write(doc, fname):
    doc["categories"] = [c for c in doc["categories"] if c["styles"]]
    n = sum(len(c["styles"]) for c in doc["categories"])
    path = os.path.join(OUT, fname)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    print(f"{fname}: {len(doc['categories'])} categories, {n} styles")


# --- BJCP 2015 (beer + mead + cider) -----------------------------------

def bjcp_2015():
    d = json.load(open(os.path.join(RAW, "bjcp-2015.json"), encoding="utf-8"))
    cats = []
    for cls in d["styleguide"]["class"]:
        for cat in cls["category"]:
            subs = cat.get("subcategory") or []
            if isinstance(subs, dict):
                subs = [subs]
            styles = []
            for s in subs:
                st = s.get("stats") or {}
                def rng(key):
                    v = st.get(key) or {}
                    return num(v.get("low")), num(v.get("high"))
                og = rng("og"); fg = rng("fg"); ibu = rng("ibu"); srm = rng("srm"); abv = rng("abv")
                ex = s.get("examples")
                styles.append(style_row(
                    s.get("id"), s.get("name"),
                    ogMin=og[0], ogMax=og[1], fgMin=fg[0], fgMax=fg[1],
                    ibuMin=ibu[0], ibuMax=ibu[1], srmMin=srm[0], srmMax=srm[1],
                    abvMin=abv[0], abvMax=abv[1],
                    impression=s.get("impression"), aroma=s.get("aroma"),
                    appearance=s.get("appearance"), flavor=s.get("flavor"),
                    mouthfeel=s.get("mouthfeel"), comments=s.get("comments"),
                    history=s.get("history"), ingredients=s.get("ingredients"),
                    comparison=s.get("comparison"),
                    examples=ex if isinstance(ex, str) else None,
                    tags=s.get("tags"),
                ))
            cats.append({"code": cat.get("id"), "name": cat.get("name"), "styles": styles})
    write({
        "system": "BJCP", "year": 2015,
        "title": "BJCP 2015 Style Guidelines (beer, mead & cider)",
        "sourceUrl": "https://www.bjcp.org/style/2015/",
        "attribution": "© Beer Judge Certification Program. Reproduced for education and judging with attribution.",
        "categories": cats,
    }, "bjcp-2015.json")


# --- BJCP 2021 (beer; beerjson) -----------------------------------------

def bjcp_2021():
    d = json.load(open(os.path.join(RAW, "bjcp-2021.json"), encoding="utf-8"))
    bycat = {}
    order = []
    for s in d["beerjson"]["styles"]:
        key = (str(s.get("category_id")), s.get("category"))
        if key not in bycat:
            bycat[key] = []
            order.append(key)
        def rng(field):
            v = s.get(field) or {}
            return (v.get("minimum") or {}).get("value"), (v.get("maximum") or {}).get("value")
        og = rng("original_gravity"); fg = rng("final_gravity")
        ibu = rng("international_bitterness_units"); srm = rng("color"); abv = rng("alcohol_by_volume")
        bycat[key].append(style_row(
            s.get("style_id"), s.get("name"),
            ogMin=og[0], ogMax=og[1], fgMin=fg[0], fgMax=fg[1],
            ibuMin=ibu[0], ibuMax=ibu[1], srmMin=srm[0], srmMax=srm[1],
            abvMin=abv[0], abvMax=abv[1],
            impression=s.get("overall_impression"), aroma=s.get("aroma"),
            appearance=s.get("appearance"), flavor=s.get("flavor"),
            mouthfeel=s.get("mouthfeel"), comments=s.get("comments"),
            history=s.get("history"), ingredients=s.get("ingredients"),
            comparison=s.get("style_comparison"), examples=s.get("examples"),
            tags=s.get("tags"),
        ))
    cats = [{"code": k[0], "name": k[1], "styles": bycat[k]} for k in order]
    write({
        "system": "BJCP", "year": 2021,
        "title": "BJCP 2021 Beer Style Guidelines",
        "sourceUrl": "https://www.bjcp.org/style/2021/",
        "attribution": "© Beer Judge Certification Program. Reproduced for education and judging with attribution.",
        "categories": cats,
    }, "bjcp-2021.json")


# --- BJCP 2008 (beer + mead + cider) -----------------------------------

def bjcp_2008():
    d = json.load(open(os.path.join(RAW, "bjcp-2008-styles.json"), encoding="utf-8"))
    cats = []
    for cls in ("beers", "meads", "ciders"):
        for cat in d.get(cls, []):
            styles = []
            for i, s in enumerate(cat.get("subcategories", [])):
                g = s.get("guidelines") or {}
                vs = g.get("vitalStatistics") or {}
                def rng(key):
                    v = vs.get(key)
                    if not v:
                        return None, None
                    nums = re.findall(r"\d+\.?\d*", str(v))
                    if len(nums) >= 2:
                        return float(nums[0]), float(nums[1])
                    return (float(nums[0]), None) if nums else (None, None)
                og = rng("og"); fg = rng("fg"); ibu = rng("ibu"); srm = rng("srm"); abv = rng("abv")
                ex = s.get("commercialExamples") or []
                examples = ", ".join(e.get("name", "") for e in ex if isinstance(e, dict)) or None
                styles.append(style_row(
                    f"{cat.get('number')}{s.get('letter') or chr(65 + i)}", s.get("name"),
                    ogMin=og[0], ogMax=og[1], fgMin=fg[0], fgMax=fg[1],
                    ibuMin=ibu[0], ibuMax=ibu[1], srmMin=srm[0], srmMax=srm[1],
                    abvMin=abv[0], abvMax=abv[1],
                    impression=g.get("overallImpression"), aroma=g.get("aroma"),
                    appearance=g.get("appearance"), flavor=g.get("flavor"),
                    mouthfeel=g.get("mouthfeel"), comments=g.get("comments"),
                    history=g.get("history"), ingredients=g.get("ingredients"),
                    examples=examples,
                ))
            cats.append({"code": str(cat.get("number")), "name": cat.get("name"), "styles": styles})
    write({
        "system": "BJCP", "year": 2008,
        "title": "BJCP 2008 Style Guidelines (beer, mead & cider)",
        "sourceUrl": "https://www.bjcp.org/style/2008/",
        "attribution": "© Beer Judge Certification Program. Reproduced for education and judging with attribution.",
        "categories": cats,
    }, "bjcp-2008.json")


# --- Brewers Association PDFs (WBC / GABF basis), 2015-2026 --------------

STATS_RE = re.compile(r"Original Gravity", re.I)
PAGENUM_RE = re.compile(r"^\s*(\d+|[ivxlc]+)\s*$", re.I)
TOC_RE = re.compile(r"^(\s*)(.+?)\s*\.{4,}\s*[ivxlc\d]+\s*$", re.I)


def clean_text(t: str) -> str:
    return t.replace("ﬂ", "fl").replace("ﬁ", "fi").replace("­", "")


def ba_year(year: int, source_url: str):
    # -raw (content-stream order) keeps each style's two-column body
    # contiguous, unlike the default reading-order heuristic
    raw_path = os.path.join(RAW, f"ba-{year}-rawmode.txt")
    if not os.path.exists(raw_path):
        os.system(f"pdftotext -raw {os.path.join(RAW, f'ba-{year}.pdf')} {raw_path}")
    text = clean_text(open(raw_path, encoding="utf-8").read())
    lines = text.split("\n")

    # 1) ordered names from the table of contents (dot-leader lines)
    toc = []
    for ln in lines[:700]:
        m = TOC_RE.match(ln)
        if m:
            name = m.group(2).strip()
            if name and name.lower() != "table of contents" and name not in toc:
                toc.append(name)
    toc_set = set(toc)

    # 2) body: a TOC name owning a stats block is a style; TOC names
    #    without one act as section/category headers for what follows.
    body_start = 0
    for i, ln in enumerate(lines):
        if TOC_RE.match(ln):
            body_start = i + 1
    positions = []
    for i in range(body_start, len(lines)):
        if lines[i].strip() in toc_set:
            positions.append((i, lines[i].strip()))

    entries = {}
    for j, (i, name) in enumerate(positions):
        end = positions[j + 1][0] if j + 1 < len(positions) else len(lines)
        chunk = [l for l in lines[i + 1:end] if not PAGENUM_RE.match(l)]
        body = "\n".join(chunk).strip()
        if name not in entries or (STATS_RE.search(body) and not STATS_RE.search(entries[name])):
            entries[name] = body

    def parse_stats(body):
        m = STATS_RE.search(body)
        stats_txt = " ".join(body[m.start():].split()) if m else ""
        def pair(pat):
            mm = re.search(pat, stats_txt)
            return (float(mm.group(1)), float(mm.group(2))) if mm else (None, None)
        og = pair(r"Original Gravity[^\d]*(1\.\d{3})\s*-\s*(1\.\d{3})")
        fg = pair(r"Final Gravity[^)]*\)\s*(1\.\d{3})\s*-\s*(1\.\d{3})")
        abv = pair(r"\(Volume\)[^(]*\(([\d.]+)%\s*-\s*([\d.]+)%\)")
        ibu = pair(r"\(IBU\)\s*([\d.]+)\s*-\s*([\d.]+)")
        srm = pair(r"SRM\s*\(EBC\)\s*([\d.]+)\s*-\s*([\d.]+)")
        desc = body[:m.start()].strip() if m else body.strip()
        return og, fg, ibu, srm, abv, desc

    cats = []
    current = None
    for name in toc:
        body = entries.get(name, "")
        if body and STATS_RE.search(body):
            if current is None:
                current = {"code": None, "name": "General", "styles": []}
                cats.append(current)
            og, fg, ibu, srm, abv, desc = parse_stats(body)
            current["styles"].append(style_row(
                None, name,
                ogMin=og[0], ogMax=og[1], fgMin=fg[0], fgMax=fg[1],
                ibuMin=ibu[0], ibuMax=ibu[1], srmMin=srm[0], srmMax=srm[1],
                abvMin=abv[0], abvMax=abv[1],
                impression=desc or None,
            ))
        else:
            current = {"code": None, "name": name, "styles": []}
            cats.append(current)
    write({
        "system": "BA", "year": year,
        "title": f"Brewers Association {year} Beer Style Guidelines (World Beer Cup / GABF)",
        "sourceUrl": source_url,
        "attribution": "© Brewers Association. These guidelines are the judging basis for the World Beer Cup® and Great American Beer Festival®. Reproduced with attribution.",
        "categories": cats,
    }, f"ba-{year}.json")


BA_URLS = {
    2015: "https://cdn.brewersassociation.org/wp-content/uploads/2017/04/2015-brewers-association-beer-style-guidelines.pdf",
    2016: "https://cdn.brewersassociation.org/wp-content/uploads/2017/04/2016_BA_Beer_Style_Guidelines.pdf",
    2017: "https://cdn.brewersassociation.org/wp-content/uploads/2017/05/2017-BA-Beer-Style-Guidelines.pdf",
    2018: "https://cdn.brewersassociation.org/wp-content/uploads/2018/03/2018_BA_Beer_Style_Guidelines_Final.pdf",
    2019: "https://s3-us-west-2.amazonaws.com/brewersassoc/wp-content/uploads/2019/04/BA-style-guidelines-2019.pdf",
    2020: "https://cdn.brewersassociation.org/wp-content/uploads/2020/03/BA-beer-style-guidelines-2020.pdf",
    2021: "https://cdn.brewersassociation.org/wp-content/uploads/2021/02/22104023/2021_BA_Beer_Style_Guidelines_Final.pdf",
    2022: "https://cdn.brewersassociation.org/wp-content/uploads/2022/02/25084047/2022_BA_Beer_Style_Guidelines_Final.pdf",
    2023: "https://cdn.brewersassociation.org/wp-content/uploads/2023/07/10124402/2023_BA_Beer_Style_Guidelines-updated.pdf",
    2024: "https://cdn.brewersassociation.org/wp-content/uploads/2024/12/12144941/2024_BA_Beer_Style_Guidelines.pdf",
    2025: "https://cdn.brewersassociation.org/wp-content/uploads/2025/06/20143326/2025_BA_Beer_Style_Guidelines.pdf",
    2026: "https://cdn.brewersassociation.org/wp-content/uploads/2025/12/12085737/2026_BA_Beer_Style_Guidelines.pdf",
}




# --- American Wine Society amateur competition wine classes -------------
# Hand-curated from the AWS National Amateur Wine Competition brochure
# (americanwinesociety.org); judged on the UC Davis 20-point system.

AWS_CLASSES = [
    ("White Vinifera", "Table wines made from a Vinifera species of grape.", [
        ("105", "Chardonnay - Unoaked"), ("110", "Chardonnay - Oaked"),
        ("115", "Albari\u00f1o"), ("120", "Riesling (Dry)"),
        ("121", "Riesling (Semi-Dry)"), ("122", "Riesling (Semi-Sweet)"),
        ("123", "Riesling (Sweet)"), ("130", "Gew\u00fcrztraminer"),
        ("140", "Sauvignon Blanc"), ("141", "Muscat"), ("145", "Petit Manseng"),
        ("150", "Pinot Grigio (Pinot Gris)"), ("160", "Viognier"),
        ("195", "Other White Vinifera Varietals"), ("199", "White Vinifera Blends"),
    ]),
    ("Red Vinifera", "Table wines made from a Vinifera species of grape.", [
        ("210", "Cabernet Sauvignon"), ("220", "Zinfandel"), ("230", "Merlot"),
        ("240", "Syrah/Shiraz"), ("245", "Barbera"), ("250", "Pinot Noir (Pinot Nero)"),
        ("255", "Nebbiolo"), ("260", "Cabernet Franc"), ("265", "Malbec"),
        ("270", "Sangiovese"), ("275", "Gamay"), ("280", "Petit Verdot"),
        ("285", "Tannat"), ("290", "Petite Sirah"),
        ("295", "Other Red Vinifera Varietals"), ("297", "Red Vinifera Rh\u00f4ne Blends"),
        ("298", "Red Vinifera Bordeaux Blends"), ("299", "Other Red Vinifera Blends"),
    ]),
    ("White Hybrid", "Table wines made from grapes crossed from more than one species.", [
        ("310", "Seyval"), ("320", "Vidal Blanc"), ("330", "Cayuga White"),
        ("340", "Traminette"), ("360", "Chardonel"), ("365", "Vignoles"),
        ("370", "La Crescent"), ("395", "Other White Hybrid Varietals"),
        ("399", "White Hybrid Blends"),
    ]),
    ("Red Hybrid", "Table wines made from grapes crossed from more than one species.", [
        ("410", "Chambourcin"), ("415", "Baco Noir"), ("420", "Chancellor"),
        ("430", "DeChaunac"), ("440", "Foch"), ("450", "Frontenac"),
        ("460", "Corot Noir"), ("465", "Marquette"), ("470", "Noiret"),
        ("495", "Other Red Hybrid Varietals"), ("499", "Red Hybrid Blends"),
    ]),
    ("White Native", "Table wines made from a North American species of grape.", [
        ("510", "Delaware"), ("520", "Diamond"), ("530", "Catawba"),
        ("535", "White Muscadines"), ("540", "Niagara"),
        ("545", "Other White Varietals"), ("549", "White Native Varietal Blends"),
    ]),
    ("Red Native", "Table wines made from a North American species of grape.", [
        ("550", "Concord"), ("560", "Cynthiana/Norton"), ("570", "Red Muscadines"),
        ("595", "Other Red Native Varieties"), ("599", "Red Native Blends"),
    ]),
    ("Mixed Blends", "Table wines made from grapes from different main categories (Vinifera/Hybrid, Hybrid/Native, Vinifera/Native).", [
        ("610", "White Mixed Blends"), ("620", "Red Mixed Blends"),
    ]),
    ("Ros\u00e9", "Blush, pink or rose colored grape table wines.", [
        ("660", "Ros\u00e9 - Vinifera"), ("670", "Ros\u00e9 - Hybrid"),
        ("680", "Ros\u00e9 - Native"), ("690", "Ros\u00e9 - Blends"),
    ]),
    ("Non-Grape", "Table wines made from fruits, vegetables, flowers, and grasses.", [
        ("710", "Apple or Pear Wine"), ("720", "Stone Fruits (Peach, Plum, Apricot, Cherry)"),
        ("730", "Raspberry or Blackberry"), ("735", "Strawberry"),
        ("740", "Blueberry or Elderberry"),
        ("750", "Specialty (Dandelion, Rhubarb, Citrus, Vegetable)"),
        ("760", "Cider/Perry (Apple/Pear)"), ("790", "Fruit Infused"),
        ("795", "Other Non-Grape"), ("799", "Fruit Blends / Fruit-Grape Blends"),
    ]),
    ("Non-Fortified Dessert", "Sweet dessert wines not fortified with spirits.", [
        ("820", "Ice Wine"), ("830", "Late Harvest Wines"),
        ("827", "Other Non-Fortified Dessert Wines"),
    ]),
    ("Fortified Dessert", "Dessert wines over 16% alcohol.", [
        ("831", "Port Style"), ("835", "Sherries"), ("896", "Other Fortified Dessert Wines"),
    ]),
    ("Mead / Honey Wine", "Wines fermented from honey.", [
        ("900", "Traditional/Show Mead"), ("905", "Melomel (with Fruit)"),
        ("910", "Metheglin (with Spice)"), ("915", "Great Mead/Sack (more honey)"),
        ("920", "Short Mead/Hydromel (more water)"), ("945", "Other Mead"),
    ]),
    ("Sparkling", "Wines made effervescent by carbon dioxide.", [
        ("990", "Sparkling Grape and Non-Grape (including blends)"),
    ]),
]


def aws_wine():
    cats = []
    for name, desc, classes in AWS_CLASSES:
        styles = [style_row(code, cname, impression=desc) for code, cname in classes]
        cats.append({"code": None, "name": name, "styles": styles})
    write({
        "system": "AWS", "year": 2025,
        "title": "American Wine Society Amateur Competition Wine Classes (UC Davis 20-point system)",
        "sourceUrl": "https://americanwinesociety.org/amateur-wine-competition/",
        "attribution": "\u00a9 American Wine Society. Wine classification from the AWS National Amateur Wine Competition; wines judged on the UC Davis 20-point scale. Reproduced with attribution.",
        "categories": cats,
    }, "aws-2025.json")


if __name__ == "__main__":
    bjcp_2008()
    bjcp_2015()
    bjcp_2021()
    for y, u in sorted(BA_URLS.items()):
        ba_year(y, u)
    aws_wine()
