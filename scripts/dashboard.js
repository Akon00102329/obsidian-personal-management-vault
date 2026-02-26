try {
  let { account, savings, cash, savings_goal, track_gym } = input;

  console.log({
    card: typeof account !== "number",
    s_goal: typeof savings_goal !== "number",
    savings: typeof savings !== "number",
    cash: typeof cash !== "number",
  });
  if (
    typeof account !== "number" ||
    typeof savings_goal !== "number" ||
    typeof savings !== "number" ||
    typeof cash !== "number"
  ) {
    dv.span(
      ">[!ERROR] ERROR: debe ser un número\n> las variables `account, cash, savings, savings_goal` deben ser números",
    );
    return false;
  }
  /* ========== apartado CONFIG ========== */
  const CONFIG = {
    INITIAL_MONEY: account ? account : 0,
    INITIAL_CASH: cash ? cash : 0,
    INITIAL_SAVINGS: savings ? savings : 0,
    SAVINGS_GOAL: savings_goal,
    TRACK_GYM: track_gym ? track_gym : false,
    WEEKDAYS: ["lun", "mar", "mie", "jue", "vie", "sab", "dom"],
    PROJECTS_PAGE_SIZE: 3,
  };

  const DateTime = dv.luxon.DateTime;
  let state = {
    scope: "week",
    ref: DateTime.now(),
  };
  /* ========== CARGAR CSS ========== */
  async function loadExternalCSS(path) {
    try {
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) return;
      const text = await app.vault.read(file);
      const s = document.createElement("style");
      s.textContent = text;
      document.head.appendChild(s);
    } catch (e) {
      // no fallar si no existe
    }
  }
  await loadExternalCSS("scripts/dashboard.css");
  /* ========== Chart.js LOAD ========== */
  async function loadChartJS() {
    if (window.Chart) return;
    await new Promise((res) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js";
      s.onload = res;
      document.head.appendChild(s);
    });
  }
  await loadChartJS();

  /* ========== apartado UTILS ========== */
  async function checkpoint(refMonth) {
    let checkpoints = {};
    const checkpointPath = "scripts/checkpoints.json";
    const file = app.vault.getAbstractFileByPath(checkpointPath);
    if (checkpoints) {
      if (file) {
        const content = await app.vault.read(file);
        checkpoints = JSON.parse(content);
      }
    }

    return checkpoints[refMonth];
  }
  const handlers = {
    ahorro: (raw, category) => ({
      card: raw >= 0 ? -raw : Math.abs(raw),
      savings: raw >= 0 ? raw : -Math.abs(raw),
      cash: 0,
      cat: category,
      type: "ahorro",
    }),
    reintegro: (raw, category) => ({
      card: raw >= 0 ? raw : -Math.abs(raw),
      savings: 0,
      cash: raw >= 0 ? -raw : Math.abs(raw),
      cat: category,
      type: "reintegro",
    }),
    efectivo: (raw, category) => ({
      card: 0,
      savings: 0,
      cash: raw,
      cat: category,
      type: "efectivo",
    }),
    deuda: (raw, category, completed, item, finance) => {
      if (!completed) {
        if (raw >= 0) finance.debts.cobrar.push(item);
        else finance.debts.pagar.push(item);
        return null; // omite la fila
      }
      return {
        card: raw,
        savings: 0,
        cash: 0,
        cat: category,
        type: "deuda",
      };
    },
    default: (raw, category) => ({
      card: raw,
      savings: 0,
      cash: 0,
      cat: category,
      type: "cuenta corriente",
    }),
  };

  const specialHandlers = {
    "#ahorro": handlers["ahorro"],
    "#reintegro": handlers["reintegro"],
    "#efectivo": handlers["efectivo"],
    "#deuda": handlers["deuda"],
  };

  const css = getComputedStyle(document.body);

  const ThemeUtils = {
    themeColor(name) {
      return css.getPropertyValue(name).trim();
    },

    transparentize(color, opacity = 0.5) {
      color = color.trim();

      // hex
      if (color.startsWith("#")) {
        let r, g, b;
        if (color.length === 4) {
          r = parseInt(color[1] + color[1], 16);
          g = parseInt(color[2] + color[2], 16);
          b = parseInt(color[3] + color[3], 16);
        } else if (color.length === 7) {
          r = parseInt(color.slice(1, 3), 16);
          g = parseInt(color.slice(3, 5), 16);
          b = parseInt(color.slice(5, 7), 16);
        } else {
          return color;
        }
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      }

      let rgbMatch = color.match(/rgba?\(\s*([^\)]+)\)/);
      if (rgbMatch) {
        const parts = rgbMatch[1].split(",").map((v) => Number(v.trim()));
        if (parts.length >= 3) {
          const [r, g, b] = parts;
          return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }
      }

      let hslMatch = color.match(/hsla?\(\s*([^)]+)\)/);
      if (hslMatch) {
        let content = hslMatch[1].trim();
        let parts;

        if (content.includes("/")) {
          parts = content.split("/").map((p) => p.trim());
          let [hsl, a] = parts;
          let hslParts = hsl.split(/\s+/);
          if (hslParts.length === 3) {
            const [h, s, l] = hslParts;
            return `hsla(${h}, ${s}, ${l}, ${opacity})`;
          }
        } else {
          parts = content.split(",").map((p) => p.trim());
          if (parts.length >= 3) {
            const [h, s, l] = parts;
            return `hsla(${h}, ${s}, ${l}, ${opacity})`;
          }
        }
      }

      return color;
    },
  };

  const palette = [
    ThemeUtils.themeColor("--color-blue"),
    ThemeUtils.themeColor("--color-cyan"),
    ThemeUtils.themeColor("--color-green"),
    ThemeUtils.themeColor("--color-yellow"),
    ThemeUtils.themeColor("--color-orange"),
    ThemeUtils.themeColor("--color-red"),
    ThemeUtils.themeColor("--color-purple"),
    ThemeUtils.themeColor("--color-pink"),
  ];

  const InterfaceUtils = {
    append(cl, css, parent, header = null) {
      cl.className = css;
      if (header) parent.appendChild(TextUtils.createHeader(header));
      parent.appendChild(cl);
    },
    buttonFactory() {},
  };
  const TextUtils = {
    /*
     * devuelve el texto formateado para el calendario "Cumple de (nombre propio|primer alias)"
     * */
    parseBirthdayNote(name, alias) {
      let text = "Cumple de ";
      if (alias && alias.length) {
        text += alias[0];
      } else {
        text += name.split(" ")[0];
      }
      return text;
    },
    // leaves undesired characters
    parseEvent(text) {
      // quitar [[foo bar| foo]] => foo
      return text.replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1");
    },
    createHeader(text) {
      const el = document.createElement("h1");
      el.textContent = text;
      return el;
    },
    firstTag(array) {
      const tag = array[0];
      return tag.substring(1);
    },
  };

  const DateUtils = {
    /**
     * devuelve una semana entera de lunes a domingo dado un día
     **/
    daysOfWeek(ref) {
      const start = ref.startOf("week");
      return Array.from({ length: 7 }, (_, i) => start.plus({ days: i }));
    },

    /**
     *  devuelve todas las semanas de lunes a domingo que incluyen al mes dado un día
     *  de esta forma, puede agregar parte del mes anterior o pasado para completar la semana
     *  util para vistas de calendario
     **/
    weeksOfMonth(ref) {
      const start = ref.startOf("month").startOf("week");
      const end = ref.endOf("month").endOf("week");
      let cur = start;
      const weeks = [];
      while (cur <= end) {
        weeks.push(this.daysOfWeek(cur));
        cur = cur.plus({ weeks: 1 });
      }
      return weeks;
    },

    /**
     * devuelve un array con todo el mes dada una fecha
     **/
    daysOfMonth(ref) {
      return Array.from({ length: ref.daysInMonth }, (_, i) =>
        ref.startOf("month").plus({ days: i }),
      );
    },

    /*
     * comprueba si la fecha dada está dentro del alcance de la vista,
     * true si esta dentro del alcance, false caso contrario
     * */
    inScope(date, ref, scope) {
      return scope === "week"
        ? date.hasSame(ref, "week")
        : date.hasSame(ref, "month");
    },

    format(date, options = { month: "numeric", day: "numeric" }) {
      const dateFormat = new Intl.DateTimeFormat("es-ES", options);
      return dateFormat.format(date);
    },
    handleBirthdays(dateStr, ref) {
      const date = DateTime.fromISO(dateStr);
      const currentYear = ref.year;
      const birthday = DateTime.fromObject({
        year: currentYear,
        month: date.month,
        day: date.day,
      });
      return birthday;
    },
    weekIndexer(date) {
      return `${date.weekYear}${date.weekNumber}`;
    },
    monthIndexer(date) {
      if (date.month.toString().length === 1) {
        return `${date.year}0${date.month}`;
      } else {
        return `${date.year}${date.month}`;
      }
    },
  };

  class Paginator {
    constructor(pageSize = 10) {
      this.page = 0;
      this.pageSize = pageSize;
    }
    slice(arr) {
      const start = this.page * this.pageSize;
      return arr.slice(start, start + this.pageSize);
    }
    reset() {
      this.page = 0;
    }
    prev() {
      if (this.page > 0) this.page--;
    }
    next(totalItems) {
      const maxPage = Math.max(0, Math.ceil(totalItems / this.pageSize) - 1);
      if (this.page < maxPage) this.page++;
    }
    pages(totalItems) {
      return Math.max(1, Math.ceil(totalItems / this.pageSize));
    }
  }

  /* ========== apartado QUERY ========== */
  class DataRepository {
    constructor(dv) {
      this.dv = dv;
    }

    fetch(ref, scope) {
      const pages = this.dv.pages();

      const journal = pages
        .where(
          (p) =>
            p.file.folder && p.file.folder.includes("journal") && p.file.day,
        )
        .where((p) =>
          scope === "week"
            ? p.file.day.hasSame(ref, "week")
            : p.file.day.hasSame(ref, "month"),
        )
        .file.array();

      const projects = pages
        .where((p) => p.file.folder && p.file.folder.includes("projects"))
        .file.array();

      const birthdays = pages
        .where((p) => p.file.folder && p.file.folder.includes("personas"))
        .file.array();

      const finance = {
        movements: [], // histórico ordenable
        byMonth: {},
        byDay: {}, // acceso directo por día
        debts: { cobrar: [], pagar: [] },
      };
      const moneyRegex = /([+-]?\d+(?:[.,]\d+)?).*?#([\p{L}\w-]+)/u;
      const movements = pages
        .where(
          (p) =>
            p.file.folder && p.file.folder.includes("journal") && p.file.day,
        )
        .file.lists.filter((item) =>
          item.header?.toString().toLowerCase().includes("gastos"),
        );

      for (const item of movements) {
        const m = item.text.match(moneyRegex);
        if (!m) continue;
        const raw = Number(m[1].replace(",", "."));
        if (Number.isNaN(raw)) continue;

        const tags = item.tags ?? [];
        const iso = item.path.replace(/^.*\/(\d{4}-\d{2}-\d{2})\.md$/, "$1");
        const date = item.task ? item.completion : DateTime.fromISO(iso);

        const specialSet = new Set(Object.keys(specialHandlers));

        let category = null;
        let handler = null;
        let deltas = null;

        for (const t of tags) {
          const h = specialHandlers[t];
          if (h) {
            handler = h;
            continue;
          }
          if (!specialSet.has(t) && !category) {
            category = t.substring(1);
          }
        }

        if (handler) {
          deltas = handler(raw, category, item.completed, item, finance);
        } else {
          deltas = handlers["default"](raw, category);
        }

        deltas.category = category;

        const movInScope = {
          date,
          iso,
          text: item.text.replace(/\s*[-]?\d+[.,]?\d*\s*#\w+$/, ""),
          type: deltas.type,
          cat: deltas.cat,
          raw,
          savingsDelta: deltas.savings,
          cashDelta: deltas.cash,
          cardDelta: deltas.card,
        };

        if (!item.task && !item.done) {
          const month = DateUtils.monthIndexer(date);

          finance.movements.push(movInScope);
          finance.byMonth[month] ??= [];
          finance.byMonth[month].push(movInScope);
          finance.byDay[iso] ??= [];
          finance.byDay[iso].push(movInScope);
        }
      }

      return { journal, projects, birthdays, finance };
    }
  }

  /* ========== INDEXADOR ========== */
  async function indexData(
    { journal, projects, birthdays, finance },
    ref,
    scope,
  ) {
    const pageByDay = {};
    const weeks = {};
    const habitsSet = new Set();
    const projectRecords = [];
    const healthSeries = {
      isEmpty: true,
      labels: [],
      quality: [],
      water: [],
      hours: [],
    };

    function ensureDay(date) {
      const iso = date.toISODate();
      const w = DateUtils.weekIndexer(date);
      weeks[w] ??= { days: {} };
      weeks[w].days[iso] ??= { habits: {}, events: [] };
      return weeks[w].days[iso];
    }

    // projects WARNING TODO check: no debería recargarse con el rerender, ya que es global
    for (const file of projects) {
      let projectStatus = "Active";
      let completion = 0;
      let size = 0;
      let done = 0;

      for (const t of file.tasks) {
        const h = t.header?.toString().toLowerCase() ?? "";

        if (h.includes("next actions")) {
          if (t.completed) done++;
          size++;
        }

        if (h.includes("waiting") && !t.completed) {
          projectStatus = "Waiting";
        }
      }

      if (size === 0) {
        projectStatus = "Empty";
        completion = 0;
      } else {
        completion = done / size;
      }

      if (completion === 1) projectStatus = "done";

      projectRecords.push({
        file,
        completion,
        status: projectStatus,
      });
    }

    // journal
    for (const file of journal) {
      const iso = file.day.toISODate();
      pageByDay[iso] = file;

      const day = ensureDay(file.day);

      for (const item of file.lists) {
        const header = item.header?.toString().toLowerCase() ?? "";

        if (
          header.includes("habits") &&
          DateUtils.inScope(file.day, ref, scope)
        ) {
          day.habits[item.text] = item.completed;
          habitsSet.add(item.text);
        }

        if (header.includes("planes")) {
          day.events.push({
            text: TextUtils.parseEvent(item.text),
            isBirthday: false,
          });
        }
      }
    }

    // birthdays
    for (const b of birthdays) {
      const date = DateUtils.handleBirthdays(b.frontmatter.birth, ref);
      if (!DateUtils.inScope(date, ref, scope)) continue;

      const day = ensureDay(date);
      day.events.push({
        text: TextUtils.parseBirthdayNote(b.name, b.aliases),
        isBirthday: true,
      });
    }

    // health series
    const days =
      scope === "week" ? DateUtils.daysOfWeek(ref) : DateUtils.daysOfMonth(ref);

    for (const day of days) {
      const iso = day.toISODate();
      const page = pageByDay[iso];
      const label = day.toFormat("dd");

      let hours = 0;
      let quality = null;
      let water = null;

      if (
        page &&
        page.frontmatter.waketime &&
        page.frontmatter.bedtime &&
        day.month === ref.month
      ) {
        const p = page.frontmatter;
        hours = DateTime.fromISO(p.waketime)
          .diff(DateTime.fromISO(p.bedtime))
          .as("hours");
        quality = p.sleepQuality ? Number(p.sleepQuality) : 0;
        water = p.waterIntake ? Number(p.waterIntake) : 0;
        healthSeries.isEmpty = false;
      }

      healthSeries.labels.push(label);
      healthSeries.quality.push(quality);
      healthSeries.water.push(water);
      healthSeries.hours.push(hours);
    }

    // detalle de cada transaccion
    const financeScope = [];
    financeScope.expenseByCategory = {};
    ((financeScope.incomeScope = 0),
      (financeScope.expenseScope = 0),
      (financeScope.gastoTarjeta = 0),
      (financeScope.gastoEfectivo = 0));

    let movsFromCheckpoint,
      cardSnapshot,
      cashSnapshot,
      availableSnapshot,
      savingsSnapshot;

    // desde checkpoint si existe
    if (finance.byMonth[DateUtils.monthIndexer(ref)] === undefined) {
      movsFromCheckpoint = finance.byMonth[DateUtils.monthIndexer(ref)];
      const check = await checkpoint(DateUtils.monthIndexer(ref));
      cardSnapshot = Number(check.card);
      cashSnapshot = Number(check.cash);
      availableSnapshot = Number(check.available);
      savingsSnapshot = Number(check.savings);
    } else {
      movsFromCheckpoint = finance.movements;
      cardSnapshot = CONFIG.INITIAL_MONEY;
      cashSnapshot = CONFIG.INITIAL_CASH;
      availableSnapshot = CONFIG.INITIAL_CASH + CONFIG.INITIAL_MONEY;
      savingsSnapshot = CONFIG.INITIAL_SAVINGS;
    }

    for (const m of movsFromCheckpoint) {
      cardSnapshot += m.cardDelta;
      cashSnapshot += m.cashDelta;
      availableSnapshot += m.cashDelta + m.cardDelta;
      savingsSnapshot += m.savingsDelta;
      const newCat = m.cat ? m.cat : m.type;

      if (
        DateUtils.inScope(m.date, state.ref, state.scope) &&
        m.type !== "ahorro" &&
        m.type !== "reintegro" &&
        m.raw < 0
      ) {
        financeScope.expenseByCategory[newCat] ??= 0;
        financeScope.expenseByCategory[newCat] += Math.abs(m.raw);
      }

      // solo sumar ingresos/gastos al scope para resumen
      if (
        DateUtils.inScope(m.date, state.ref, state.scope) &&
        m.type !== "ahorro" &&
        m.type !== "reintegro"
      ) {
        if (m.raw >= 0) financeScope.incomeScope += m.raw;
        else {
          financeScope.expenseScope += Math.abs(m.raw);
          if (m.type === "efectivo") {
            financeScope.gastoEfectivo += Math.abs(m.raw);
          } else {
            financeScope.gastoTarjeta += Math.abs(m.raw);
          }
        }
      }

      if (DateUtils.inScope(m.date, state.ref, state.scope)) {
        financeScope.push({
          date: m.date,
          text: m.text,
          cat: newCat,
          movementDetail: m.raw,
          cashSnapshot: cashSnapshot.toFixed(2),
          cardSnapshot: cardSnapshot.toFixed(2),
          availableSnapshot: availableSnapshot.toFixed(2),
        });
      }
    }
    console.log(financeScope);
    financeScope.savingsSnapshot = savingsSnapshot.toFixed(2);
    financeScope.availableSnapshot = availableSnapshot.toFixed(2);

    return {
      weeks,
      pageByDay,
      habitsSet,
      projectRecords,
      healthSeries,
      financeScope,
    };
  }

  /* ========== UI: elementos base ========== */
  const root = dv.container;
  root.innerHTML = "";
  const projectsCanvas = document.createElement("div");
  projectsCanvas.className = "project-canvas";
  root.appendChild(projectsCanvas);

  const controls = document.createElement("div");
  controls.className = "dashboard-controls";

  const scopeSelect = document.createElement("select");
  scopeSelect.innerHTML = `<option value="week">semanal</option><option value="month">mensual</option>`;
  scopeSelect.value = state.scope;

  const navPrev = document.createElement("button");
  navPrev.textContent = "◀";

  const navLabel = document.createElement("span");
  navLabel.className = "nav-label";

  const navNext = document.createElement("button");
  navNext.textContent = "▶";

  controls.append(scopeSelect, navPrev, navLabel, navNext);
  root.appendChild(controls);

  const tableDiv = document.createElement("div");
  InterfaceUtils.append(tableDiv, "calendar-wrap", root, "Calendario");

  const sleepSpace = document.createElement("div");
  root.appendChild(sleepSpace);

  const financeDiv = document.createElement("div");
  InterfaceUtils.append(financeDiv, "finance-wrap", root);
  financeDiv.className = "finance-wrap";

  const expenseChartDiv = document.createElement("div");
  expenseChartDiv.className = "expense-wrap";
  root.appendChild(expenseChartDiv);

  let sleepChart = null,
    financeChart = null,
    expenseChart = null;

  /* ========== Estado de datos y paginator único para secciones grandes ========== */
  const repo = new DataRepository(dv);
  let indexed = null;

  /* ========== FETCH + INDEX (se re-evalúa en cada cambio de state) ========== */
  async function refreshData() {
    const { ref, scope } = state;
    const raw = repo.fetch(ref, scope);
    return indexData(raw, ref, scope);
  }

  /* ========== RENDER: tabla de calendario basada en indexed y DateUtils ========== */
  function renderTable() {
    tableDiv.innerHTML = "";
    const { ref, scope } = state;
    navLabel.textContent =
      scope === "week"
        ? `semana ${ref.weekNumber} · ${ref.year}`
        : ref.toFormat("LLLL yyyy");

    const table = document.createElement("table");
    table.className = "calendar-table";

    // header row
    const headerRow = document.createElement("tr");
    headerRow.appendChild(document.createElement("th"));
    headerRow.className = "current-month";
    CONFIG.WEEKDAYS.forEach((w) => {
      const th = document.createElement("th");
      th.textContent = w;
      headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    const weeksToRender =
      scope === "week"
        ? [DateUtils.daysOfWeek(ref)]
        : DateUtils.weeksOfMonth(ref);

    for (const week of weeksToRender) {
      // cache de la semana indexada (una vez por semana)
      const isoWeek = DateUtils.weekIndexer(week[0]);
      const weekIndex = indexed.weeks?.[isoWeek]?.days ?? {};

      // day numbers row
      const dayRow = document.createElement("tr");
      dayRow.className = "current-month";
      dayRow.appendChild(document.createElement("td"));
      for (const d of week) {
        const td = document.createElement("td");
        const iso = d.toISODate();
        const link = document.createElement("span");
        link.className = "day-link";
        link.textContent = d.day;
        link.onclick = async () => {
          const path = `journal/${iso}.md`;
          let file = app.vault.getAbstractFileByPath(path);
          if (!file) {
            const templater = app.plugins.plugins["templater-obsidian"];
            const template =
              app.vault.getAbstractFileByPath("templates/Daily.md");
            if (templater && template)
              await templater.templater.create_new_note_from_template(
                template,
                "journal",
                iso,
              );
            else await app.vault.create(path, "");
            file = app.vault.getAbstractFileByPath(path);
          }
          app.workspace.getLeaf().openFile(file);
        };
        td.appendChild(link);
        td.className = d.month === ref.month ? "current-month" : "other-month";
        dayRow.appendChild(td);
      }
      table.appendChild(dayRow);

      const planRow = document.createElement("tr");
      const pl = document.createElement("td");
      pl.className = "plan-cell";
      pl.textContent = "planes";
      planRow.appendChild(pl);

      for (const d of week) {
        const td = document.createElement("td");
        const iso = d.toISODate();
        const events = weekIndex[iso]?.events ?? [];

        if (events.length && d.month === ref.month) {
          td.className = "plan-cell";
          const hasBirthday = events.some((e) => e.isBirthday);
          const hasPlan = events.some((e) => !e.isBirthday);

          if (hasBirthday) td.textContent = "🎂";
          else if (hasPlan) td.textContent = "🗓️";

          td.title = events.map((e) => e.text).join("\n");
        }

        planRow.appendChild(td);
      }
      table.appendChild(planRow);

      // habits rows (solo hábitos presentes en esta semana)
      const habitsInWeek = new Set();
      for (const dayData of Object.values(weekIndex)) {
        for (const h of Object.keys(dayData.habits || {})) {
          habitsInWeek.add(h);
        }
      }

      for (const habit of habitsInWeek) {
        const tr = document.createElement("tr");
        const htd = document.createElement("td");
        const todayISO = DateTime.now().toISODate();
        htd.className = "plan-cell";
        htd.textContent = habit;
        tr.appendChild(htd);

        for (const d of week) {
          const td = document.createElement("td");
          const iso = d.toISODate();
          const done = weekIndex[iso]?.habits?.[habit];

          if (iso > todayISO || weekIndex[iso] === undefined) {
            td.textContent = " ";
          } else if (done === undefined) {
            td.textContent = "—";
          } else {
            td.textContent = done ? "✔" : "✘";
          }

          tr.appendChild(td);
        }

        table.appendChild(tr);
      }
    }

    tableDiv.appendChild(table);
  }

  /* ========== RENDER PROJECTS (paginado con projectsPaginator) ========== */
  const projectsPaginator = new Paginator(CONFIG.PROJECTS_PAGE_SIZE);
  function renderProjects(projects) {
    projectsCanvas.innerHTML = "";

    const projectControls = document.createElement("grid");

    const projPrev = document.createElement("button");
    projPrev.textContent = "◀";

    const projLabel = document.createElement("span");
    projLabel.className = "nav-label";
    projLabel.textContent = `${projectsPaginator.page}/${projectsPaginator.pages()}`;

    const projNext = document.createElement("button");
    projNext.textContent = "▶";

    projectControls.append(
      TextUtils.createHeader("Proyectos"),
      projPrev,
      projLabel,
      projNext,
    );
    projectsCanvas.appendChild(projectControls);

    projectsCanvas.appendChild(document.createElement("div"));

    const cardsContainer = document.createElement("div");
    cardsContainer.className = "projects-page";
    projectsCanvas.appendChild(cardsContainer);

    function renderPage() {
      cardsContainer.innerHTML = "";

      const pageItems = projectsPaginator.slice(projects);
      const totalPages = projectsPaginator.pages(projects.length);

      projLabel.textContent = `${projectsPaginator.page + 1}/${totalPages}`;

      for (const r of pageItems) {
        const card = document.createElement("div");
        card.className = "project-card";

        const title = document.createElement("span");
        title.className = "project-title";
        title.textContent = r.file.name;
        title.onclick = async () => {
          const file = app.vault.getAbstractFileByPath(r.file.path);
          app.workspace.getLeaf().openFile(file);
        };

        const percent = document.createElement("div");
        percent.className = "project-percent";
        percent.textContent = `Completion: ${Math.round(r.completion * 100)}%`;

        const status = document.createElement("div");
        status.className = "project-status";
        status.textContent = `Status: ${r.status}`;

        card.append(title, percent, status);
        cardsContainer.appendChild(card);
      }

      projPrev.disabled = projectsPaginator.page === 0;
      projNext.disabled = projectsPaginator.page >= totalPages - 1;
    }

    projPrev.onclick = () => {
      projectsPaginator.prev();
      renderPage();
    };

    projNext.onclick = () => {
      projectsPaginator.next(projects.length);
      renderPage();
    };

    renderPage();
  }

  /* ========== SLEEP CHART RENDER ========== */
  function renderHealth(rec) {
    sleepSpace.innerHTML = "";
    sleepChart?.destroy();
    if (!rec.isEmpty) {
      const sleepCanvas = document.createElement("canvas");
      InterfaceUtils.append(sleepCanvas, "sleep-canvas", sleepSpace, "Salud");
      sleepChart = new Chart(sleepCanvas, {
        data: {
          labels: rec.labels,
          datasets: [
            {
              type: "line",
              label: "calidad",
              data: rec.quality,
              tension: 0.3,
              yAxisID: "yQuality",
              borderColor: ThemeUtils.themeColor("--color-accent"),
              backgroundColor: ThemeUtils.themeColor("--color-accent"),
            },
            {
              type: "line",
              label: "agua",
              data: rec.water,
              tension: 0.3,
              yAxisID: "yQuality",
              borderColor: ThemeUtils.themeColor("--color-blue"),
              backgroundColor: ThemeUtils.themeColor("--color-blue"),
            },
            {
              type: "bar",
              label: "horas",
              data: rec.hours,
              yAxisID: "yHours",
              borderColor: ThemeUtils.themeColor("--color-accent-2"),
              borderWidth: 2,
              backgroundColor: ThemeUtils.transparentize(
                ThemeUtils.themeColor("--color-accent"),
              ),
            },
          ],
        },
        options: {
          scales: {
            yQuality: { position: "right", beginAtZero: true, max: 5 },
            yHours: { position: "left", beginAtZero: true, max: 10 },
          },
        },
      });
    }
  }

  /* ========== FINANCES RENDER (repositorio + indexed) ========== */
  function processTransaction(delta) {
    if (delta.type !== "ahorro" || delta.type !== "reintegro") {
      return `${Math.abs(delta.raw).toFixed(2)} ↔️`;
    } else if (delta.raw >= 0) {
      return `${Math.abs(delta.raw).toFixed(2)} 📈`;
    } else {
      return `${Math.abs(delta.raw).toFixed(2)} 📉`;
    }
  }

  async function renderFinances(mov) {
    financeDiv.innerHTML = "";

    let pagarTotal = 0,
      cobrarTotal = 0;
    const moneyRegex = /([+-]?\d+(?:[.,]\d+)?).*?#([\p{L}\w-]+)/u;

    // listar deudas pendientes
    const cobrarTasks = dv
      .pages()
      .where((p) => p.file.folder.includes("journal"))
      .file.tasks.where(
        (t) =>
          t.text.includes("#deuda") &&
          !t.completed &&
          parseFloat(t.text.match(moneyRegex)?.[1]) > 0,
      );

    const pagarTasks = dv
      .pages()
      .where((p) => p.file.folder.includes("journal"))
      .file.tasks.where(
        (t) =>
          t.text.includes("#deuda") &&
          !t.completed &&
          parseFloat(t.text.match(moneyRegex)?.[1]) < 0,
      );

    if (cobrarTasks.length) {
      dv.header(2, `A cobrar (total ${cobrarTotal} `);
      dv.taskList(cobrarTasks, false);
    }

    if (pagarTasks.length) {
      dv.header(2, `A pagar (total ${pagarTotal})`);
      dv.taskList(pagarTasks, false);
    }

    // gráfico de finanzas
    if (mov.expenseScope !== 0 || mov.incomeScope !== 0) {
      financeDiv.appendChild(TextUtils.createHeader("Finanzas"));
      const chartsWrap = document.createElement("div");
      chartsWrap.className = "finance-charts";

      const left = document.createElement("div");
      left.className = "left";

      const right = document.createElement("div");
      right.className = "right";

      chartsWrap.append(left, right);

      const barCanvas = document.createElement("canvas");
      left.append(barCanvas);

      const pieCanvas = document.createElement("canvas");
      right.append(pieCanvas);

      financeDiv.appendChild(chartsWrap);

      const labels = Object.keys(mov.expenseByCategory);
      const data = Object.values(mov.expenseByCategory);

      expenseChart?.destroy();
      financeChart?.destroy();

      expenseChart = new Chart(pieCanvas, {
        type: "pie",
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: labels.map(
                (_, i) => palette[i % palette.length],
              ),
            },
          ],
        },
        options: {
          layout: { padding: 0 },
          radius: "70%",
          plugins: {
            title: { display: true, text: "Gastos por Categoría" },
            legend: { display: false },
          },
          responsive: true,
          maintainAspectRatio: false,
        },
      });

      financeChart?.destroy();
      const financesData = {
        labels: ["gasto", "ingreso", "cuentas"],
        datasets: [
          {
            label: `Tarjeta (total ${mov.expenseScope.toFixed(2)})`,
            data: [mov.gastoTarjeta, null, null],
            stack: "gastos",
            yAxisID: "yMoney",
            backgroundColor: ThemeUtils.themeColor("--color-red"),
          },
          {
            label: `Efectivo (total ${mov.expenseScope.toFixed(2)})`,
            data: [mov.gastoEfectivo, null, null],
            stack: "gastos",
            yAxisID: "yMoney",
            backgroundColor: ThemeUtils.themeColor("--color-orange"),
          },
          {
            label: "Ingresos",
            data: [null, mov.incomeScope, null],
            stack: "ingresos",
            yAxisID: "yMoney",
            backgroundColor: ThemeUtils.themeColor("--color-green"),
          },
          {
            label: "Ahorro",
            data: [null, null, mov.savingsSnapshot],
            stack: "cuentas",
            yAxisID: "yAhorro",
            backgroundColor: ThemeUtils.themeColor("--color-blue"),
          },
          {
            label: "Disponible",
            data: [null, null, mov.availableSnapshot],
            stack: "cuentas",
            yAxisID: "yAhorro",
            backgroundColor: ThemeUtils.themeColor("--color-cyan"),
          },
          {
            label: "Meta Ahorro",
            data: [{ x: "cuentas", y: CONFIG.SAVINGS_GOAL }],
            type: "scatter",
            yAxisID: "yAhorro",
            pointRadius: 6,
            backgroundColor: ThemeUtils.themeColor("--color-red"),
          },
        ],
      };

      financeChart = new Chart(barCanvas, {
        type: "bar",
        data: financesData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: 0 },
          plugins: {
            legend: { display: false },
          },
          scales: {
            yMoney: {
              stacked: true,
              beginAtZero: true,
              position: "left",
            },
            yAhorro: {
              stacked: true,
              beginAtZero: true,
              position: "right",
              grid: { display: false },
              max: CONFIG.SAVINGS_GOAL,
            },
          },
        },
      });
    }

    if (mov.expenseScope !== 0) {
      const table = document.createElement("table");
      table.className = "finance-table";
      table.innerHTML = `<tr class = "current-month"><th>Fecha</th><th>Movimiento</th><th>Tipo</th><th>Cantidad</th><th>Saldo</th><th>Cuenta</th><th>Efectivo</th></tr>`;

      for (const r of mov) {
        if (!DateUtils.inScope(r.date, state.ref, state.scope)) continue;

        const datePage = r.date.toISODate();
        const filePath = `journal/${datePage}.md`;
        const file = app.vault.getAbstractFileByPath(filePath);

        const link = document.createElement("a");
        link.textContent = DateUtils.format(r.date);
        link.onclick = async () => {
          app.workspace.getLeaf().openFile(file);
        };

        let desc = "";
        const dm = r.text.match(/^(.*?)(?:\s+[+-]?\d|#)/);
        if (dm && dm[1].trim()) desc = dm[1].trim();
        else
          desc = r.text
            .replace(/#\S+/g, "")
            .replace(/[+-]?\d+(?:[.,]\d+)?/g, "")
            .trim();

        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td class="col-page"></td>
      <td>${desc}</td>
      <td>${r.cat}</td>
      <td>${r.movementDetail}</td>
      <td>${Math.abs(r.availableSnapshot)}</td>
      <td>${Math.abs(r.cardSnapshot)}</td>
      <td>${r.cashSnapshot}</td>
    `;
        tr.querySelector(".col-page").appendChild(link);
        table.appendChild(tr);
      }

      financeDiv.appendChild(table);
    }
  }

  /* ========== RENDER MASTER ========== */
  async function renderAll() {
    indexed = await refreshData();
    renderTable();
    renderHealth(indexed.healthSeries);
    renderFinances(indexed.financeScope);
  }

  /* ========== CONTROLES: handlers ========== */
  scopeSelect.onchange = (e) => {
    state.scope = e.target.value;
    // reset reference to current when changing scope for clarity
    state.ref = DateTime.now();
    renderAll();
  };
  // si haces -1 month sobre el 29 al 31 de marzo, seguirá siendo marzo o te lo reduce al 28 de febrero?
  navPrev.onclick = () => {
    state.ref =
      state.scope === "week"
        ? state.ref.minus({ weeks: 1 })
        : state.ref.minus({ months: 1 });
    renderAll();
  };
  navNext.onclick = () => {
    state.ref =
      state.scope === "week"
        ? state.ref.plus({ weeks: 1 })
        : state.ref.plus({ months: 1 });
    renderAll();
  };

  /* ========== INIT ========== */
  indexed = await refreshData();
  renderProjects(indexed.projectRecords);
  await renderAll();
} catch (error) {
  console.log(error);
  if (!input) {
    dv.span(
      '> [!ERROR] ERROR: No se han agregado las llaves\n> \n> Debe introducir los siguientes parámetros\n>\n> `{account: "", cash: "", savings: "", savings_goal: ""}`\n> para continuar.\n>\n> Si no quiere añadir ningún valor, solo mantenga las llaves "`{}`"\n> ejemplo:\n> ```\n> dv.view("scripts/dashboard.js",{})\n>                                ^^\n>```\n>',
    );
  }
}
