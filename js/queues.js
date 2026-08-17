const Queues = (() => {
  const PRIORIDADE_ORDEM = {
    Emergência: 0,
    Urgência: 1,
    Eletiva: 2,
  };

  const FILA_ATIVA = new Set(["Aguardando", "Agendado"]);
  const PRIORIDADES = ["Emergência", "Urgência", "Eletiva"];
  const HISTORICO = new Set(["Atendido", "Cancelado"]);

  function rankPriority(value) {
    return PRIORIDADE_ORDEM[value] ?? 99;
  }

  function sortQueue(items) {
    return items.slice().sort((a, b) => {
      const byPriority = rankPriority(a.PRIORIDADE) - rankPriority(b.PRIORIDADE);
      if (byPriority !== 0) return byPriority;
      const byAge = a.dataInsercao.localeCompare(b.dataInsercao);
      if (byAge !== 0) return byAge;
      return a.id.localeCompare(b.id);
    });
  }

  function displayName(item, viewerCpf) {
    if (viewerCpf && Utils.cpfDigits(item.CPF_FICTICIO) === Utils.cpfDigits(viewerCpf)) {
      return item.NOME_PACIENTE;
    }
    return Utils.initials(item.NOME_PACIENTE);
  }

  function isOwnRow(item, viewerCpf) {
    return Boolean(viewerCpf) && Utils.cpfDigits(item.CPF_FICTICIO) === Utils.cpfDigits(viewerCpf);
  }

  function byProcedure(procedimento, options = {}) {
    const includeInactive = Boolean(options.includeInactive);
    const items = Store.getSolicitations().filter((item) => item.PROCEDIMENTO === procedimento);
    const active = sortQueue(items.filter((item) => FILA_ATIVA.has(item.STATUS))).map((item, index) => ({
      ...item,
      posicao: index + 1,
    }));
    if (!includeInactive) return active;
    const inactive = sortQueue(items.filter((item) => !FILA_ATIVA.has(item.STATUS))).map((item) => ({
      ...item,
      posicao: "—",
    }));
    return active.concat(inactive);
  }

  function groupActiveByPriority(procedimento) {
    const grouped = {
      Emergência: [],
      Urgência: [],
      Eletiva: [],
    };
    byProcedure(procedimento).forEach((item) => {
      const key = grouped[item.PRIORIDADE] ? item.PRIORIDADE : "Eletiva";
      grouped[key].push(item);
    });
    PRIORIDADES.forEach((priority) => {
      grouped[priority] = grouped[priority].map((item, index) => ({
        ...item,
        ordem: index + 1,
      }));
    });
    return grouped;
  }

  function historyByProcedure(procedimento) {
    return Store.getSolicitations()
      .filter((item) => item.PROCEDIMENTO === procedimento && HISTORICO.has(item.STATUS))
      .slice()
      .sort((a, b) => {
        const stampA = a.encerradoEm || a.atendidoEm || a.CARIMBO_DATA_HORA || "";
        const stampB = b.encerradoEm || b.atendidoEm || b.CARIMBO_DATA_HORA || "";
        const byDate = stampB.localeCompare(stampA);
        if (byDate !== 0) return byDate;
        return String(b.id).localeCompare(String(a.id));
      });
  }

  function monthlySeries(procedimento, months = 6) {
    const now = new Date();
    const series = [];
    for (let i = months - 1; i >= 0; i -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const count = Store.getSolicitations().filter((item) => {
        if (item.PROCEDIMENTO !== procedimento || item.STATUS !== "Atendido" || !item.atendidoEm) {
          return false;
        }
        const date = Utils.parseStamp(item.atendidoEm);
        return date && date >= start && date < end;
      }).length;
      series.push(count);
    }
    return series;
  }

  function kpis(procedimento) {
    const now = new Date();
    const last30 = Utils.daysAgo(30, now);
    const last365 = Utils.daysAgo(365, now);
    const all = Store.getSolicitations().filter((item) => item.PROCEDIMENTO === procedimento);
    const doneLastMonth = all.filter((item) => {
      if (item.STATUS !== "Atendido" || !item.atendidoEm) return false;
      const date = Utils.parseStamp(item.atendidoEm);
      return date && date >= last30 && date <= now;
    }).length;
    const done12 = all.filter((item) => {
      if (item.STATUS !== "Atendido" || !item.atendidoEm) return false;
      const date = Utils.parseStamp(item.atendidoEm);
      return date && date >= last365 && date <= now;
    }).length;
    const mediaMensal = done12 / 12;
    const fila = byProcedure(procedimento);
    return {
      feitosUltimoMes: doneLastMonth,
      mediaMensal,
      naFila: fila.length,
      serie: monthlySeries(procedimento),
    };
  }

  function forecast(position, mediaMensal) {
    if (!mediaMensal) {
      return { label: "Sem ritmo recente de atendimento", date: null, months: null };
    }
    const months = position / mediaMensal;
    const date = Utils.addMonths(new Date(), months);
    const rounded = Math.max(0, months);
    let label;
    if (rounded < 0.5) {
      label = "Previsão: neste mês";
    } else if (rounded < 1.5) {
      label = `Previsão: cerca de ${Math.round(rounded)} mês`;
    } else {
      label = `Previsão: cerca de ${Math.round(rounded)} meses`;
    }
    return { label, date, months: rounded };
  }

  function userQueues(cpf) {
    const digits = Utils.cpfDigits(cpf);
    const mine = Store.getSolicitations().filter((item) => {
      return Utils.cpfDigits(item.CPF_FICTICIO) === digits && FILA_ATIVA.has(item.STATUS);
    });
    const procedures = [...new Set(mine.map((item) => item.PROCEDIMENTO))];
    return procedures.map((procedimento) => {
      const fila = byProcedure(procedimento);
      const own = fila.find((item) => Utils.cpfDigits(item.CPF_FICTICIO) === digits);
      const stats = kpis(procedimento);
      const previsao = own ? forecast(own.posicao, stats.mediaMensal) : forecast(0, stats.mediaMensal);
      return {
        procedimento,
        tipo: own ? own.TIPO_ATENDIMENTO : mine[0].TIPO_ATENDIMENTO,
        grupo: own ? own.GRUPO_COMPLEXIDADE : mine[0].GRUPO_COMPLEXIDADE,
        own,
        fila,
        stats,
        previsao,
      };
    });
  }

  function userHistory(cpf) {
    const digits = Utils.cpfDigits(cpf);
    return Store.getSolicitations()
      .filter((item) => Utils.cpfDigits(item.CPF_FICTICIO) === digits && HISTORICO.has(item.STATUS))
      .slice()
      .sort((a, b) => {
        const stampA = a.encerradoEm || a.atendidoEm || a.CARIMBO_DATA_HORA || "";
        const stampB = b.encerradoEm || b.atendidoEm || b.CARIMBO_DATA_HORA || "";
        const byDate = stampB.localeCompare(stampA);
        if (byDate !== 0) return byDate;
        return String(b.id).localeCompare(String(a.id));
      });
  }

  function countsByType() {
    const catalog = Store.getCatalog();
    const active = Store.getSolicitations().filter((item) => FILA_ATIVA.has(item.STATUS));
    return Object.keys(catalog).sort(Utils.comparePt).map((tipo) => {
      const grupos = Object.keys(catalog[tipo]).sort(Utils.comparePt).map((grupo) => {
        const procedimentos = catalog[tipo][grupo].map((procedimento) => {
          const naFila = active.filter((item) => item.PROCEDIMENTO === procedimento).length;
          return { procedimento, naFila };
        });
        return {
          grupo,
          naFila: procedimentos.reduce((sum, item) => sum + item.naFila, 0),
          procedimentos,
        };
      });
      return {
        tipo,
        naFila: grupos.reduce((sum, item) => sum + item.naFila, 0),
        grupos,
      };
    });
  }

  return {
    FILA_ATIVA,
    PRIORIDADES,
    byProcedure,
    groupActiveByPriority,
    historyByProcedure,
    kpis,
    forecast,
    userQueues,
    userHistory,
    countsByType,
    displayName,
    isOwnRow,
    sortQueue,
  };
})();
