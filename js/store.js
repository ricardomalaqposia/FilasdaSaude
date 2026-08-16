const Store = (() => {
  const CSV_PATH = "simulacao_filas_saude_10000.csv";
  const OVERLAY_KEY = "filas_saude_overlay_v1";
  const COLUMNS = [
    "CARIMBO_DATA_HORA",
    "ID_EVENTO",
    "TIPO_EVENTO",
    "ID_SOLICITACAO",
    "ID_PACIENTE",
    "NOME_PACIENTE",
    "CPF_FICTICIO",
    "TIPO_ATENDIMENTO",
    "GRUPO_COMPLEXIDADE",
    "PROCEDIMENTO",
    "PRIORIDADE",
    "JUSTIFICATIVA",
    "STATUS",
    "ID_FUNCIONARIO",
    "NOME_FUNCIONARIO",
    "CARGO_FUNCIONARIO",
  ];

  let baseEvents = [];
  let overlayEvents = [];
  let solicitations = [];
  let catalog = {};
  let employees = new Map();
  let patientsByCpf = new Map();
  let loaded = false;

  function loadOverlay() {
    try {
      const raw = localStorage.getItem(OVERLAY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      overlayEvents = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      overlayEvents = [];
    }
  }

  function saveOverlay() {
    localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlayEvents));
  }

  function pad(prefix, number, size) {
    return prefix + String(number).padStart(size, "0");
  }

  function nextId(prefix, size, getter) {
    let max = 0;
    allEvents().forEach((event) => {
      const value = getter(event);
      if (!value || !value.startsWith(prefix)) return;
      const num = Number(value.slice(prefix.length));
      if (!Number.isNaN(num) && num > max) max = num;
    });
    return pad(prefix, max + 1, size);
  }

  function allEvents() {
    return baseEvents.concat(overlayEvents);
  }

  function rebuild() {
    const events = allEvents().slice().sort((a, b) => {
      const byDate = a.CARIMBO_DATA_HORA.localeCompare(b.CARIMBO_DATA_HORA);
      if (byDate !== 0) return byDate;
      return a.ID_EVENTO.localeCompare(b.ID_EVENTO);
    });

    const grouped = new Map();
    events.forEach((event) => {
      const id = event.ID_SOLICITACAO;
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(event);
    });

    const nextSolicitations = [];
    const nextCatalog = {};
    const nextEmployees = new Map();
    const nextPatients = new Map();

    grouped.forEach((list, id) => {
      const firstInclusion = list.find((item) => item.TIPO_EVENTO === "INCLUSAO") || list[0];
      const current = list[list.length - 1];
      let atendidoEm = "";
      list.forEach((item) => {
        if (item.STATUS === "Atendido" && !atendidoEm) {
          atendidoEm = item.CARIMBO_DATA_HORA;
        }
      });

      const solicitation = {
        id,
        dataInsercao: firstInclusion.CARIMBO_DATA_HORA,
        atendidoEm,
        eventos: list,
        CARIMBO_DATA_HORA: current.CARIMBO_DATA_HORA,
        ID_EVENTO: current.ID_EVENTO,
        TIPO_EVENTO: current.TIPO_EVENTO,
        ID_SOLICITACAO: current.ID_SOLICITACAO,
        ID_PACIENTE: current.ID_PACIENTE,
        NOME_PACIENTE: current.NOME_PACIENTE,
        CPF_FICTICIO: current.CPF_FICTICIO,
        TIPO_ATENDIMENTO: current.TIPO_ATENDIMENTO,
        GRUPO_COMPLEXIDADE: current.GRUPO_COMPLEXIDADE,
        PROCEDIMENTO: current.PROCEDIMENTO,
        PRIORIDADE: current.PRIORIDADE,
        JUSTIFICATIVA: current.JUSTIFICATIVA,
        STATUS: current.STATUS,
        ID_FUNCIONARIO: current.ID_FUNCIONARIO,
        NOME_FUNCIONARIO: current.NOME_FUNCIONARIO,
        CARGO_FUNCIONARIO: current.CARGO_FUNCIONARIO,
      };
      nextSolicitations.push(solicitation);

      const tipo = solicitation.TIPO_ATENDIMENTO;
      const grupo = solicitation.GRUPO_COMPLEXIDADE;
      const procedimento = solicitation.PROCEDIMENTO;
      if (!nextCatalog[tipo]) nextCatalog[tipo] = {};
      if (!nextCatalog[tipo][grupo]) nextCatalog[tipo][grupo] = new Set();
      nextCatalog[tipo][grupo].add(procedimento);

      if (solicitation.ID_FUNCIONARIO) {
        nextEmployees.set(solicitation.ID_FUNCIONARIO.toUpperCase(), {
          id: solicitation.ID_FUNCIONARIO,
          nome: solicitation.NOME_FUNCIONARIO,
          cargo: solicitation.CARGO_FUNCIONARIO,
        });
      }

      const cpfKey = Utils.cpfDigits(solicitation.CPF_FICTICIO);
      if (cpfKey) {
        nextPatients.set(cpfKey, {
          id: solicitation.ID_PACIENTE,
          nome: solicitation.NOME_PACIENTE,
          cpf: solicitation.CPF_FICTICIO,
        });
      }
    });

    Object.keys(nextCatalog).forEach((tipo) => {
      Object.keys(nextCatalog[tipo]).forEach((grupo) => {
        nextCatalog[tipo][grupo] = Array.from(nextCatalog[tipo][grupo]).sort(Utils.comparePt);
      });
    });

    solicitations = nextSolicitations;
    catalog = nextCatalog;
    employees = nextEmployees;
    patientsByCpf = nextPatients;
  }

  function ingest(text) {
    baseEvents = Csv.parse(text).map(normalizeEvent);
    loadOverlay();
    overlayEvents = overlayEvents.map(normalizeEvent);
    rebuild();
    loaded = true;
  }

  function load() {
    if (loaded) return;
    const eventos = typeof window !== "undefined" ? window.__FILAS_EVENTOS__ : null;
    if (Array.isArray(eventos) && eventos.length) {
      baseEvents = eventos.map(normalizeEvent);
      loadOverlay();
      overlayEvents = overlayEvents.map(normalizeEvent);
      rebuild();
      loaded = true;
      return;
    }
    if (typeof window !== "undefined" && window.__FILAS_CSV__) {
      ingest(window.__FILAS_CSV__);
      return;
    }
    throw new Error("Os dados da demonstração não carregaram.");
  }

  function normalizeEvent(event) {
    const record = {};
    COLUMNS.forEach((column) => {
      record[column] = event[column] == null ? "" : String(event[column]).trim();
    });
    return record;
  }

  function stamp() {
    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  }

  function appendEvent(partial) {
    const event = normalizeEvent({
      CARIMBO_DATA_HORA: stamp(),
      ID_EVENTO: nextId("EVT", 6, (item) => item.ID_EVENTO),
      ...partial,
    });
    overlayEvents.push(event);
    saveOverlay();
    rebuild();
    return event;
  }

  function findPatientByCpf(cpf) {
    return patientsByCpf.get(Utils.cpfDigits(cpf)) || null;
  }

  function findEmployee(id) {
    const normalized = String(id || "").trim().toUpperCase();
    if (employees.has(normalized)) return employees.get(normalized);
    const digits = normalized.replace(/\D/g, "");
    if (digits) {
      const padded = pad("FUN", Number(digits), 3);
      if (employees.has(padded)) return employees.get(padded);
    }
    return null;
  }

  function insertSolicitation(payload, employee) {
    const existing = findPatientByCpf(payload.cpf);
    const patientId = existing ? existing.id : nextId("PAC", 5, (item) => item.ID_PACIENTE);
    const patientName = existing ? existing.nome : payload.nome.trim();
    const cpf = existing ? existing.cpf : Utils.formatCpf(payload.cpf);

    return appendEvent({
      TIPO_EVENTO: "INCLUSAO",
      ID_SOLICITACAO: nextId("SOL", 6, (item) => item.ID_SOLICITACAO),
      ID_PACIENTE: patientId,
      NOME_PACIENTE: patientName,
      CPF_FICTICIO: cpf,
      TIPO_ATENDIMENTO: payload.tipo,
      GRUPO_COMPLEXIDADE: payload.grupo,
      PROCEDIMENTO: payload.procedimento,
      PRIORIDADE: payload.prioridade,
      JUSTIFICATIVA: payload.justificativa || "Inclusão registrada pelo funcionário da saúde.",
      STATUS: "Aguardando",
      ID_FUNCIONARIO: employee.id,
      NOME_FUNCIONARIO: employee.nome,
      CARGO_FUNCIONARIO: employee.cargo,
    });
  }

  function updateSolicitation(solId, changes, employee) {
    const current = solicitations.find((item) => item.id === solId);
    if (!current) throw new Error("Solicitação não encontrada.");

    const tipoEvento = changes.PRIORIDADE && changes.PRIORIDADE !== current.PRIORIDADE
      ? "ALTERACAO_PRIORIDADE"
      : "ALTERACAO_STATUS";

    return appendEvent({
      TIPO_EVENTO: tipoEvento,
      ID_SOLICITACAO: current.ID_SOLICITACAO,
      ID_PACIENTE: current.ID_PACIENTE,
      NOME_PACIENTE: current.NOME_PACIENTE,
      CPF_FICTICIO: current.CPF_FICTICIO,
      TIPO_ATENDIMENTO: current.TIPO_ATENDIMENTO,
      GRUPO_COMPLEXIDADE: current.GRUPO_COMPLEXIDADE,
      PROCEDIMENTO: current.PROCEDIMENTO,
      PRIORIDADE: changes.PRIORIDADE || current.PRIORIDADE,
      JUSTIFICATIVA: changes.JUSTIFICATIVA || current.JUSTIFICATIVA,
      STATUS: changes.STATUS || current.STATUS,
      ID_FUNCIONARIO: employee.id,
      NOME_FUNCIONARIO: employee.nome,
      CARGO_FUNCIONARIO: employee.cargo,
    });
  }

  function exportCsv() {
    const records = allEvents()
      .slice()
      .sort((a, b) => a.CARIMBO_DATA_HORA.localeCompare(b.CARIMBO_DATA_HORA));
    return Csv.stringify(records);
  }

  function getSolicitations() {
    return solicitations;
  }

  function getCatalog() {
    return catalog;
  }

  function getEmployees() {
    return employees;
  }

  return {
    load,
    ingest,
    getSolicitations,
    getCatalog,
    getEmployees,
    findPatientByCpf,
    findEmployee,
    insertSolicitation,
    updateSolicitation,
    exportCsv,
  };
})();
