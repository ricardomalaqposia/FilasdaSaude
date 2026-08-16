import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "simulacao_filas_saude_10000.csv"
OUT_PATH = ROOT / "js" / "dados.js"
DEMO_CPF = "971.663.735-71"
ACTIVE = {"Aguardando", "Agendado"}
MAX_ACTIVE = 4
MAX_DONE = 2

with CSV_PATH.open(encoding="utf-8-sig") as handle:
    events = list(csv.DictReader(handle, delimiter=";"))

by_sol = defaultdict(list)
for event in events:
    by_sol[event["ID_SOLICITACAO"]].append(event)

current = {}
for sol_id, items in by_sol.items():
    items = sorted(items, key=lambda row: row["CARIMBO_DATA_HORA"])
    current[sol_id] = items[-1]

keep_ids = {
    sol_id
    for sol_id, row in current.items()
    if row["CPF_FICTICIO"] == DEMO_CPF
}

by_proc = defaultdict(lambda: {"active": [], "done": []})
for sol_id, row in current.items():
    if sol_id in keep_ids:
        continue
    if row["STATUS"] in ACTIVE:
        by_proc[row["PROCEDIMENTO"]]["active"].append(sol_id)
    elif row["STATUS"] == "Atendido":
        by_proc[row["PROCEDIMENTO"]]["done"].append(sol_id)

for groups in by_proc.values():
    groups["active"].sort(key=lambda sol_id: current[sol_id]["CARIMBO_DATA_HORA"])
    groups["done"].sort(key=lambda sol_id: current[sol_id]["CARIMBO_DATA_HORA"], reverse=True)
    keep_ids.update(groups["active"][:MAX_ACTIVE])
    keep_ids.update(groups["done"][:MAX_DONE])

selected = []
for sol_id in sorted(keep_ids):
    selected.extend(sorted(by_sol[sol_id], key=lambda row: row["CARIMBO_DATA_HORA"]))

payload = "window.__FILAS_EVENTOS__ = [\n" + ",\n".join(
    json.dumps(row, ensure_ascii=True, separators=(",", ":")) for row in selected
) + "\n];\n"
OUT_PATH.write_text(payload, encoding="utf-8")
print("solicitacoes", len(keep_ids))
print("eventos", len(selected))
print("bytes", OUT_PATH.stat().st_size)
print("demo", sum(1 for row in selected if row["CPF_FICTICIO"] == DEMO_CPF))
