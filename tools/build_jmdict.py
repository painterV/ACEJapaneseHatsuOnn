#!/usr/bin/env python3
"""Convert a jmdict-yomitan release into a compact lookup file for the app.

Reads the Yomitan `JMdict_english.zip` term banks and produces `jmdict.json`:
a flat map  headword -> [reading, english_gloss]  for every entry that has a
kanji headword. Each kanji headword is additionally indexed under its
*simplified-Chinese* form (composed from OpenCC's Japanese->traditional and
traditional->simplified character tables) so that zh-CN speech recognition
output (e.g. 学习) reaches the Japanese entry (学習).

Usage:
    build_jmdict.py <JMdict_english.zip> <JPShinjitaiCharacters.txt> \
                    <TSCharacters.txt> <out jmdict.json>

Source: https://github.com/yomidevs/jmdict-yomitan  (CC BY-SA 4.0)
Char maps: https://github.com/BYVoid/OpenCC  (Apache-2.0)
"""
import json
import sys
import unicodedata
import zipfile


def load_opencc(path: str) -> dict:
    """Parse an OpenCC 'key\\tvalue [value...]' table; keep the first value."""
    out = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.rstrip("\n")
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            key = parts[0].strip()
            val = parts[1].split(" ")[0].strip()
            if key and val:
                out[key] = val
    return out


def is_kanji(ch: str) -> bool:
    """True for a CJK ideograph (excludes kana, punctuation, fullwidth latin)."""
    return "CJK UNIFIED" in unicodedata.name(ch, "") or \
           "CJK COMPATIBILITY IDEOGRAPH" in unicodedata.name(ch, "")


def has_kanji(s: str) -> bool:
    return any(is_kanji(c) for c in s)


def text_of(node) -> str:
    """Concatenate all plain-text inside a Yomitan structured-content node."""
    if isinstance(node, str):
        return node
    if isinstance(node, list):
        return "".join(text_of(n) for n in node)
    if isinstance(node, dict):
        return text_of(node.get("content", ""))
    return ""


def collect_glosses(node, out: list) -> None:
    """Walk structured content; pull text from <ul data.content='glossary'> only."""
    if isinstance(node, list):
        for n in node:
            collect_glosses(n, out)
    elif isinstance(node, dict):
        data = node.get("data")
        if isinstance(data, dict) and data.get("content") == "glossary":
            content = node.get("content")
            items = content if isinstance(content, list) else [content]
            for it in items:
                t = text_of(it).strip()
                if t:
                    out.append(t)
        else:
            collect_glosses(node.get("content"), out)


def entry_gloss(glossary, limit: int = 90) -> str:
    """Best-effort short English gloss from an entry's glossary field."""
    out = []
    for g in glossary:
        if isinstance(g, str):
            if g.strip():
                out.append(g.strip())
        elif isinstance(g, dict) and g.get("type") == "structured-content":
            collect_glosses(g.get("content"), out)
    if not out:
        return ""
    s = "; ".join(out)
    return s[: limit - 1] + "…" if len(s) > limit else s


def main() -> int:
    zip_path, jp_path, ts_path, out_path = sys.argv[1:5]

    jp2trad = load_opencc(jp_path)   # shinjitai -> traditional
    trad2simp = load_opencc(ts_path)  # traditional -> simplified

    def to_simplified(s: str) -> str:
        out = []
        for ch in s:
            t = jp2trad.get(ch, ch)
            out.append(trad2simp.get(t, t))
        return "".join(out)

    best = {}  # headword -> (score, reading, gloss)
    z = zipfile.ZipFile(zip_path)
    banks = sorted(n for n in z.namelist() if n.startswith("term_bank_"))
    for bank in banks:
        for e in json.loads(z.read(bank)):
            expr, reading, score, glossary = e[0], e[1], e[4], e[5]
            if not expr or not has_kanji(expr):
                continue
            prev = best.get(expr)
            if prev is None or score > prev[0]:
                best[expr] = (score, reading or "", entry_gloss(glossary))

    # primary map (Japanese headword -> [reading, gloss])
    out = {expr: [r, g] for expr, (_s, r, g) in best.items()}

    # simplified-Chinese aliases (don't clobber a real Japanese headword).
    # alias value carries the Japanese headword as a 3rd element so the app can
    # display 学習 even when the lookup key was 学习.
    alias = 0
    for expr in list(best.keys()):
        simp = to_simplified(expr)
        if simp != expr and simp not in out:
            r, g = out[expr]
            out[simp] = [r, g, expr]
            alias += 1

    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))

    print(f"headwords (kanji): {len(best)}")
    print(f"simplified aliases added: {alias}")
    print(f"total keys: {len(out)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
