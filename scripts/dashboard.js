try {
  let { account, savings, cash, savings_goal, def_scope, track_gym } = input;

  if (
    (account && typeof account !== "number") ||
    (savings && typeof savings !== "number") ||
    (cash && typeof cash !== "number") ||
    (savings_goal && typeof savings_goal !== "number")
  ) {
    dv.span(
      ">[!ERROR] ERROR: debe ser un número\n> las variables `account, cash, savings, savings_goal` deben ser números",
    );
    return false;
  }
  if (def_scope && def_scope !== "week" && def_scope !== "month") {
    dv.span(">[!ERROR] ERROR: `def_scope` solo puede ser `week` o `month`");
    return false;
  }

  /* ========== apartado CONFIG y variables globales ========== */
  const CONFIG = {
    INITIAL_MONEY: account ? account : 0,
    INITIAL_CASH: cash ? cash : 0,
    INITIAL_SAVINGS: savings ? savings : 0,
    SAVINGS_GOAL: savings_goal,
    TRACK_GYM: track_gym ? track_gym : false,
    DEFAULT_SCOPE: def_scope ? def_scope : "week",
    WEEKDAYS: ["lun", "mar", "mie", "jue", "vie", "sab", "dom"],
    PROJECTS_PAGE_SIZE: 3,
  };

  const json = await dv.io.load("scripts/checkpoints.json"); // carga de los snapshots de finanzas
  const DateTime = dv.luxon.DateTime;
  const moneyRegex = /([+-]?\d+(?:[.,]\d+)?).*?#([\p{L}\w-]+)/u;

  /** globalCache: contiene el estado de todas las EDAs */
  const globalCache = {
    paginator: {
      page: 0,
      pageSize: 0,
    },
    scope: CONFIG.DEFAULT_SCOPE,
    ref: DateTime.now(),
    finance: {
      scoped: {
        cash: 0,
        card: 0,
        income: 0,
        expense: 0,
        byCategory: {},
      },
      byMonth: {},
      debts: {
        cobrar: [],
        pagar: [],
        totalCobrar: 0,
        totalPagar: 0,
        isEmpty: true,
      },
    },
    projects: {},
    habits: new Set(),
    weeks: {},
    healthIndex: {
      isEmpty: true,
      days: [],
      quality: [],
      water: [],
      hours: [],
    },
    init: false,
  };

  /* ========== CARGAR CSS y CHARTJS ========== */
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

  async function loadChartJS() {
    if (window.Chart) return;
    await new Promise((res) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js";
      s.onload = res;
      document.head.appendChild(s);
    });
  }
  await loadExternalCSS("scripts/dashboard.css");
  await loadChartJS();

  /*
   *
   * utils
   *
   */

  /*
   * TASK UTILS
   *
   */
  const LIST_ITEM_REGEX =
    /^[\s>]*(\d+\.|\d+\)|\*|-|\+)\s*(\[.{0,1}\])?\s*(.*)$/mu;
  async function rewriteTask(task, desiredStatus, desiredText) {
    if (
      desiredStatus == task.status &&
      (desiredText == undefined || desiredText == task.text)
    )
      return;
    desiredStatus = desiredStatus == "" ? " " : desiredStatus;
    let rawFiletext = await app.vault.adapter.read(task.path);
    let hasRN = rawFiletext.contains("\r");
    let filetext = rawFiletext.split(/\r?\n/u);
    if (filetext.length < task.line) return;
    let match = LIST_ITEM_REGEX.exec(filetext[task.line]);
    if (!match || match[2].length == 0) return;
    let taskTextParts = task.text.split("\n");
    if (taskTextParts[0].trim() != match[3].trim()) return;
    // We have a positive match here at this point, so go ahead and do the rewrite of the status.
    let initialSpacing = /^[\s>]*/u.exec(filetext[task.line])[0];
    if (desiredText) {
      let desiredParts = desiredText.split("\n");
      let newTextLines = [
        `${initialSpacing}${task.symbol} [${desiredStatus}] ${desiredParts[0]}`,
      ].concat(desiredParts.slice(1).map((l) => initialSpacing + "\t" + l));
      filetext.splice(task.line, task.lineCount, ...newTextLines);
    } else {
      filetext[task.line] =
        `${initialSpacing}${task.symbol} [${desiredStatus}] ${taskTextParts[0].trim()}`;
    }
    let newText = filetext.join(hasRN ? "\r\n" : "\n");
    await app.vault.adapter.write(task.path, newText);
  }

  function findSeparator(line, start) {
    let sep = line.indexOf("::", start);
    if (sep < 0) return undefined;
    return { key: line.substring(start, sep).trim(), valueIndex: sep + 2 };
  }

  const INLINE_FIELD_WRAPPERS = Object.freeze({
    "[": "]",
    "(": ")",
  });

  function findClosing(line, start, open, close) {
    let nesting = 0;
    let escaped = false;
    for (let index = start; index < line.length; index++) {
      let char = line.charAt(index);
      // Allows for double escapes like '\\' to be rendered normally.
      if (char == "\\") {
        escaped = !escaped;
        continue;
      }
      // If escaped, ignore the next character for computing nesting, regardless of what it is.
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char == open) nesting++;
      else if (char == close) nesting--;
      // Only occurs if we are on a close character and there is no more nesting.
      if (nesting < 0)
        return {
          value: line.substring(start, index).trim(),
          endIndex: index + 1,
        };
      escaped = false;
    }
    return undefined;
  }
  function findSpecificInlineField(line, start) {
    let open = line.charAt(start);
    let key = findSeparator(line, start + 1);
    if (key === undefined) return undefined;
    // Fail the match if we find any separator characters (not allowed in keys).
    for (let sep of Object.keys(INLINE_FIELD_WRAPPERS).concat(
      Object.values(INLINE_FIELD_WRAPPERS),
    )) {
      if (key.key.includes(sep)) return undefined;
    }
    let value = findClosing(
      line,
      key.valueIndex,
      open,
      INLINE_FIELD_WRAPPERS[open],
    );
    if (value === undefined) return undefined;
    return {
      key: key.key,
      value: value.value,
      start: start,
      startValue: key.valueIndex,
      end: value.endIndex,
      wrapping: open,
    };
  }

  function extractInlineFields(line) {
    let fields = [];
    for (let wrapper of Object.keys(INLINE_FIELD_WRAPPERS)) {
      let foundIndex = line.indexOf(wrapper);
      while (foundIndex >= 0) {
        let parsedField = findSpecificInlineField(line, foundIndex);
        if (!parsedField) {
          foundIndex = line.indexOf(wrapper, foundIndex + 1);
          continue;
        }
        fields.push(parsedField);
        foundIndex = line.indexOf(wrapper, parsedField.end);
      }
    }
    fields.sort((a, b) => a.start - b.start);
    let filteredFields = [];
    for (let i = 0; i < fields.length; i++) {
      if (
        i == 0 ||
        filteredFields[filteredFields.length - 1].end < fields[i].start
      ) {
        filteredFields.push(fields[i]);
      }
    }
    return filteredFields;
  }
  function setInlineField(source, key, value) {
    let existing = extractInlineFields(source);
    let existingKeys = existing.filter((f) => f.key == key);
    // Don't do anything if there are duplicate keys OR the key already doesn't exist.
    if (existingKeys.length > 2 || (existingKeys.length == 0 && !value))
      return source;
    let existingKey = existingKeys[0];
    let annotation = value ? `[${key}:: ${value}]` : "";
    if (existingKey) {
      let prefix = source.substring(0, existingKey.start);
      let suffix = source.substring(existingKey.end);
      if (annotation) return `${prefix}${annotation}${suffix}`;
      else return `${prefix}${suffix.trimStart()}`;
    } else if (annotation) {
      return `${source.trimEnd()} ${annotation}`;
    }
    return source;
  }

  function setTaskCompletion(
    originalText,
    completionKey,
    completionDateFormat,
  ) {
    const blockIdRegex = /\^[a-z0-9\-]+/i;
    let parts = originalText.split(/\r?\n/u);
    const matches = blockIdRegex.exec(parts[parts.length - 1]);
    let processedPart = parts[parts.length - 1].split(blockIdRegex).join(""); // last part without block id
    processedPart = setInlineField(
      processedPart,
      completionKey,
      DateTime.now().toFormat(completionDateFormat),
    );

    processedPart =
      `${processedPart.trimEnd()}${matches?.length ? " " + matches[0].trim() : ""}`.trimEnd(); // add back block id
    parts[parts.length - 1] = processedPart;
    return parts.join("\n");
  }
  /** renderiza un checkbox */
  function TaskItemDOM(item) {
    const li = document.createElement("li");
    li.className = "dataview task-list-item";
    li.setAttribute("data-task", item.status);

    const checkbox = document.createElement("input");
    checkbox.className = "dataview task-list-item-checkbox";
    checkbox.type = "checkbox";
    checkbox.checked = item.status !== " ";
    checkbox.addEventListener("click", onChecked);

    const content = document.createElement("span");
    content.textContent = item.visual ?? item.text;

    li.append(checkbox, content);

    if (item.children?.length) {
      li.append(TaskListDOM(item.children));
    }

    function onChecked(evt) {
      const completed = evt.currentTarget.checked;
      const status = completed ? "x" : " ";
      li.setAttribute("data-task", status);

      let flatted = [item];
      function flatter(iitem) {
        flatted.push(iitem);
        iitem.children.forEach(flatter);
      }
      item.children.forEach(flatter);
      flatted = flatted.flat(Infinity);

      (async () => {
        for (let i = 0; i < flatted.length; i++) {
          const _item = flatted[i];
          let updatedText = setTaskCompletion(
            _item.text,
            "fechaPagado",
            "yyyy-MM-dd",
          );
          await rewriteTask(_item, status, updatedText);
        }
        app.workspace.trigger("dataview:refresh-views");
      })();
    }

    return li;
  }

  function TaskListDOM(items) {
    const ul = document.createElement("ul");
    ul.className = "contains-task-list";

    for (const item of items) {
      ul.append(TaskItemDOM(item));
    }

    return ul;
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
    deuda: (raw, category, completed, item) => {
      if (!completed) {
        if (raw >= 0) {
          globalCache.finance.debts.cobrar.push(item);
          globalCache.finance.debts.totalCobrar += raw;
        } else {
          globalCache.finance.debts.pagar.push(item);
          globalCache.finance.debts.totalPagar += Math.abs(raw);
        }
        globalCache.finance.debts.isEmpty = false;
        return null;
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

  /** devuelve el snapshot de las cuentas dado un movimiento*/
  const calcSnapshotAtMovement = (delta, previousState) => ({
    card: previousState.card + delta.card,
    savings: previousState.savings + delta.savings,
    cash: previousState.cash + delta.cash,
  });

  /** Devuelve un numero decimal en formato D.DD€*/
  function parseMoney(cuantity) {
    return `${Math.abs(cuantity).toFixed(2)}€`;
  }

  const specialHandlers = {
    "#ahorro": handlers["ahorro"],
    "#reintegro": handlers["reintegro"],
    "#efectivo": handlers["efectivo"],
    "#deuda": handlers["deuda"],
  };

  /**
   *
   * DATE UTILS
   *
   */

  function diffHours(end, start) {
    return DateTime.fromISO(end).diff(DateTime.fromISO(start)).as("hours");
  }
  /** crea una entrada en el objeto weeks para cada dia existente en journal*/
  function ensureDay(date) {
    const iso = date.toISODate();
    const w = weekIndexer(date);
    globalCache.weeks[w] ??= { days: {} };
    globalCache.weeks[w].days[iso] ??= { habits: {}, events: [], page: null };
    return globalCache.weeks[w].days[iso];
  }
  /** devuelve una semana entera de lunes a domingo dado un día */
  function daysOfWeek(ref) {
    const start = ref.startOf("week");
    return Array.from({ length: 7 }, (_, i) => start.plus({ days: i }));
  }

  /**
   *  devuelve todas las semanas de lunes a domingo que incluyen al mes dado un día de esta forma, puede
   *  agregar parte del mes anterior o pasado para completar la semana util para vistas de calendario
   **/
  function weeksOfMonth(ref) {
    const start = ref.startOf("month").startOf("week");
    const end = ref.endOf("month").endOf("week");
    let cur = start;
    const weeks = [];
    while (cur <= end) {
      weeks.push(daysOfWeek(cur));
      cur = cur.plus({ weeks: 1 });
    }
    return weeks;
  }

  /* devuelve un array con todo el mes dada una fecha */
  function daysOfMonth(ref) {
    return Array.from({ length: ref.daysInMonth }, (_, i) =>
      ref.startOf("month").plus({ days: i }),
    );
  }

  /* comprueba si la fecha dada está dentro del alcance de la vista, true si esta dentro del alcance, false caso contrario */
  function inScope(date, ref, scope) {
    return scope === "week"
      ? date.hasSame(ref, "week")
      : date.hasSame(ref, "month");
  }

  function format(date, options = { month: "numeric", day: "numeric" }) {
    const dateFormat = new Intl.DateTimeFormat("es-ES", options);
    return dateFormat.format(date);
  }
  function handleBirthdays(dateStr, ref) {
    const date = DateTime.fromISO(dateStr);
    const currentYear = ref.year;
    const birthday = DateTime.fromObject({
      year: currentYear,
      month: date.month,
      day: date.day,
    });
    return birthday;
  }
  function weekIndexer(date) {
    return `${date.weekYear}${date.weekNumber}`;
  }
  /** devuelve una fecha en formato YYYYMM para indexar en diccionario*/
  function monthIndexer(date) {
    if (date.month.toString().length === 1) {
      return `${date.year}0${date.month}`;
    } else {
      return `${date.year}${date.month}`;
    }
  }

  function parseBirthdayNote(name, alias) {
    let text = "Cumple de ";
    if (alias && alias.length) {
      text += alias[0];
    } else {
      text += name.split(" ")[0];
    }
    return text;
  }
  /* leaves undesired characters, such as hyperlinks urls or wikilinks structure */
  function parseEvent(text) {
    // quitar [[foo bar| foo]] => foo
    return text.replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1");
  }

  /*
   *
   * Parsers
   *
   */

  function parsePath(path) {
    const start = path.lastIndexOf("/") + 1;
    const end = path.lastIndexOf(".md");
    if (start === 0 || end === -1 || end <= start) return null;
    return path.slice(start, end);
  }

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
    fetch() {
      let financesAll, projectsAll;
      if (!globalCache.init) {
        projectsAll = dv.pages('"projects"').file;
      }

      financesAll = dv
        .pages('"journal"')
        .where(
          (p) => p.file.day && p.file.day.hasSame(globalCache.ref, "month"),
        )
        .file.lists.filter((item) =>
          item.header?.toString().toLowerCase().includes("gastos"),
        );
      const journalAll = dv
        .pages('"journal"')
        .where((p) =>
          p.file.day && globalCache.scope === "week"
            ? p.file.day.hasSame(globalCache.ref, "week")
            : p.file.day.hasSame(globalCache.ref, "month"),
        )
        .file.array();

      const birthdaysAll = dv
        .pages()
        .where((p) => p.file.folder && p.file.folder.includes("personas"))
        .file.array();

      return { journalAll, birthdaysAll, projectsAll, financesAll };
    }
  }

  function indexGlobal(projectsAll) {
    // proyectos
    let projectStatus = "Active";
    for (const t of projectsAll.tasks.array()) {
      const h = t.header?.toString().toLowerCase();
      if (!h || (h.includes("waiting") && !t.completed)) {
        projectStatus = "Waiting";
        break;
      }
      if (!h || !h.includes("next actions")) continue;

      const name = parsePath(t.path); // o tu función para obtener proyecto
      const p = (globalCache.projects[name] ??= { total: 0, done: 0 });

      p.total++;
      if (t.completed) p.done++;
    }
    for (const k in globalCache.projects) {
      const p = globalCache.projects[k];
      p.completion = p.total ? p.done / p.total : 0;
      if (p.total === p.done) {
        projectStatus = "Finished";
      }
      if (p.total === 0) {
        projectStatus = "Empty";
      }
      p.projectStatus = projectStatus;
    }
    globalCache.paginator.pageSize = Object.keys(globalCache.projects).length;
  }

  async function indexScoped(
    birthdaysAll,
    journalAll,
    financesAll,
    scope,
    ref,
  ) {
    for (const file of journalAll) {
      const day = ensureDay(file.day);
      day.page = file;

      for (const item of file.lists) {
        const header = item.header?.toString().toLowerCase() ?? "";

        if (header.includes("habits") && inScope(file.day, ref, scope)) {
          day.habits[item.text] = item.completed;
          globalCache.habits.add(item.text);
        }

        if (header.includes("planes")) {
          day.events.push({
            text: parseEvent(item.text),
            isBirthday: false,
          });
        }
      }
    }

    // birthdays
    for (const b of birthdaysAll) {
      const date = handleBirthdays(b.frontmatter.birth, ref);
      if (!inScope(date, ref, scope)) continue;

      const day = ensureDay(date);
      day.events.push({
        text: parseBirthdayNote(b.name, b.aliases),
        isBirthday: true,
      });
    }

    // health series
    const days = scope === "week" ? daysOfWeek(ref) : daysOfMonth(ref);

    for (const day of days) {
      const entry = ensureDay(day);
      const page = entry.page;
      const date = day.toFormat("dd");
      globalCache.healthIndex.days.push(date);

      let hours = null;
      let quality = null;
      let water = null;

      if (page) {
        const p = page.frontmatter;

        if (p.waketime || p.bedtime || p.sleepQuality || p.waterIntake)
          globalCache.healthIndex.isEmpty = false;
        if (p.waketime && p.bedtime) hours = diffHours(p.waketime, p.bedtime);
        if (p.sleepQuality) quality = Number(p.sleepQuality);
        if (p.waterIntake) water = Number(p.waterIntake);
      }

      globalCache.healthIndex.quality.push(quality);
      globalCache.healthIndex.water.push(water);
      globalCache.healthIndex.hours.push(hours);
    }

    let checkpoints;
    if (json) {
      checkpoints = JSON.parse(json);
      let snapshot = checkpoints[monthIndexer(globalCache.ref)];

      const specialSet = new Set(Object.keys(specialHandlers));

      for (const item of financesAll) {
        const m = item.text.match(moneyRegex);
        if (!m) continue;
        const raw = Number(m[1].replace(",", "."));
        if (Number.isNaN(raw)) continue;

        const tags = item.tags ?? [];
        const iso = parsePath(item.path);
        const date = item.task ? item.completion : DateTime.fromISO(iso);

        let category = null,
          handler = null,
          deltas = null;

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
          deltas = handler(raw, category, item.completed, item);
        } else {
          deltas = handlers["default"](raw, category);
        }

        if (!deltas)
          // si es una deuda pendiente, no agregar
          continue;

        if (inScope(date, globalCache.ref, globalCache.scope)) {
          if (raw >= 0) {
            globalCache.finance.scoped.income += raw;
          } else {
            globalCache.finance.scoped.expense += Math.abs(raw);
            if (deltas.cat) {
              globalCache.finance.scoped.byCategory[deltas.cat] ??= [];
              globalCache.finance.scoped.byCategory[deltas.cat] +=
                Math.abs(raw);
            }
            if (deltas.type === "efectivo") {
              globalCache.finance.scoped.cash += Math.abs(raw);
            }
            if (deltas.type === "cuenta corriente") {
              globalCache.finance.scoped.card += Math.abs(raw);
            }
          }
        }
        // calcular snapshot
        snapshot = calcSnapshotAtMovement(deltas, snapshot);

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
          snapshot,
        };

        const month = monthIndexer(date);

        globalCache.finance.byMonth[month] ??= [];
        globalCache.finance.byMonth[month].push(movInScope);
      }
      // poner los ultimos
      globalCache.finance.scoped.snapshot = snapshot;
    }
  }

  /* indexa todas las entradas necesarias en la GlobalCache */
  async function index({ projectsAll, birthdaysAll, journalAll, financesAll }) {
    if (!globalCache.init) {
      indexGlobal(projectsAll);
    }
    await indexScoped(
      birthdaysAll,
      journalAll,
      financesAll,
      globalCache.scope,
      globalCache.ref,
    );
  }

  /* UI renderizacion */
  const root = dv.container;
  root.textContent = "";

  const projectsCanvas = document.createElement("div");
  projectsCanvas.className = "project-canvas";

  const controls = document.createElement("div");
  controls.className = "dashboard-controls";

  const scopeSelect = document.createElement("select");
  scopeSelect.innerHTML = `<option value="week">semanal</option><option value="month">mensual</option>`;

  const navPrev = document.createElement("button");
  navPrev.dataset.nav = "prev";
  navPrev.textContent = "◀";

  const navLabel = document.createElement("span");
  navLabel.className = "nav-label";

  const navNext = document.createElement("button");
  navNext.dataset.nav = "next";
  navNext.textContent = "▶";

  controls.append(scopeSelect, navPrev, navLabel, navNext);

  const calendarSpace = document.createElement("div");
  calendarSpace.className = "calendar-wrap";

  const sleepSpace = document.createElement("div");
  navPrev.dataset.nav = "prev";
  const financeSpace = document.createElement("div");
  navLabel.className = "nav-label";
  financeSpace.className = "finance-wrap";

  let sleepChart, expenseChart, financeChart;
  root.append(
    projectsCanvas,
    controls,
    calendarSpace,
    sleepSpace,
    financeSpace,
  );

  const projectCardTemplate = (() => {
    const card = document.createElement("div");
    card.className = "project-card";

    let title = document.createElement("span");
    title.className = "project-title";

    let status = document.createElement("div");

    let bar = document.createElement("progress");

    card.append(title, bar, status);
    return card;
  })();

  function getProjectsArray() {
    return Object.entries(globalCache.projects);
  }

  function getTotalPages(items) {
    return Math.ceil(items.length / globalCache.paginator.pageSize);
  }

  function paginate(items) {
    const start = globalCache.paginator.page * globalCache.paginator.pageSize;
    return items.slice(start, start + globalCache.paginator.pageSize);
  }

  function renderProjects() {
    const items = getProjectsArray();
    const totalPages = getTotalPages(items);

    const frag = document.createDocumentFragment();

    // controls
    const controls = document.createElement("div");
    controls.className = "dashboard-controls";

    const prev = document.createElement("button");
    prev.className = "prevButton";
    prev.textContent = "◀";
    prev.disabled = globalCache.paginator.page === 0;

    const label = document.createElement("span");
    label.textContent = `${globalCache.paginator.page + 1} / ${totalPages}`;

    const next = document.createElement("button");
    next.className = "nextButton";
    next.textContent = "▶";
    next.disabled = globalCache.paginator.page >= totalPages - 1;

    controls.append(prev, label, next);

    controls.addEventListener("click", (event) => {
      if (
        event.target.closest(".prevButton") &&
        globalCache.paginator.page > 0
      ) {
        globalCache.paginator.page--;
        renderProjects();
      }

      if (
        event.target.closest(".nextButton") &&
        globalCache.paginator.page < totalPages - 1
      ) {
        globalCache.paginator.page++;
        renderProjects();
      }
    });

    // cards
    const cards = document.createElement("div");
    cards.className = "projects-page";

    const pageItems = paginate(items);

    for (const [name, p] of pageItems) {
      const card = projectCardTemplate.cloneNode(true);

      const title = card.children[0];
      const bar = card.children[1];
      const status = card.children[2];

      title.textContent = name;
      bar.title = `Completado ${p.completion.toFixed(2) * 100}%`;
      bar.value = p.done || 0;
      bar.max = p.total || 1;
      status.textContent = p.projectStatus;

      cards.appendChild(card);
    }

    frag.append(controls, cards);
    projectsCanvas.replaceChildren(frag);
  }

  function renderPaginator() {
    navLabel.textContent =
      globalCache.scope === "week"
        ? `semana ${globalCache.ref.weekNumber} · ${globalCache.ref.year}`
        : globalCache.ref.toFormat("LLLL yyyy");
  }

  /** abre el archivo recibido, y lo crea en caso de no existir, por defecto crea una pagina de journal */
  async function openOrCreateFile(
    f,
    temp = "templates/Daily.md",
    dest = "journal",
  ) {
    const path = `${dest}/${f}.md`;
    let file = app.vault.getAbstractFileByPath(path);
    if (!file) {
      const templater = app.plugins.plugins["templater-obsidian"];
      const template = app.vault.getAbstractFileByPath(temp);
      if (templater && template)
        await templater.templater.create_new_note_from_template(
          template,
          dest,
          f,
        );
      else await app.vault.create(path, "");
      file = app.vault.getAbstractFileByPath(path);
    }
    app.workspace.getLeaf().openFile(file);
  }

  function renderCalendar() {
    // crear una tabla
    const table = document.createElement("table");

    // anyadir los dias de la semana
    const headerRow = document.createElement("tr");
    const month = document.createElement("tr");
    month.className = "month-link";
    month.dataset.iso = `${globalCache.ref.toFormat("yyyy-MM")}`;
    month.textContent = `${globalCache.ref.toFormat("LLLL")}`;
    headerRow.appendChild(month);
    CONFIG.WEEKDAYS.forEach((w) => {
      const th = document.createElement("th");
      th.textContent = w;
      headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    function createDayCell(day) {
      const td = document.createElement("td");
      if (globalCache.scope === "month") {
        td.className =
          day.month === globalCache.ref.month ? "current-month" : "other-month";
      } else {
        td.className = "current-month";
      }

      const span = document.createElement("span");
      span.className = "day-link";
      span.dataset.iso = day.toISODate();
      span.textContent = day.day;

      td.appendChild(span);
      return td;
    }

    function createPlanCell(day, weekIndex) {
      const td = document.createElement("td");
      const iso = day.toISODate();
      const events = weekIndex[iso]?.events ?? [];
      td.className = "plain-cell";

      if (events.length && day.month === globalCache.ref.month) {
        td.className = "plan-cell";
        const hasBirthday = events.some((e) => e.isBirthday);
        const hasPlan = events.some((e) => !e.isBirthday);
        td.textContent = hasBirthday ? "🎂" : hasPlan ? "🗓️" : "";
        td.title = events.map((e) => e.text).join("\n");
      }

      return td;
    }

    /** Renderiza los habitos de una semana en la tabla */
    function createHabitRow(habit, week, weekIndex) {
      const tr = document.createElement("tr");
      const htd = document.createElement("td");
      htd.textContent = habit;
      tr.appendChild(htd);

      const todayISO = DateTime.now().toISODate();

      for (const d of week) {
        const td = document.createElement("td");
        td.className = "plain-cell";
        const iso = d.toISODate();
        const done = weekIndex[iso]?.habits?.[habit];

        if (iso > todayISO || weekIndex[iso] === undefined)
          td.textContent = " ";
        else if (done === undefined) td.textContent = "—";
        else td.textContent = done ? "✔" : "✘";

        tr.appendChild(td);
      }

      return tr;
    }

    // recalcular el scope
    const weeksToRender =
      globalCache.scope === "week"
        ? [daysOfWeek(globalCache.ref)]
        : weeksOfMonth(globalCache.ref);

    // por cada semana
    for (const week of weeksToRender) {
      // obtener la semana y consultar el weekIndex
      const isoWeek = weekIndexer(week[0]);
      const weekIndex = globalCache.weeks?.[isoWeek]?.days ?? {};

      // day numbers row
      const dayRow = document.createElement("tr");
      const weekLink = document.createElement("tr");
      weekLink.className = "week-link";
      // TODO cambiar esto para que pueda ser seleccionado desde el plugin de periodic reviews
      weekLink.dataset.iso = `${week[0].toFormat("kkkk-MM-'W'WW")}`;
      weekLink.textContent = `${week[0].toFormat("'W'WW")}`;
      dayRow.appendChild(weekLink);

      // plan row
      const planRow = document.createElement("tr");
      const pl = document.createElement("td");
      pl.className = "current-month";
      pl.textContent = "planes";
      planRow.appendChild(pl);
      for (const d of week) {
        dayRow.appendChild(createDayCell(d));
        planRow.appendChild(createPlanCell(d, weekIndex));
      }
      table.appendChild(dayRow);
      table.appendChild(planRow);

      // habits rows (solo hábitos presentes en esta semana)
      const habitsInWeek = new Set();
      for (const dayData of Object.values(weekIndex)) {
        for (const h of Object.keys(dayData.habits || {})) {
          habitsInWeek.add(h);
        }
      }

      for (const habit of habitsInWeek) {
        table.appendChild(createHabitRow(habit, week, weekIndex));
      }
    }

    table.addEventListener("click", (event) => {
      const target = event.target;

      if (target.className.toLowerCase() === "day-link") {
        openOrCreateFile(target.dataset.iso);
      }
      if (target.className.toLowerCase() === "month-link") {
        openOrCreateFile(target.dataset.iso, "templates/Monthly.md", "reviews");
      }
      if (target.className.toLowerCase() === "week-link") {
        openOrCreateFile(target.dataset.iso, "templates/Weekly.md", "reviews");
      }
    });
    calendarSpace.appendChild(table);
  }

  function renderHealth() {
    sleepChart?.destroy();
    sleepChart = null;
    if (globalCache.healthIndex.isEmpty) {
      sleepSpace.style.textAlign = "center";
      sleepSpace.textContent = "Sin registros de salud...";
    } else {
      const canvas = document.createElement("canvas");
      sleepSpace.replaceChildren(canvas);
      sleepChart = new Chart(canvas, {
        type: "line",
        data: {
          labels: globalCache.healthIndex.days,
          datasets: [
            {
              label: "horas de sueño",
              tension: 0.3,
              data: globalCache.healthIndex.hours,
              yAxisID: "yHours",
            },
            {
              label: "calidad de sueño",
              tension: 0.3,
              data: globalCache.healthIndex.quality,
              yAxisID: "yQuality",
            },
            {
              label: "agua",
              tension: 0.3,
              data: globalCache.healthIndex.water,
              yAxisID: "yQuality",
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

  async function renderFinances() {
    let mov = globalCache.finance.byMonth[monthIndexer(globalCache.ref)];
    let total = globalCache.finance.scoped;

    if (financeChart) {
      financeChart.destroy();
      financeChart = null;
    }

    if (expenseChart) {
      expenseChart.destroy();
      expenseChart = null;
    }

    const chartsWrap = document.createElement("div");
    chartsWrap.className = "finance-charts";

    const left = document.createElement("div");
    left.className = "left";

    const right = document.createElement("div");
    right.className = "right";

    const barCanvas = document.createElement("canvas");
    const pieCanvas = document.createElement("canvas");

    left.append(barCanvas);
    right.append(pieCanvas);
    chartsWrap.append(left, right);

    const debtsSpace = document.createElement("div");
    function renderDebts() {
      const data = globalCache.finance.debts;
      const title = document.createElement("h1");
      title.textContent = `Deudas (-${data.totalPagar} +${data.totalCobrar})`;
      debtsSpace.append(
        title,
        TaskListDOM(data.pagar),
        TaskListDOM(data.cobrar),
      );
    }

    function renderCategoriesGraph() {
      const labels = Object.keys(total.byCategory);
      const data = Object.values(total.byCategory);

      expenseChart = new Chart(pieCanvas, {
        type: "pie",
        data: {
          labels,
          datasets: [{ data }],
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
    }

    function renderGraphBar() {
      const financesData = {
        labels: ["gasto", "ingreso", "cuentas"],
        datasets: [
          {
            label: `Tarjeta (total ${total.expense.toFixed(2)})`,
            data: [total.card, null, null],
            stack: "gastos",
            yAxisID: "yMoney",
          },
          {
            label: `Efectivo (total ${total.expense.toFixed(2)})`,
            data: [total.cash, null, null],
            stack: "gastos",
            yAxisID: "yMoney",
          },
          {
            label: "Ingresos",
            data: [null, total.income, null],
            stack: "ingresos",
            yAxisID: "yMoney",
          },
          {
            label: "Ahorro",
            data: [null, null, total.snapshot.savings],
            stack: "cuentas",
            yAxisID: "yAhorro",
          },
          {
            label: "Disponible",
            data: [null, null, total.snapshot.card + total.snapshot.cash],
            stack: "cuentas",
            yAxisID: "yAhorro",
          },
          {
            label: "Meta Ahorro",
            data: [{ x: "cuentas", y: CONFIG.SAVINGS_GOAL }],
            type: "scatter",
            yAxisID: "yAhorro",
            pointRadius: 6,
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
          plugins: { legend: { display: false } },
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

    function renderDetails() {
      const table = document.createElement("table");
      table.className = "finance-table";

      const thead = document.createElement("thead");
      thead.innerHTML =
        "<tr><th>Fecha</th><th>Movimiento</th><th>Monto</th><th>Saldo</th><th>Cuenta</th><th>Efectivo</th></tr>";

      const tbody = document.createElement("tbody");
      const frag = document.createDocumentFragment();

      for (const r of mov) {
        if (!inScope(r.date, globalCache.ref, globalCache.scope)) continue;

        let desc = "";
        const dm = r.text.match(/^(.*?)(?:\s+[+-]?\d|#)/);

        if (dm && dm[1].trim()) desc = dm[1].trim();
        else
          desc = r.text
            .replace(/#\S+/g, "")
            .replace(/[+-]?\d+(?:[.,]\d+)?/g, "")
            .trim();

        const tr = document.createElement("tr");

        const tdDate = document.createElement("td");
        tdDate.className = "col-page";
        tdDate.dataset.date = r.date.toISODate();
        tdDate.textContent = r.date.toFormat("dd-MM");

        const tdDesc = document.createElement("td");
        tdDesc.className = "col-desc";
        tdDesc.textContent = desc;

        const tdAmount = document.createElement("td");
        tdAmount.className = "col-money";
        tdAmount.textContent = parseMoney(r.raw);

        const tdSaldo = document.createElement("td");
        tdSaldo.className = "col-money";
        tdSaldo.textContent = parseMoney(r.snapshot.card + r.snapshot.cash);

        const tdCard = document.createElement("td");
        tdCard.className = "col-money";
        tdCard.textContent = parseMoney(r.snapshot.card);

        const tdCash = document.createElement("td");
        tdCash.className = "col-money";
        tdCash.textContent = parseMoney(r.snapshot.cash);

        tr.append(tdDate, tdDesc, tdAmount, tdSaldo, tdCard, tdCash);
        frag.appendChild(tr);
      }

      tbody.appendChild(frag);
      table.append(thead, tbody);

      table.addEventListener(
        "click",
        (event) => {
          const cell = event.target.closest(".col-page");
          if (cell) openOrCreateFile(cell.dataset.date);
        },
        { passive: true },
      );

      return table;
    }

    const frag = document.createDocumentFragment();

    if (globalCache.finance.debts.isEmpty) renderDebts();
    if (
      globalCache.finance.scoped.income > 0 ||
      globalCache.finance.scoped.expense > 0
    ) {
      renderGraphBar();
      renderCategoriesGraph();
      frag.appendChild(debtsSpace);
      frag.appendChild(chartsWrap);
    }

    if (globalCache.finance.scoped.expense > 0)
      frag.appendChild(renderDetails());

    financeSpace.replaceChildren(frag);
  }

  async function render() {
    if (!globalCache.init) {
      // render projects
      renderProjects();
    }
    renderPaginator();
    renderCalendar();
    renderHealth();
    renderFinances();
  }

  /* ========== CONTROLES: handlers ========== */
  scopeSelect.onchange = (e) => {
    globalCache.scope = e.target.value;
    // reset reference to current when changing scope for clarity
    globalCache.ref = DateTime.now();
    refresh();
  };
  // si haces -1 month sobre el 29 al 31 de marzo, seguirá siendo marzo o te lo reduce al 28 de febrero?
  navPrev.onclick = () => {
    globalCache.ref =
      globalCache.scope === "week"
        ? globalCache.ref.minus({ weeks: 1 })
        : globalCache.ref.minus({ months: 1 });
    refresh();
  };
  navNext.onclick = () => {
    globalCache.ref =
      globalCache.scope === "week"
        ? globalCache.ref.plus({ weeks: 1 })
        : globalCache.ref.plus({ months: 1 });
    refresh();
  };
  /*
   *
   * INITIALIZATION
   *
   */

  const repo = new DataRepository();
  let fetched = null;

  async function init() {
    fetched = repo.fetch();
    await index(fetched);
    await render();
    globalCache.init = true;
  }

  async function refresh() {
    reset();
    fetched = repo.fetch();
    await index(fetched);
    await render();
  }

  function reset() {
    globalCache.weeks = {};
    globalCache.finance = {
      scoped: {
        card: 0,
        cash: 0,
        income: 0,
        expense: 0,
        byCategory: {},
      },
      byMonth: {},
      debts: {
        cobrar: [],
        pagar: [],
        totalCobrar: 0,
        totalPagar: 0,
        isEmpty: true, //  se podría quitar esto y en su lugar hacer un check de si es empty o no para hacer skip??
      },
    };
    globalCache.healthIndex = {
      isEmpty: true,
      days: [],
      quality: [],
      water: [],
      hours: [],
    };
    calendarSpace.innerHTML = "";
  }
  await init();
} catch (error) {
  if (!input) {
    dv.span("> [!error] necesito los brackets {}");
  } else {
    console.log(error);
  }
}
