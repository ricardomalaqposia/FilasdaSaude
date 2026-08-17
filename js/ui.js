const Icons = {
  logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h3l2-6 3 12 2-7h6"/><circle cx="18" cy="18" r="3"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>',
  staff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11V7a3 3 0 1 1 6 0v4"/><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M12 15v3"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/></svg>',
  queue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/><path d="M10 18a2 2 0 0 0 4 0"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4M15 12H8m7 0 3-3m-3 3 3 3"/></svg>',
};

const UI = (() => {
  function sparkline(values, color = "#2D46B9") {
    const series = values && values.length ? values : [0, 0, 0, 0];
    const width = 88;
    const height = 28;
    const max = Math.max(...series, 1);
    const points = series.map((value, index) => {
      const x = series.length === 1 ? width / 2 : (index / (series.length - 1)) * (width - 6) + 3;
      const y = height - 4 - (value / max) * (height - 10);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return `<svg class="spark" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points}"/></svg>`;
  }

  function trendHtml(current, previous) {
    if (previous == null || previous === 0 && current === 0) {
      return `<span class="trend-flat">sem variação</span>`;
    }
    if (previous === 0) {
      return `<span class="trend-up">▲ novo volume</span>`;
    }
    const delta = ((current - previous) / previous) * 100;
    const cls = delta > 0 ? "trend-up" : delta < 0 ? "trend-down" : "trend-flat";
    const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "•";
    return `<span class="${cls}">${arrow} ${Math.abs(delta).toFixed(1)}%</span>`;
  }

  function statusBadge(status) {
    const map = {
      Atendido: ["badge-success", "Atendido"],
      Agendado: ["badge-info", "Agendado"],
      Aguardando: ["badge-warn", "Aguardando"],
      Cancelado: ["badge-error", "Cancelado"],
    };
    const [cls, label] = map[status] || ["badge-muted", status || "—"];
    return `<span class="badge ${cls}">${Utils.escapeHtml(label)}</span>`;
  }

  function priorityClass(priority) {
    if (priority === "Emergência") return "priority-emergencia";
    if (priority === "Urgência") return "priority-urgencia";
    return "priority-eletiva";
  }

  function kpiCards(items) {
    return `<section class="kpi-grid">${items.map((item) => `
      <article class="kpi">
        <div class="kpi-top">
          <div class="kpi-icon ${item.tone || "blue"}">${item.icon || Icons.queue}</div>
        </div>
        <div class="kpi-label">${Utils.escapeHtml(item.label)}</div>
        <div class="kpi-value">${Utils.escapeHtml(String(item.value))}</div>
        <div class="kpi-trend">
          ${item.trend || ""}
          ${sparkline(item.serie || [], item.spark || "#2D46B9")}
        </div>
      </article>
    `).join("")}</section>`;
  }

  function creditBar() {
    return `
      <header class="credit-bar">
        <img src="img/logo-junior-malaquias.png" alt="Júnior Malaquias">
        <p>Teste desenvolvido por Júnior Malaquias</p>
      </header>
    `;
  }

  function landing() {
    return `
      <div class="landing">
        <header class="landing-hero">
          <div class="brand-lockup">
            <div class="brand-mark">${Icons.logo}</div>
            <strong>Filas da Saúde</strong>
          </div>
          <h1>Controle das filas de exames, consultas e cirurgias</h1>
          <p class="lead">Esta é uma demonstração. Escolha um perfil abaixo. As filas seguem prioridade (Emergência, Urgência, Eletiva) e, em empate, quem entrou primeiro.</p>
        </header>
        <section class="demo-box">
          <h2>Para testar, use estes dados</h2>
          <p><strong>Usuário:</strong> CPF <code>971.663.735-71</code></p>
          <p><strong>Funcionário:</strong> ID <code>FUN095</code></p>
          <p><strong>Acompanhar filas:</strong> não precisa de senha, é só clicar.</p>
        </section>
        <section class="role-grid">
          <button class="role-card" data-action="go-user">
            <div class="role-icon">${Icons.user}</div>
            <h2>Usuário</h2>
            <p>Informe o CPF para ver as filas em que você está, com o seu nome completo e os demais anonimizados.</p>
            <span class="btn">Entrar como usuário</span>
          </button>
          <button class="role-card" data-action="go-staff">
            <div class="role-icon">${Icons.staff}</div>
            <h2>Funcionário da saúde</h2>
            <p>Consulte todas as filas, inclua novos pedidos e edite prioridade, cancelamento ou realização.</p>
            <span class="btn">Entrar como funcionário</span>
          </button>
          <button class="role-card" data-action="go-public">
            <div class="role-icon">${Icons.eye}</div>
            <h2>Acompanhar filas</h2>
            <p>Visualize todas as filas com nomes em iniciais e a data de inserção, sem identificação completa.</p>
            <span class="btn">Consultar filas</span>
          </button>
        </section>
        <p class="landing-foot">Demonstração com dados simulados. Para abrir de novo, dê um duplo clique em <strong>Abrir o site.bat</strong>.</p>
      </div>
    `;
  }

  function authScreen({ title, lead, hint, error, fieldName, fieldPlaceholder, action, backLabel }) {
    return `
      <div class="auth-wrap">
        <form class="auth-card" data-form="${action}">
          <div class="brand-lockup">
            <div class="brand-mark">${Icons.logo}</div>
            <strong>Filas da Saúde</strong>
          </div>
          <h1>${Utils.escapeHtml(title)}</h1>
          <p>${Utils.escapeHtml(lead)}</p>
          ${error ? `<div class="error-msg">${Utils.escapeHtml(error)}</div>` : ""}
          <label class="field">
            <span>${Utils.escapeHtml(fieldName)}</span>
            <input name="ident" autocomplete="off" placeholder="${Utils.escapeHtml(fieldPlaceholder)}" required>
            <span class="hint">${Utils.escapeHtml(hint)}</span>
          </label>
          <div class="auth-actions">
            <button type="button" class="btn btn-ghost" data-action="go-home">${Utils.escapeHtml(backLabel)}</button>
            <button type="submit" class="btn">Continuar</button>
          </div>
        </form>
      </div>
    `;
  }

  function sidebar(session, active) {
    const role = session.role;
    const items = [
      { id: "dashboard", label: role === "usuario" ? "Minhas filas" : "Painel", icon: Icons.home },
    ];
    if (role !== "usuario") {
      items.push({ id: "filas", label: "Filas por procedimento", icon: Icons.queue });
    }
    if (role === "funcionario") {
      items.push({ id: "insert", label: "Nova inserção", icon: Icons.plus });
      items.push({ id: "export", label: "Exportar CSV", icon: Icons.download });
    }
    items.push({ id: "logout", label: "Sair", icon: Icons.logout });

    const help = role === "funcionario"
      ? { title: "Gestão da fila", text: "Altere prioridade, cancele ou marque o procedimento como realizado.", action: "insert", button: "Nova inserção" }
      : role === "usuario"
        ? { title: "Sua posição", text: "A previsão usa a média mensal de atendimentos dos últimos 12 meses.", action: "dashboard", button: "Ver minhas filas" }
        : { title: "Consulta pública", text: "Os nomes aparecem apenas com iniciais para proteger os pacientes.", action: "filas", button: "Ver filas" };

    return `
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <div class="brand-mark">${Icons.logo}</div>
          <div>
            <strong>Filas da Saúde</strong>
            <span>Regulação de procedimentos</span>
          </div>
        </div>
        <nav class="nav">
          ${items.map((item) => `
            <button class="nav-item ${active === item.id ? "active" : ""}" data-action="nav" data-nav="${item.id}">
              ${item.icon}<span>${item.label}</span>
            </button>
          `).join("")}
        </nav>
        <div class="sidebar-card">
          <h3>${help.title}</h3>
          <p>${help.text}</p>
          <button class="btn" data-action="nav" data-nav="${help.action}">${help.button}</button>
        </div>
      </aside>
    `;
  }

  function topbar(session, searchValue) {
    const roleLabel = {
      usuario: "Usuário",
      funcionario: session.cargo || "Funcionário da saúde",
      consulta: "Consulta pública",
    }[session.role];
    const name = session.nome || "Visitante";
    return `
      <header class="topbar">
        <button class="menu-toggle icon-btn" data-action="toggle-sidebar" aria-label="Abrir menu">${Icons.menu}</button>
        <label class="search">
          ${Icons.search}
          <input id="global-search" value="${Utils.escapeHtml(searchValue || "")}" placeholder="Buscar filas, pacientes ou procedimentos..." data-action="search">
          <span class="kbd">Ctrl + K</span>
        </label>
        <div class="top-meta">
          <div class="date-chip">${Icons.calendar}<span>${Utils.formatLongDate()}</span></div>
          <button class="bell" type="button" aria-label="Notificações">${Icons.bell}<span class="dot"></span></button>
          <div class="profile">
            <div class="avatar">${Utils.escapeHtml(Utils.avatarLetters(name))}</div>
            <div>
              <strong>${Utils.escapeHtml(name)}</strong>
              <span>${Utils.escapeHtml(roleLabel)}</span>
            </div>
          </div>
        </div>
      </header>
    `;
  }

  function crumbs(items) {
    if (!items || !items.length) return "";
    return `<nav class="crumbs">${items.map((item, index) => {
      if (item.action) {
        return `<button data-action="${item.action}" data-tipo="${Utils.escapeHtml(item.tipo || "")}" data-grupo="${Utils.escapeHtml(item.grupo || "")}">${Utils.escapeHtml(item.label)}</button>${index < items.length - 1 ? "<span>/</span>" : ""}`;
      }
      return `<span>${Utils.escapeHtml(item.label)}</span>`;
    }).join("")}</nav>`;
  }

  function table({ columns, rows, page, pageSize, total, empty, footerStart, section }) {
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const start = total ? footerStart : 0;
    const end = total ? Math.min(footerStart + Math.max(rows.length, 1) - 1, total) : 0;
    const pages = [];
    let from = Math.max(1, page - 3);
    const to = Math.min(pageCount, from + 6);
    from = Math.max(1, to - 6);
    for (let i = from; i <= to; i += 1) pages.push(i);
    const sectionAttr = section ? ` data-section="${Utils.escapeHtml(section)}"` : "";

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>${columns.map((col) => `<th>${Utils.escapeHtml(col)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows.length ? rows.join("") : `<tr><td colspan="${columns.length}" class="empty">${Utils.escapeHtml(empty || "Nenhum registro encontrado.")}</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="table-foot">
        <span>Mostrando ${start} a ${end} de ${total}</span>
        <div class="pager">
          ${pages.map((n) => `<button class="${n === page ? "active" : ""}" data-action="page" data-page="${n}"${sectionAttr}>${n}</button>`).join("")}
        </div>
      </div>
    `;
  }

  function modal({ title, body, actions }) {
    return `
      <div class="modal-back" data-action="close-modal">
        <div class="modal" role="dialog" aria-modal="true">
          <h2>${Utils.escapeHtml(title)}</h2>
          ${body}
          <div class="modal-actions">${actions}</div>
        </div>
      </div>
    `;
  }

  function loadError(message) {
    return `
      <div class="load-error">
        <h1>Não foi possível abrir o sistema</h1>
        <p>${Utils.escapeHtml(message)}</p>
        <p>Feche esta janela, volte à pasta do projeto e dê um duplo clique em <strong>Abrir o site.bat</strong>.</p>
        <p>Se preferir, dê um duplo clique no arquivo <code>index.html</code> e abra com o Chrome ou o Edge.</p>
      </div>
    `;
  }

  function choiceCards(items, action) {
    return `<section class="choice-grid">${items.map((item) => `
      <button class="choice-card" data-action="${action}" data-tipo="${Utils.escapeHtml(item.tipo || "")}" data-grupo="${Utils.escapeHtml(item.grupo || "")}" data-procedimento="${Utils.escapeHtml(item.procedimento || "")}">
        <h3>${Utils.escapeHtml(item.title)}</h3>
        <p>${Utils.escapeHtml(item.subtitle)}</p>
      </button>
    `).join("")}</section>`;
  }

  return {
    Icons,
    creditBar,
    sparkline,
    trendHtml,
    statusBadge,
    priorityClass,
    kpiCards,
    landing,
    authScreen,
    sidebar,
    topbar,
    crumbs,
    table,
    modal,
    loadError,
    choiceCards,
  };
})();
