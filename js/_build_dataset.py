import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
text = (root / "simulacao_filas_saude_10000.csv").read_text(encoding="utf-8-sig")
lines = text.splitlines()
parts = ",\n".join(json.dumps(line, ensure_ascii=False) for line in lines)
out = root / "js" / "dataset.js"
out.write_text(
    "window.__FILAS_CSV__ = [\n" + parts + "\n].join(\"\\n\");\n",
    encoding="utf-8",
)
print("lines", len(lines), "bytes", out.stat().st_size)
