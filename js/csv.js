const Utils = (() => {
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cpfDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function formatCpf(value) {
    const digits = cpfDigits(value).padStart(11, "0").slice(-11);
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  function initials(name) {
    return String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => `${part[0].toUpperCase()}.`)
      .join(" ");
  }

  function comparePt(a, b) {
    return String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base" });
  }

  function parseStamp(value) {
    if (!value) return null;
    const normalized = String(value).replace(" ", "T");
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value) {
    const date = value instanceof Date ? value : parseStamp(value);
    if (!date) return "—";
    return date.toLocaleDateString("pt-BR");
  }

  function formatDateTime(value) {
    const date = value instanceof Date ? value : parseStamp(value);
    if (!date) return "—";
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatLongDate(date = new Date()) {
    return date.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function addMonths(date, months) {
    const copy = new Date(date.getTime());
    const day = copy.getDate();
    copy.setMonth(copy.getMonth() + months);
    if (copy.getDate() < day) copy.setDate(0);
    const fraction = months - Math.floor(months);
    copy.setTime(copy.getTime() + fraction * 30.44 * 24 * 60 * 60 * 1000);
    return copy;
  }

  function daysAgo(days, from = new Date()) {
    return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
  }

  function avatarLetters(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "FS";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  return {
    escapeHtml,
    cpfDigits,
    formatCpf,
    initials,
    comparePt,
    parseStamp,
    formatDate,
    formatDateTime,
    formatLongDate,
    addMonths,
    daysAgo,
    avatarLetters,
  };
})();

const Csv = (() => {
  function parse(text, delimiter = ";") {
    const source = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      const next = source[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') {
          field += '"';
          i += 1;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }

    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }

    const header = (rows.shift() || []).map((h) => h.trim());
    return rows
      .filter((cells) => cells.some((cell) => String(cell).trim() !== ""))
      .map((cells) => {
        const record = {};
        header.forEach((key, index) => {
          record[key] = cells[index] == null ? "" : String(cells[index]).trim();
        });
        return record;
      });
  }

  function stringify(records, delimiter = ";") {
    if (!records.length) return "";
    const header = Object.keys(records[0]);
    const lines = [header.join(delimiter)];
    records.forEach((record) => {
      lines.push(header.map((key) => escapeCell(record[key], delimiter)).join(delimiter));
    });
    return lines.join("\n");
  }

  function escapeCell(value, delimiter) {
    const text = value == null ? "" : String(value);
    if (/["\n\r]/.test(text) || text.includes(delimiter)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  return { parse, stringify };
})();
