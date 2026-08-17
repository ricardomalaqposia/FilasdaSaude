const App = (() => {
  const SESSION_KEY = "filas_saude_session";
  const PAGE_SIZE = 8;
  const PRIORITY_PANELS = [
    { key: "Emergência", title: "Fila de emergência", tone: "emergencia" },
    { key: "Urgência", title: "Fila de urgência", tone: "urgencia" },
    { key: "Eletiva", title: "Fila eletiva", tone: "eletiva" },
  ];

  function emptyPages() {
    return { Emergência: 1, Urgência: 1, Eletiva: 1, historico: 1, historicoUsuario: 1 };
  }

  const state = {
    ready: false,
    loadError: "",
    screen: "landing",
    session: null,
    nav: "dashboard",
    tipo: "",
    grupo: "",
    procedimento: "",
    page: 1,
    pages: emptyPages(),
    search: "",
    statusFilter: "ativas",
    menuId: "",
    modal: null,
    toast: "",
    formError: "",
    sidebarOpen: false,
    draft: {},
  };

  function saveSession() {
    if (state.session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
    else sessionStorage.removeItem(SESSION_KEY);
  }

  function restoreSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      state.session = raw ? JSON.parse(raw) : null;
      if (state.session) {
        state.screen = "app";
        state.nav = "dashboard";
      }
    } catch (error) {
      state.session = null;
    }
  }

  function resetBrowse() {
    state.tipo = "";
    state.grupo = "";
    state.procedimento = "";
    state.page = 1;
    state.pages = emptyPages();
    state.menuId = "";
    state.modal = null;
  }

  function toast(message) {
    state.toast = message;
    render();
    setTimeout(() => {
      if (state.toast === message) {
        state.toast = "";
        render();
      }
    }, 2400);
  }

  function matchesSearch(item) {
    const query = state.search.trim().toLowerCase();
    if (!query) return true;
    const viewerCpf = state.session?.role === "usuario" ? state.session.cpf : null;
    const visibleName = Queues.displayName(item, viewerCpf).toLowerCase();
    const haystack = [
      visibleName,
      String(item.posicao || item.ordem || ""),
      item.PROCEDIMENTO,
      item.TIPO_ATENDIMENTO,
      item.GRUPO_COMPLEXIDADE,
      item.PRIORIDADE,
      item.prioridadeInicial,
      item.STATUS,
      item.dataInsercao,
      item.prioridadeAlteradaEm,
      item.encerradoEm,
      item.atendidoEm,
      item.id,
    ];
    if (state.session?.role === "funcionario") {
      haystack.push(item.NOME_PACIENTE, item.CPF_FICTICIO, item.ID_PACIENTE);
    }
    return haystack.join(" ").toLowerCase().includes(query);
  }

  function activeQueueItems() {
    if (!state.procedimento) return [];
    const allowed = new Set(["ativas", "Aguardando", "Agendado"]);
    if (!allowed.has(state.statusFilter)) state.statusFilter = "ativas";
    return Queues.byProcedure(state.procedimento).filter((item) => {
      if (state.session?.role === "funcionario" && state.statusFilter !== "ativas") {
        if (item.STATUS !== state.statusFilter) return false;
      }
      return matchesSearch(item);
    });
  }

  function historyQueueItems() {
    if (!state.procedimento) return [];
    return Queues.historyByProcedure(state.procedimento).filter(matchesSearch);
  }

  function pagedSlice(items, section) {
    const total = items.length;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    let page = state.pages[section] || 1;
    if (page > pageCount) {
      page = pageCount;
      state.pages[section] = page;
    }
    const startIndex = (page - 1) * PAGE_SIZE;
    return {
      page,
      total,
      start: total ? startIndex + 1 : 0,
      rows: items.slice(startIndex, startIndex + PAGE_SIZE),
    };
  }

  function renderKpis(stats, extra) {
    const serie = stats.serie || [];
    const last = serie[serie.length - 1] || 0;
    const prev = serie[serie.length - 2] || 0;
    const cards = [
      {
        label: "Feitos no último mês",
        value: stats.feitosUltimoMes,
        tone: "green",
        icon: Icons.calendar,
        serie,
        spark: "#059669",
        trend: UI.trendHtml(last, prev),
      },
      {
        label: "Média mensal (12 meses)",
        value: stats.mediaMensal.toFixed(1).replace(".", ","),
        tone: "blue",
        icon: Icons.queue,
        serie,
        trend: `<span class="trend-flat">atendidos / mês</span>`,
      },
    ];
    extra.forEach((item) => cards.push(item));
    return UI.kpiCards(cards);
  }

  function patientCell(item, staff, viewerCpf) {
    const own = Queues.isOwnRow(item, viewerCpf);
    const name = staff ? item.NOME_PACIENTE : Queues.displayName(item, viewerCpf);
    const you = own ? '<span class="you-chip">você</span>' : "";
    return `${Utils.escapeHtml(name)}${you}`;
  }

  function staffActions(item, staff) {
    if (!staff) return "";
    return `
      <td class="row-actions">
        <button class="icon-btn" data-action="toggle-menu" data-id="${Utils.escapeHtml(item.id)}" aria-label="Ações">${Icons.dots}</button>
        ${state.menuId === item.id ? `
          <div class="menu">
            <button data-action="open-edit" data-id="${Utils.escapeHtml(item.id)}">Editar entrada</button>
            <button data-action="mark-done" data-id="${Utils.escapeHtml(item.id)}">Marcar como realizado</button>
            <button data-action="change-priority" data-id="${Utils.escapeHtml(item.id)}">Mudar prioridade</button>
            <button data-action="cancel-item" data-id="${Utils.escapeHtml(item.id)}">Cancelar</button>
          </div>
        ` : ""}
      </td>
    `;
  }

  function queueToolbar(staff) {
    return `
      <div class="queue-toolbar">
        <div>
          <h2>Filas do procedimento</h2>
          <p>Separadas por prioridade. Dentro de cada lista, vale quem entrou primeiro.</p>
        </div>
        <div class="panel-actions">
          ${staff ? `
            <select class="filter-select" data-action="filter-status">
              <option value="ativas" ${state.statusFilter === "ativas" ? "selected" : ""}>Fila ativa</option>
              <option value="Aguardando" ${state.statusFilter === "Aguardando" ? "selected" : ""}>Aguardando</option>
              <option value="Agendado" ${state.statusFilter === "Agendado" ? "selected" : ""}>Agendado</option>
            </select>
          ` : ""}
          <button class="btn btn-outline btn-sm" data-action="clear-search">Limpar busca</button>
        </div>
      </div>
    `;
  }

  function priorityQueueTable(panel, items, options) {
    const staff = options.staff;
    const viewerCpf = options.viewerCpf;
    const ordered = items.map((item, index) => ({ ...item, ordem: index + 1 }));
    const slice = pagedSlice(ordered, panel.key);
    const columns = staff
      ? ["Ordem", "Paciente", "CPF", "Data de inserção", "Status", ""]
      : ["Ordem", "Paciente", "Data de inserção", "Status"];
    const htmlRows = slice.rows.map((item) => {
      const own = Queues.isOwnRow(item, viewerCpf);
      return `
        <tr class="${own ? "you" : ""}">
          <td>${Utils.escapeHtml(String(item.ordem))}</td>
          <td>${patientCell(item, staff, viewerCpf)}</td>
          ${staff ? `<td>${Utils.escapeHtml(item.CPF_FICTICIO)}</td>` : ""}
          <td>${Utils.escapeHtml(Utils.formatDateTime(item.dataInsercao))}</td>
          <td>${UI.statusBadge(item.STATUS)}</td>
          ${staffActions(item, staff)}
        </tr>
      `;
    });

    return `
      <section class="panel priority-panel priority-panel-${panel.tone}">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">${Utils.escapeHtml(panel.key)}</p>
            <h2>${Utils.escapeHtml(panel.title)}</h2>
          </div>
          <span class="count-chip">${slice.total} ${slice.total === 1 ? "pessoa" : "pessoas"}</span>
        </div>
        ${UI.table({
          columns,
          rows: htmlRows,
          page: slice.page,
          pageSize: PAGE_SIZE,
          total: slice.total,
          footerStart: slice.start,
          section: panel.key,
          empty: `Nenhuma pessoa na fila de ${panel.key.toLowerCase()} com os filtros atuais.`,
        })}
      </section>
    `;
  }

  function priorityChangeLabel(item) {
    const changed = Boolean(item.prioridadeAlteradaEm);
    if (changed && item.prioridadeInicial && item.prioridadeInicial !== item.PRIORIDADE) {
      return `${item.prioridadeInicial} → ${item.PRIORIDADE}`;
    }
    return item.PRIORIDADE || "—";
  }

  function userPositionsPanel(queues) {
    const htmlRows = queues.map((item) => {
      const own = item.own;
      if (!own) return "";
      const selected = item.procedimento === state.procedimento;
      const previsaoData = item.previsao?.date ? Utils.formatDate(item.previsao.date) : "Indisponível";
      return `
        <tr class="${selected ? "you" : ""}">
          <td>
            <button class="table-link" data-action="pick-procedimento" data-tipo="${Utils.escapeHtml(item.tipo)}" data-grupo="${Utils.escapeHtml(item.grupo)}" data-procedimento="${Utils.escapeHtml(item.procedimento)}">${Utils.escapeHtml(item.procedimento)}</button>
            <div class="table-sub">${Utils.escapeHtml(item.tipo)} · ${Utils.escapeHtml(item.grupo)}</div>
          </td>
          <td class="${UI.priorityClass(own.PRIORIDADE)}">${Utils.escapeHtml(own.PRIORIDADE)}</td>
          <td>${Utils.escapeHtml(String(own.posicao))}</td>
          <td>${UI.statusBadge(own.STATUS)}</td>
          <td>
            ${Utils.escapeHtml(previsaoData)}
            <div class="table-sub">${Utils.escapeHtml(item.previsao?.label || "")}</div>
          </td>
        </tr>
      `;
    }).filter(Boolean);

    return `
      <section class="panel">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">Filas ativas</p>
            <h2>Sua posição em cada fila</h2>
            <p class="panel-note">Clique no procedimento para ver a fila completa, separada por prioridade.</p>
          </div>
          <span class="count-chip">${queues.length} ${queues.length === 1 ? "fila" : "filas"}</span>
        </div>
        ${UI.table({
          columns: ["Procedimento", "Prioridade", "Sua posição", "Status", "Previsão"],
          rows: htmlRows,
          page: 1,
          pageSize: Math.max(queues.length, 1),
          total: queues.length,
          footerStart: queues.length ? 1 : 0,
          empty: "Você não está em nenhuma fila ativa no momento.",
        })}
      </section>
    `;
  }

  function userHistoryPanel(items) {
    const slice = pagedSlice(items, "historicoUsuario");
    const htmlRows = slice.rows.map((item) => {
      const changed = Boolean(item.prioridadeAlteradaEm);
      return `
        <tr>
          <td>
            <strong>${Utils.escapeHtml(item.PROCEDIMENTO)}</strong>
            <div class="table-sub">${Utils.escapeHtml(item.TIPO_ATENDIMENTO)} · ${Utils.escapeHtml(item.GRUPO_COMPLEXIDADE)}</div>
          </td>
          <td class="${UI.priorityClass(item.PRIORIDADE)}">${Utils.escapeHtml(priorityChangeLabel(item))}</td>
          <td>${Utils.escapeHtml(Utils.formatDateTime(item.dataInsercao))}</td>
          <td>${changed ? Utils.escapeHtml(Utils.formatDateTime(item.prioridadeAlteradaEm)) : "—"}</td>
          <td>${Utils.escapeHtml(Utils.formatDateTime(item.encerradoEm || item.atendidoEm || item.CARIMBO_DATA_HORA))}</td>
          <td>${UI.statusBadge(item.STATUS)}</td>
        </tr>
      `;
    });

    return `
      <section class="panel history-panel user-history-panel">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">Seus procedimentos</p>
            <h2>Histórico de realizações e cancelamentos</h2>
            <p class="panel-note">Procedimentos seus que já foram realizados ou cancelados, com a prioridade e as datas da inscrição, da alteração (se houve) e do encerramento.</p>
          </div>
          <span class="count-chip">${slice.total} ${slice.total === 1 ? "registro" : "registros"}</span>
        </div>
        ${UI.table({
          columns: ["Procedimento", "Prioridade", "Data de inscrição", "Alteração de prioridade", "Data da realização ou cancelamento", "Status"],
          rows: htmlRows,
          page: slice.page,
          pageSize: PAGE_SIZE,
          total: slice.total,
          footerStart: slice.start,
          section: "historicoUsuario",
          empty: "Você ainda não tem procedimentos realizados ou cancelados nesta demonstração.",
        })}
      </section>
    `;
  }

  function historyTable(items, options) {
    const staff = options.staff;
    const viewerCpf = options.viewerCpf;
    const slice = pagedSlice(items, "historico");
    const columns = staff
      ? ["Paciente", "CPF", "Prioridade", "Data de inscrição", "Alteração de prioridade", "Data da realização ou cancelamento", "Status"]
      : ["Paciente", "Prioridade", "Data de inscrição", "Alteração de prioridade", "Data da realização ou cancelamento", "Status"];
    const htmlRows = slice.rows.map((item) => {
      const own = Queues.isOwnRow(item, viewerCpf);
      const changed = Boolean(item.prioridadeAlteradaEm);
      const priorityLabel = changed && item.prioridadeInicial && item.prioridadeInicial !== item.PRIORIDADE
        ? `${item.prioridadeInicial} → ${item.PRIORIDADE}`
        : item.PRIORIDADE;
      return `
        <tr class="${own ? "you" : ""}">
          <td>${patientCell(item, staff, viewerCpf)}</td>
          ${staff ? `<td>${Utils.escapeHtml(item.CPF_FICTICIO)}</td>` : ""}
          <td class="${UI.priorityClass(item.PRIORIDADE)}">${Utils.escapeHtml(priorityLabel)}</td>
          <td>${Utils.escapeHtml(Utils.formatDateTime(item.dataInsercao))}</td>
          <td>${changed ? Utils.escapeHtml(Utils.formatDateTime(item.prioridadeAlteradaEm)) : "—"}</td>
          <td>${Utils.escapeHtml(Utils.formatDateTime(item.encerradoEm || item.atendidoEm || item.CARIMBO_DATA_HORA))}</td>
          <td>${UI.statusBadge(item.STATUS)}</td>
        </tr>
      `;
    });

    return `
      <section class="panel history-panel">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">Encerrados</p>
            <h2>Histórico de realizações e cancelamentos</h2>
            <p class="panel-note">Registros já realizados ou cancelados neste procedimento, com a prioridade e as datas da inscrição, da alteração (se houve) e do encerramento.</p>
          </div>
          <span class="count-chip">${slice.total} ${slice.total === 1 ? "registro" : "registros"}</span>
        </div>
        ${UI.table({
          columns,
          rows: htmlRows,
          page: slice.page,
          pageSize: PAGE_SIZE,
          total: slice.total,
          footerStart: slice.start,
          section: "historico",
          empty: "Ainda não há realizações ou cancelamentos neste procedimento.",
        })}
      </section>
    `;
  }

  function renderQueueView() {
    const stats = Queues.kpis(state.procedimento);
    const staff = state.session.role === "funcionario";
    const viewerCpf = state.session.role === "usuario" ? state.session.cpf : null;
    const grouped = { Emergência: [], Urgência: [], Eletiva: [] };
    activeQueueItems().forEach((item) => {
      const key = grouped[item.PRIORIDADE] ? item.PRIORIDADE : "Eletiva";
      grouped[key].push(item);
    });
    const historyItems = historyQueueItems();
    const own = viewerCpf
      ? Queues.byProcedure(state.procedimento).find((item) => Queues.isOwnRow(item, viewerCpf))
      : null;
    const previsao = own ? Queues.forecast(own.posicao, stats.mediaMensal) : Queues.forecast(stats.naFila, stats.mediaMensal);
    const extra = [];
    if (own) {
      extra.push({
        label: "Sua posição na fila",
        value: own.posicao,
        tone: "orange",
        icon: Icons.user,
        serie: stats.serie,
        trend: `<span class="trend-flat">${Utils.escapeHtml(own.PRIORIDADE)}</span>`,
      });
      extra.push({
        label: "Previsão de realização",
        value: previsao.date ? Utils.formatDate(previsao.date) : "Indisponível",
        tone: "teal",
        icon: Icons.calendar,
        serie: stats.serie,
        spark: "#0f766e",
        trend: `<span class="trend-flat">${Utils.escapeHtml(previsao.label)}</span>`,
      });
    } else {
      extra.push({
        label: "Pessoas na fila",
        value: stats.naFila,
        tone: "orange",
        icon: Icons.user,
        serie: stats.serie,
        trend: `<span class="trend-flat">aguardando ou agendados</span>`,
      });
      extra.push({
        label: "Estimativa para o último da fila",
        value: previsao.date ? Utils.formatDate(previsao.date) : "Indisponível",
        tone: "teal",
        icon: Icons.calendar,
        serie: stats.serie,
        spark: "#0f766e",
        trend: `<span class="trend-flat">${Utils.escapeHtml(previsao.label)}</span>`,
      });
    }

    const crumbs = state.session.role === "usuario" ? "" : UI.crumbs([
      { label: "Filas", action: "crumb-root" },
      { label: state.tipo, action: "crumb-tipo", tipo: state.tipo },
      { label: state.grupo, action: "crumb-grupo", tipo: state.tipo, grupo: state.grupo },
      { label: state.procedimento },
    ]);
    const queueHeading = state.session.role === "usuario"
      ? `
        <div class="queue-toolbar">
          <div>
            <h2>${Utils.escapeHtml(state.procedimento)}</h2>
            <p>${Utils.escapeHtml(state.tipo)} · ${Utils.escapeHtml(state.grupo)} · fila completa para conferir a sua posição</p>
          </div>
        </div>
      `
      : `
        <div class="page-head">
          <div>
            <h1>${Utils.escapeHtml(state.procedimento)}</h1>
            <p>${Utils.escapeHtml(state.tipo)} · ${Utils.escapeHtml(state.grupo)} · filas por prioridade, depois pela data de inserção</p>
          </div>
        </div>
      `;

    return `
      ${crumbs}
      ${queueHeading}
      ${renderKpis(stats, extra)}
      ${queueToolbar(staff)}
      <div class="queue-stack">
        ${PRIORITY_PANELS.map((panel) => priorityQueueTable(panel, grouped[panel.key], { staff, viewerCpf })).join("")}
      </div>
      ${state.session.role === "usuario" ? "" : historyTable(historyItems, { staff, viewerCpf })}
    `;
  }

  function renderBrowse() {
    const tree = Queues.countsByType();
    if (!state.tipo) {
      return `
        <div class="page-head">
          <div>
            <h1>Filas por procedimento</h1>
            <p>Escolha o tipo de atendimento para abrir a fila correspondente.</p>
          </div>
        </div>
        ${UI.choiceCards(tree.map((item) => ({
          tipo: item.tipo,
          title: item.tipo,
          subtitle: `${item.naFila} pessoas na fila ativa · ${item.grupos.length} grupos`,
        })), "pick-tipo")}
      `;
    }

    const tipoNode = tree.find((item) => item.tipo === state.tipo);
    if (!tipoNode) return `<p class="empty">Tipo não encontrado.</p>`;

    if (!state.grupo) {
      return `
        ${UI.crumbs([{ label: "Filas", action: "crumb-root" }, { label: state.tipo }])}
        <div class="page-head">
          <div>
            <h1>${Utils.escapeHtml(state.tipo)}</h1>
            <p>Selecione o grupo de complexidade ou especialidade.</p>
          </div>
        </div>
        ${UI.choiceCards(tipoNode.grupos.map((item) => ({
          tipo: state.tipo,
          grupo: item.grupo,
          title: item.grupo,
          subtitle: `${item.naFila} na fila · ${item.procedimentos.length} procedimentos`,
        })), "pick-grupo")}
      `;
    }

    const grupoNode = tipoNode.grupos.find((item) => item.grupo === state.grupo);
    if (!grupoNode) return `<p class="empty">Grupo não encontrado.</p>`;

    if (!state.procedimento) {
      const query = state.search.trim().toLowerCase();
      const procedimentos = grupoNode.procedimentos.filter((item) => {
        return !query || item.procedimento.toLowerCase().includes(query);
      });
      return `
        ${UI.crumbs([
          { label: "Filas", action: "crumb-root" },
          { label: state.tipo, action: "crumb-tipo", tipo: state.tipo },
          { label: state.grupo },
        ])}
        <div class="page-head">
          <div>
            <h1>${Utils.escapeHtml(state.grupo)}</h1>
            <p>Abra a fila específica do procedimento.</p>
          </div>
        </div>
        ${UI.choiceCards(procedimentos.map((item) => ({
          tipo: state.tipo,
          grupo: state.grupo,
          procedimento: item.procedimento,
          title: item.procedimento,
          subtitle: `${item.naFila} pessoas na fila ativa`,
        })), "pick-procedimento")}
      `;
    }

    return renderQueueView();
  }

  function renderUserHome() {
    const queues = Queues.userQueues(state.session.cpf);
    const history = Queues.userHistory(state.session.cpf).filter(matchesSearch);
    const query = state.search.trim().toLowerCase();
    const visibleQueues = query
      ? queues.filter((item) => {
        const own = item.own || {};
        const haystack = [
          item.procedimento,
          item.tipo,
          item.grupo,
          own.PRIORIDADE,
          own.STATUS,
          String(own.posicao || ""),
        ].join(" ").toLowerCase();
        return haystack.includes(query);
      })
      : queues;

    if (!queues.length && !history.length) {
      return `
        <div class="page-head">
          <div>
            <h1>Minhas filas</h1>
            <p>Não há solicitações ativas nem histórico para o CPF informado.</p>
          </div>
        </div>
        <div class="panel"><p class="empty">Nenhuma fila encontrada para ${Utils.escapeHtml(state.session.nome)}.</p></div>
      `;
    }

    if (queues.length) {
      if (state.procedimento && !queues.some((item) => item.procedimento === state.procedimento)) {
        state.procedimento = "";
      }
    } else {
      state.procedimento = "";
    }

    const showQueue = queues.some((item) => item.procedimento === state.procedimento);

    return `
      <div class="page-head">
        <div>
          <h1>Minhas filas</h1>
          <p>Olá, ${Utils.escapeHtml(state.session.nome)}. Primeiro veja a sua posição em cada fila; em seguida, o histórico dos procedimentos já realizados ou cancelados.</p>
        </div>
      </div>
      ${userPositionsPanel(visibleQueues)}
      ${showQueue ? renderQueueView() : ""}
      ${userHistoryPanel(history)}
    `;
  }

  function renderStaffHome() {
    const tree = Queues.countsByType();
    const totalFila = tree.reduce((sum, item) => sum + item.naFila, 0);
    const totalSol = Store.getSolicitations().length;
    const atendidos = Store.getSolicitations().filter((item) => item.STATUS === "Atendido").length;
    return `
      <div class="page-head">
        <div>
          <h1>Painel</h1>
          <p>Selecione o tipo de procedimento para consultar a fila ou incluir um novo pedido.</p>
        </div>
        <button class="btn" data-action="nav" data-nav="insert">Nova inserção</button>
      </div>
      ${UI.kpiCards([
        { label: "Solicitações", value: totalSol, tone: "blue", icon: Icons.queue, serie: [2, 3, 4, 5, 4, 6] },
        { label: "Na fila ativa", value: totalFila, tone: "orange", icon: Icons.user, serie: [5, 5, 6, 7, 6, 8] },
        { label: "Já atendidas", value: atendidos, tone: "green", icon: Icons.calendar, serie: [1, 2, 2, 3, 4, 4] },
        { label: "Procedimentos", value: tree.reduce((sum, item) => sum + item.grupos.reduce((acc, group) => acc + group.procedimentos.length, 0), 0), tone: "teal", icon: Icons.plus, serie: [3, 3, 3, 3, 3, 3] },
      ])}
      ${UI.choiceCards(tree.map((item) => ({
        tipo: item.tipo,
        title: item.tipo,
        subtitle: `${item.naFila} na fila ativa · ${item.grupos.length} grupos`,
      })), "pick-tipo")}
    `;
  }

  function renderInsert() {
    const catalog = Store.getCatalog();
    const tipos = Object.keys(catalog).sort(Utils.comparePt);
    const tipo = state.tipo && catalog[state.tipo] ? state.tipo : tipos[0];
    const grupos = Object.keys(catalog[tipo] || {}).sort(Utils.comparePt);
    const grupo = state.grupo && catalog[tipo]?.[state.grupo] ? state.grupo : grupos[0];
    const procedimentos = (catalog[tipo]?.[grupo] || []);
    const procedimento = procedimentos.includes(state.procedimento) ? state.procedimento : procedimentos[0] || "";
    state.tipo = tipo;
    state.grupo = grupo;
    state.procedimento = procedimento;
    const draft = state.draft || {};

    return `
      <div class="page-head">
        <div>
          <h1>Nova inserção</h1>
          <p>Inclui o paciente na fila do procedimento, com status Aguardando.</p>
        </div>
      </div>
      <section class="panel">
        <form class="panel-body" data-form="insert">
          ${state.formError ? `<div class="error-msg">${Utils.escapeHtml(state.formError)}</div>` : ""}
          <div class="form-grid">
            <label class="field">
              <span>CPF do paciente</span>
              <input name="cpf" required placeholder="000.000.000-00" data-action="lookup-cpf" value="${Utils.escapeHtml(draft.cpf || "")}">
            </label>
            <label class="field">
              <span>Nome completo</span>
              <input name="nome" required placeholder="Nome do paciente" value="${Utils.escapeHtml(draft.nome || "")}">
            </label>
            <label class="field">
              <span>Tipo de atendimento</span>
              <select name="tipo" data-action="insert-tipo">
                ${tipos.map((item) => `<option ${item === tipo ? "selected" : ""}>${Utils.escapeHtml(item)}</option>`).join("")}
              </select>
            </label>
            <label class="field">
              <span>Grupo</span>
              <select name="grupo" data-action="insert-grupo">
                ${grupos.map((item) => `<option ${item === grupo ? "selected" : ""}>${Utils.escapeHtml(item)}</option>`).join("")}
              </select>
            </label>
            <label class="field">
              <span>Procedimento</span>
              <select name="procedimento">
                ${procedimentos.map((item) => `<option ${item === procedimento ? "selected" : ""}>${Utils.escapeHtml(item)}</option>`).join("")}
              </select>
            </label>
            <label class="field">
              <span>Prioridade</span>
              <select name="prioridade">
                ${["Eletiva", "Urgência", "Emergência"].map((item) => `<option ${item === (draft.prioridade || "Eletiva") ? "selected" : ""}>${item}</option>`).join("")}
              </select>
            </label>
            <label class="field full">
              <span>Justificativa</span>
              <textarea name="justificativa" placeholder="Motivo clínico da inclusão na fila">${Utils.escapeHtml(draft.justificativa || "Solicitação registrada pela unidade de saúde.")}</textarea>
            </label>
          </div>
          <div class="auth-actions">
            <button type="button" class="btn btn-ghost" data-action="nav" data-nav="dashboard">Cancelar</button>
            <button type="submit" class="btn">Inserir na fila</button>
          </div>
        </form>
      </section>
    `;
  }

  function renderModal() {
    if (!state.modal) return "";
    const item = Store.getSolicitations().find((row) => row.id === state.modal.id);
    if (!item) return "";
    if (state.modal.type === "priority") {
      return UI.modal({
        title: "Mudar prioridade",
        body: `
          <p>${Utils.escapeHtml(item.NOME_PACIENTE)} · ${Utils.escapeHtml(item.PROCEDIMENTO)}</p>
          <label class="field">
            <span>Nova prioridade</span>
            <select id="modal-priority">
              ${["Emergência", "Urgência", "Eletiva"].map((value) => `<option ${value === item.PRIORIDADE ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </label>
        `,
        actions: `
          <button class="btn btn-ghost" data-action="close-modal">Fechar</button>
          <button class="btn" data-action="save-priority" data-id="${Utils.escapeHtml(item.id)}">Salvar</button>
        `,
      });
    }
    return UI.modal({
      title: "Editar entrada",
      body: `
        <p><strong>${Utils.escapeHtml(item.NOME_PACIENTE)}</strong> · ${Utils.escapeHtml(item.CPF_FICTICIO)}</p>
        <p>${Utils.escapeHtml(item.PROCEDIMENTO)} · ${Utils.escapeHtml(item.PRIORIDADE)} · posição ${Utils.escapeHtml(String(
          Queues.byProcedure(item.PROCEDIMENTO).find((row) => row.id === item.id)?.posicao || "—"
        ))}</p>
        <p>Status atual: ${UI.statusBadge(item.STATUS)}</p>
      `,
      actions: `
        <button class="btn btn-ghost" data-action="close-modal">Fechar</button>
        <button class="btn btn-outline" data-action="change-priority" data-id="${Utils.escapeHtml(item.id)}">Prioridade</button>
        <button class="btn" data-action="mark-done" data-id="${Utils.escapeHtml(item.id)}">Realizado</button>
        <button class="btn btn-danger" data-action="cancel-item" data-id="${Utils.escapeHtml(item.id)}">Cancelar</button>
      `,
    });
  }

  function pageTitle() {
    if (state.session.role === "usuario") return "Minhas filas";
    if (state.nav === "insert") return "Nova inserção";
    if (state.procedimento) return state.procedimento;
    return "Painel";
  }

  function renderApp() {
    const activeNav = state.nav === "insert" ? "insert" : (state.tipo || state.procedimento ? "filas" : "dashboard");
    let body;
    if (state.session.role === "usuario") body = renderUserHome();
    else if (state.nav === "insert") body = renderInsert();
    else if (state.nav === "filas" || state.tipo) body = renderBrowse();
    else body = state.session.role === "funcionario" ? renderStaffHome() : renderBrowse();

    return `
      <div class="shell">
        ${UI.sidebar(state.session, activeNav)}
        <div class="main">
          ${UI.topbar(state.session, state.search)}
          <div class="content" data-title="${Utils.escapeHtml(pageTitle())}">${body}</div>
        </div>
      </div>
      ${renderModal()}
    `;
  }

  function render() {
    const root = document.getElementById("app");
    if (!root) return;
    let restore = null;
    try {
      const active = document.activeElement;
      if (active && root.contains(active)) {
        restore = {
          id: active.id,
          name: active.getAttribute("name"),
          start: typeof active.selectionStart === "number" ? active.selectionStart : null,
          end: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
        };
      }
    } catch (error) {
      restore = null;
    }
    if (!state.ready && !state.loadError) {
      root.innerHTML = UI.creditBar() + `<div class="boot-screen"><div class="boot-mark"></div><p>Abrindo o sistema…</p></div>`;
      return;
    }
    if (state.loadError) {
      root.innerHTML = UI.creditBar() + UI.loadError(state.loadError);
      return;
    }
    if (state.screen === "landing") root.innerHTML = UI.creditBar() + UI.landing();
    else if (state.screen === "login-user") {
      root.innerHTML = UI.creditBar() + UI.authScreen({
        title: "Acesso do usuário",
        lead: "Informe o CPF cadastrado para ver as filas em que você está.",
        hint: "Exemplo: 971.663.735-71",
        error: state.formError,
        fieldName: "CPF",
        fieldPlaceholder: "000.000.000-00",
        action: "login-user",
        backLabel: "Voltar",
      });
    } else if (state.screen === "login-staff") {
      root.innerHTML = UI.creditBar() + UI.authScreen({
        title: "Acesso do funcionário",
        lead: "Informe o identificador do funcionário para abrir o painel completo.",
        hint: "Exemplo: FUN095",
        error: state.formError,
        fieldName: "ID do funcionário",
        fieldPlaceholder: "FUN095",
        action: "login-staff",
        backLabel: "Voltar",
      });
    } else {
      root.innerHTML = UI.creditBar() + renderApp();
      if (state.sidebarOpen) document.getElementById("sidebar")?.classList.add("open");
    }
    if (state.toast) {
      const toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.textContent = state.toast;
      root.appendChild(toastEl);
    }
    if (restore) {
      const el = (restore.id && document.getElementById(restore.id))
        || (restore.name && document.querySelector(`[name="${restore.name}"]`));
      if (el && typeof el.focus === "function") {
        el.focus();
        if (restore.start != null && typeof el.setSelectionRange === "function") {
          try { el.setSelectionRange(restore.start, restore.end); } catch (error) { /* ignore */ }
        }
      }
    }
  }

  function loginUser(cpf) {
    const patient = Store.findPatientByCpf(cpf);
    if (!patient) {
      state.formError = "CPF não encontrado na base de filas.";
      render();
      return;
    }
    state.session = {
      role: "usuario",
      cpf: patient.cpf,
      nome: patient.nome,
      idPaciente: patient.id,
    };
    saveSession();
    state.screen = "app";
    state.nav = "dashboard";
    state.formError = "";
    resetBrowse();
    render();
  }

  function loginStaff(id) {
    const employee = Store.findEmployee(id);
    if (!employee) {
      state.formError = "Funcionário não encontrado. Use um ID como FUN095.";
      render();
      return;
    }
    state.session = {
      role: "funcionario",
      id: employee.id,
      nome: employee.nome,
      cargo: employee.cargo,
    };
    saveSession();
    state.screen = "app";
    state.nav = "dashboard";
    state.formError = "";
    resetBrowse();
    render();
  }

  function enterPublic() {
    state.session = { role: "consulta", nome: "Consulta pública" };
    saveSession();
    state.screen = "app";
    state.nav = "filas";
    resetBrowse();
    render();
  }

  function mutate(id, changes, message) {
    Store.updateSolicitation(id, changes, {
      id: state.session.id,
      nome: state.session.nome,
      cargo: state.session.cargo,
    });
    state.modal = null;
    state.menuId = "";
    toast(message);
  }

  function onClick(event) {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) {
      if (!event.target.closest(".menu")) {
        if (state.menuId) {
          state.menuId = "";
          render();
        }
      }
      return;
    }
    const action = actionEl.getAttribute("data-action");
    const id = actionEl.getAttribute("data-id") || "";

    if (action === "close-modal" && event.target !== actionEl && !actionEl.matches("button")) return;

    const actions = {
      "go-user": () => { state.screen = "login-user"; state.formError = ""; },
      "go-staff": () => { state.screen = "login-staff"; state.formError = ""; },
      "go-public": () => enterPublic(),
      "go-home": () => { state.session = null; saveSession(); state.screen = "landing"; resetBrowse(); },
      "toggle-sidebar": () => { state.sidebarOpen = !state.sidebarOpen; },
      "clear-search": () => { state.search = ""; state.page = 1; state.pages = emptyPages(); },
      "crumb-root": () => { resetBrowse(); state.nav = "filas"; },
      "close-modal": () => { state.modal = null; },
    };

    if (actions[action]) {
      event.preventDefault();
      actions[action]();
      if (action !== "go-public") render();
      return;
    }

    if (action === "nav") {
      const nav = actionEl.getAttribute("data-nav");
      if (nav === "logout") {
        state.session = null;
        saveSession();
        state.screen = "landing";
        resetBrowse();
      } else if (nav === "export") {
        exportCsv();
        return;
      } else {
        state.nav = nav;
        state.sidebarOpen = false;
        state.page = 1;
        state.pages = emptyPages();
        if (nav === "dashboard") resetBrowse();
        if (nav === "filas") { state.tipo = ""; state.grupo = ""; state.procedimento = ""; }
        if (nav === "insert") { state.formError = ""; }
      }
      render();
      return;
    }

    if (action === "pick-tipo") {
      state.nav = "filas";
      state.tipo = actionEl.getAttribute("data-tipo");
      state.grupo = "";
      state.procedimento = "";
      state.page = 1;
      state.pages = emptyPages();
      render();
      return;
    }
    if (action === "pick-grupo") {
      state.tipo = actionEl.getAttribute("data-tipo") || state.tipo;
      state.grupo = actionEl.getAttribute("data-grupo");
      state.procedimento = "";
      state.page = 1;
      state.pages = emptyPages();
      render();
      return;
    }
    if (action === "pick-procedimento") {
      state.tipo = actionEl.getAttribute("data-tipo") || state.tipo;
      state.grupo = actionEl.getAttribute("data-grupo") || state.grupo;
      state.procedimento = actionEl.getAttribute("data-procedimento");
      state.page = 1;
      state.pages = emptyPages();
      render();
      return;
    }
    if (action === "crumb-tipo") {
      state.tipo = actionEl.getAttribute("data-tipo");
      state.grupo = "";
      state.procedimento = "";
      state.page = 1;
      state.pages = emptyPages();
      render();
      return;
    }
    if (action === "crumb-grupo") {
      state.tipo = actionEl.getAttribute("data-tipo");
      state.grupo = actionEl.getAttribute("data-grupo");
      state.procedimento = "";
      state.page = 1;
      state.pages = emptyPages();
      render();
      return;
    }
    if (action === "page") {
      const section = actionEl.getAttribute("data-section") || "";
      const page = Number(actionEl.getAttribute("data-page")) || 1;
      if (section && Object.prototype.hasOwnProperty.call(state.pages, section)) {
        state.pages[section] = page;
      } else {
        state.page = page;
      }
      state.menuId = "";
      render();
      return;
    }
    if (action === "toggle-menu") {
      state.menuId = state.menuId === id ? "" : id;
      render();
      return;
    }
    if (action === "open-edit") {
      state.modal = { type: "edit", id };
      state.menuId = "";
      render();
      return;
    }
    if (action === "change-priority") {
      state.modal = { type: "priority", id };
      state.menuId = "";
      render();
      return;
    }
    if (action === "mark-done") {
      mutate(id, { STATUS: "Atendido", JUSTIFICATIVA: "Procedimento marcado como realizado." }, "Procedimento marcado como realizado.");
      return;
    }
    if (action === "cancel-item") {
      mutate(id, { STATUS: "Cancelado", JUSTIFICATIVA: "Solicitação cancelada pelo funcionário." }, "Solicitação cancelada.");
      return;
    }
    if (action === "save-priority") {
      const select = document.getElementById("modal-priority");
      const priority = select ? select.value : "Eletiva";
      mutate(id, { PRIORIDADE: priority, JUSTIFICATIVA: `Prioridade alterada para ${priority}.` }, "Prioridade atualizada.");
    }
  }

  function onChange(event) {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.getAttribute("data-action");
    if (action === "filter-status") {
      state.statusFilter = actionEl.value;
      state.page = 1;
      state.pages = emptyPages();
      render();
    }
    if (action === "insert-tipo" || action === "insert-grupo") {
      const form = actionEl.closest("form");
      if (form) {
        const data = new FormData(form);
        state.draft = {
          cpf: String(data.get("cpf") || ""),
          nome: String(data.get("nome") || ""),
          prioridade: String(data.get("prioridade") || "Eletiva"),
          justificativa: String(data.get("justificativa") || ""),
        };
      }
      if (action === "insert-tipo") {
        state.tipo = actionEl.value;
        state.grupo = "";
        state.procedimento = "";
      } else {
        state.grupo = actionEl.value;
        state.procedimento = "";
      }
      render();
    }
    if (action === "lookup-cpf") {
      const patient = Store.findPatientByCpf(actionEl.value);
      const form = actionEl.closest("form");
      const nameInput = form?.querySelector('[name="nome"]');
      if (patient && nameInput) {
        nameInput.value = patient.nome;
      }
    }
    if (action === "pick-csv" && actionEl.files && actionEl.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          Store.ingest(String(reader.result || ""));
          state.loadError = "";
          state.ready = true;
          restoreSession();
          render();
        } catch (error) {
          state.loadError = "O arquivo selecionado não pôde ser lido.";
          render();
        }
      };
      reader.readAsText(actionEl.files[0], "utf-8");
    }
  }

  function onInput(event) {
    if (event.target.id === "global-search") {
      state.search = event.target.value;
      state.page = 1;
      state.pages = emptyPages();
      window.clearTimeout(onInput._t);
      onInput._t = window.setTimeout(() => render(), 180);
    }
  }

  function onSubmit(event) {
    const form = event.target.closest("form");
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    if (form.getAttribute("data-form") === "login-user") {
      loginUser(String(data.get("ident") || ""));
      return;
    }
    if (form.getAttribute("data-form") === "login-staff") {
      loginStaff(String(data.get("ident") || ""));
      return;
    }
    if (form.getAttribute("data-form") === "insert") {
      try {
        const payload = {
          cpf: String(data.get("cpf") || ""),
          nome: String(data.get("nome") || ""),
          tipo: String(data.get("tipo") || ""),
          grupo: String(data.get("grupo") || ""),
          procedimento: String(data.get("procedimento") || ""),
          prioridade: String(data.get("prioridade") || "Eletiva"),
          justificativa: String(data.get("justificativa") || ""),
        };
        if (Utils.cpfDigits(payload.cpf).length !== 11) {
          state.formError = "Informe um CPF com 11 dígitos.";
          render();
          return;
        }
        Store.insertSolicitation(payload, {
          id: state.session.id,
          nome: state.session.nome,
          cargo: state.session.cargo,
        });
        state.formError = "";
        state.draft = {};
        state.nav = "filas";
        state.tipo = payload.tipo;
        state.grupo = payload.grupo;
        state.procedimento = payload.procedimento;
        state.page = 1;
        state.pages = emptyPages();
        toast("Paciente inserido na fila.");
      } catch (error) {
        state.formError = error.message || "Não foi possível inserir o paciente.";
        render();
      }
    }
  }

  function exportCsv() {
    const blob = new Blob(["\uFEFF" + Store.exportCsv()], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "filas_saude_atualizado.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    toast("CSV exportado.");
  }

  function start() {
    try {
      restoreSession();
      Store.load();
      state.ready = true;
      state.loadError = "";
      render();
    } catch (error) {
      console.error(error);
      state.loadError = error && error.message
        ? error.message
        : "Os dados da demonstração não carregaram. Feche o navegador e abra de novo pelo arquivo Abrir o site.bat.";
      try {
        render();
      } catch (renderError) {
        const root = document.getElementById("app");
        if (root) root.textContent = state.loadError;
      }
    }
  }

  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
  document.addEventListener("input", onInput);
  document.addEventListener("submit", onSubmit);
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.getElementById("global-search")?.focus();
    }
    if (event.key === "Escape") {
      if (state.modal) {
        state.modal = null;
        render();
      } else if (state.menuId) {
        state.menuId = "";
        render();
      }
    }
  });

  return { start };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => App.start());
} else {
  App.start();
}
