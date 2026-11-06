# Turns i18n/strings.tsv into i18n/strings.js. Run after editing the TSV:  python3 i18n/build.py
import csv, json, pathlib
here = pathlib.Path(__file__).parent
rows = list(csv.reader(open(here / "strings.tsv", encoding="utf-8"), delimiter="\t", quoting=csv.QUOTE_NONE))
head, rows = rows[0], rows[1:]
out = {lang: {} for lang in head[1:]}
for r in rows:
    if len(r) != len(head):
        raise SystemExit(f"Row has {len(r)} columns, expected {len(head)}: {r[0][:60]}")
    for i, lang in enumerate(head[1:], 1):
        out[lang][r[0]] = r[i]
js = "// Generated from strings.tsv by build.py. Edit the TSV, not this file.\nwindow.I18N_STRINGS = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n"
(here / "strings.js").write_text(js, encoding="utf-8")
print(f"{len(rows)} phrases in {len(head) - 1} languages")
