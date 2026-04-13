const STORAGE_TOKEN = "access_token";
const STATUS_LABELS = {
  refill: "На заправке",
  ready_to_install: "Готов к установке",
  installed: "Установлен",
  broken: "Сломан",
};

let token = localStorage.getItem(STORAGE_TOKEN) || "";
let me = null;
let regions = [];
let cartridges = [];
let selectedCartridge = null;
let searchValue = "";
let regionFilter = "all";

const el = (id) => document.getElementById(id);
const pages = ["page-home", "page-create", "page-regions", "page-detail", "page-work", "page-status"];

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || `Ошибка запроса: ${response.status}`);
  }

  return data;
}

function setAuth(nextToken) {
  token = nextToken;
  if (token) {
    localStorage.setItem(STORAGE_TOKEN, token);
  } else {
    localStorage.removeItem(STORAGE_TOKEN);
  }
}

function canWrite() {
  return me?.role === "admin" || me?.role === "editor";
}

function isAdmin() {
  return me?.role === "admin";
}

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("ru-RU");
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function showLogin(error = "") {
  el("login-screen").classList.remove("hidden");
  el("app-screen").classList.add("hidden");
  el("login-error").textContent = error;
}

function showApp() {
  el("login-screen").classList.add("hidden");
  el("app-screen").classList.remove("hidden");
  el("me-block").textContent = `${me.username} • роль: ${me.role}`;
}

function navigate(path) {
  history.pushState({}, "", path);
  renderRoute();
}

function pageByPath(pathname) {
  if (pathname === "/" || pathname === "/home") return "home";
  if (pathname === "/cartridges/new") return "create";
  if (pathname === "/regions") return "regions";
  if (/^\/cartridges\/\d+\/work$/.test(pathname)) return "work";
  if (/^\/cartridges\/\d+\/status$/.test(pathname)) return "status";
  if (/^\/cartridges\/\d+$/.test(pathname)) return "detail";
  return "home";
}

function currentCartridgeIdFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && parts[0] === "cartridges") {
    const id = Number(parts[1]);
    if (id > 0) return id;
  }
  return null;
}

function hideAllPages() {
  pages.forEach((id) => el(id).classList.add("hidden"));
}

function menuItems() {
  const items = [
    { label: "Главная", path: "/" },
    { label: "Создать картридж", path: "/cartridges/new" },
  ];
  if (isAdmin()) {
    items.push({ label: "Регионы", path: "/regions" });
  }
  return items;
}

function renderMenu() {
  const root = el("menu");
  root.innerHTML = "";
  const current = pageByPath(window.location.pathname);

  menuItems().forEach((item) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = item.label;
    const key = pageByPath(item.path);
    if (key === current) b.classList.add("active");
    b.addEventListener("click", () => navigate(item.path));
    root.appendChild(b);
  });
}

function smartScore(c, query) {
  if (!query) return 1;
  const q = query.toLowerCase();
  const name = (c.name || "").toLowerCase();
  const model = (c.model || "").toLowerCase();
  const serial = (c.serial_number || "").toLowerCase();
  const num = (c.formatted_number || "").toLowerCase();
  let score = 0;

  if (name === q) score += 120;
  if (name.startsWith(q)) score += 80;
  if (name.includes(q)) score += 45;
  if (model.includes(q)) score += 30;
  if (serial.includes(q)) score += 25;
  if (num.includes(q)) score += 35;
  if (name.split(" ").some((w) => w.startsWith(q))) score += 15;

  return score;
}

function filteredCartridges() {
  return cartridges
    .filter((c) => {
      if (regionFilter === "all") return true;
      const id = c.region?.id ? String(c.region.id) : "none";
      return id === regionFilter;
    })
    .map((c) => ({ c, score: smartScore(c, searchValue) }))
    .filter((x) => (searchValue ? x.score > 0 : true))
    .sort((a, b) => b.score - a.score || new Date(b.c.created_at) - new Date(a.c.created_at))
    .map((x) => x.c);
}

async function loadInitialData() {
  [cartridges, regions] = await Promise.all([api("/cartridges"), api("/regions")]);
}

function renderHomePage() {
  const page = el("page-home");
  const list = filteredCartridges();

  page.innerHTML = `
    <div class="section-title">
      <h2>Все картриджи</h2>
      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        <span class="muted">${list.length} шт.</span>
        <button type="button" id="export-excel" class="ghost">Экспорт Excel</button>
      </div>
    </div>
    <div class="toolbar">
      <input id="home-search" placeholder="Умный поиск по имени, модели, номеру, серийному..." value="${searchValue.replace(/"/g, "&quot;")}" />
      <select id="home-region-filter">
        <option value="all">Все регионы</option>
        <option value="none">Без региона</option>
        ${regions
          .map((r) => `<option value="${r.id}">${r.name} (${r.code ?? "-"})</option>`)
          .join("")}
      </select>
    </div>
    <div id="home-cards" class="cards"></div>
  `;

  const regionSelect = el("home-region-filter");
  regionSelect.value = regionFilter;

  el("home-search").addEventListener("input", (e) => {
    searchValue = e.target.value.trim();
    renderHomePage();
  });

  regionSelect.addEventListener("change", (e) => {
    regionFilter = e.target.value;
    renderHomePage();
  });

  const root = el("home-cards");
  if (!list.length) {
    root.innerHTML = `<div class="panel muted">Ничего не найдено. Попробуйте изменить фильтр или запрос.</div>`;
    return;
  }

  root.innerHTML = list
    .map(
      (c) => `
      <article class="card-tile">
        <div class="tile-row">
          <strong>${c.name}</strong>
          <span class="chip">${statusLabel(c.status)}</span>
        </div>
        <div class="muted">${c.model}</div>
        <div class="muted">№ ${c.formatted_number || "-"}</div>
        <div class="muted">Регион: ${c.region?.name || "Не выбран"}</div>
        <button type="button" data-id="${c.id}">Открыть историю</button>
      </article>
    `
    )
    .join("");

  root.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigate(`/cartridges/${btn.dataset.id}`);
    });
  });

  el("export-excel").addEventListener("click", () => {
    exportExcel().catch((err) => alert(err.message));
  });
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeSheetName(name) {
  return String(name)
    .replace(/[\\\/?*\[\]:]/g, " ")
    .slice(0, 31);
}

function worksheetXml(name, rows) {
  const rowXml = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell) => {
          const style = rowIndex === 0 ? ' ss:StyleID="Header"' : "";
          return `<Cell${style}><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`;
        })
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  return `
    <Worksheet ss:Name="${escapeXml(safeSheetName(name))}">
      <Table>
        ${rowXml}
      </Table>
    </Worksheet>
  `;
}

function downloadBlob(filename, blob, mimeType) {
  const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function collectExportData() {
  const [cartridgeList, regionList] = await Promise.all([api("/cartridges"), api("/regions")]);
  const details = await Promise.all(cartridgeList.map((c) => api(`/cartridges/${c.id}`)));

  const cartridgesSheet = [["ID", "Название", "Модель", "Серийный номер", "Регион", "Номер", "Статус", "Комментарий", "Создан"]];
  const worksSheet = [["ID работы", "ID картриджа", "Картридж", "Описание", "Примечание", "Дата", "Исполнитель"]];
  const statusesSheet = [["ID записи", "ID картриджа", "Картридж", "Было", "Стало", "Причина", "Дата", "Кто изменил"]];
  const regionsSheet = [["ID", "Регион", "Код", "Создан"]];

  details.forEach((c) => {
    cartridgesSheet.push([
      c.id,
      c.name,
      c.model,
      c.serial_number || "",
      c.region?.name || "Без региона",
      c.formatted_number || c.number || "",
      statusLabel(c.status),
      c.comment || "",
      fmtDate(c.created_at),
    ]);

    (c.works || []).forEach((w) => {
      worksSheet.push([
        w.id,
        c.id,
        c.name,
        w.description || "",
        w.note || "",
        fmtDate(w.performed_at),
        w.performed_by?.username || "",
      ]);
    });

    (c.status_logs || []).forEach((s) => {
      statusesSheet.push([
        s.id,
        c.id,
        c.name,
        statusLabel(s.from_status),
        statusLabel(s.to_status),
        s.reason || "",
        fmtDate(s.changed_at),
        s.changed_by?.username || "",
      ]);
    });
  });

  regionList.forEach((r) => {
    regionsSheet.push([r.id, r.name, r.code ?? "", fmtDate(r.created_at)]);
  });

  return {
    generatedAt: new Date(),
    cartridgesSheet,
    worksSheet,
    statusesSheet,
    regionsSheet,
  };
}

async function exportExcel() {
  const data = await collectExportData();
  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
   <Style ss:ID="Default" ss:Name="Normal">
     <Alignment ss:Vertical="Bottom"/>
     <Font ss:FontName="Calibri" ss:Size="11"/>
   </Style>
   <Style ss:ID="Header">
     <Font ss:Bold="1"/>
     <Interior ss:Color="#DFF7F4" ss:Pattern="Solid"/>
   </Style>
 </Styles>
 ${worksheetXml("Картриджи", data.cartridgesSheet)}
 ${worksheetXml("Работы", data.worksSheet)}
 ${worksheetXml("Статусы", data.statusesSheet)}
 ${worksheetXml("Регионы", data.regionsSheet)}
</Workbook>`;

  const stamp = data.generatedAt.toISOString().slice(0, 19).replace(/[T:]/g, "-");
  downloadBlob(`export-${stamp}.xls`, workbook, "application/vnd.ms-excel;charset=utf-8");
}

async function fetchNameSuggestions(query) {
  const q = query.trim();
  return api(`/cartridges/name-suggestions${q ? `?query=${encodeURIComponent(q)}` : ""}`);
}

async function fetchNextNumber(regionId) {
  const q = regionId ? `?region_id=${regionId}` : "";
  return api(`/cartridges/next-number${q}`);
}

function renderCreatePage() {
  const page = el("page-create");
  if (!canWrite()) {
    page.innerHTML = `<div class="panel muted">У вас нет прав для создания картриджей.</div>`;
    return;
  }

  page.innerHTML = `
    <div class="section-title">
      <h2>Создание картриджа</h2>
      <span class="muted">Автогенерация номера по региону</span>
    </div>
    <form id="create-cartridge-form" class="grid-two">
      <div class="panel">
        <label>
          Название
          <input id="cartridge-name" required />
        </label>
        <div id="name-suggest-box" class="name-suggest hidden"></div>

        <label>
          Модель (по умолчанию = названию)
          <input id="cartridge-model" />
        </label>

        <label>
          Серийный номер
          <input id="cartridge-serial" />
        </label>

        <label>
          Регион
          <select id="cartridge-region">
            <option value="">Без региона</option>
            ${regions.map((r) => `<option value="${r.id}">${r.name} (${r.code ?? "-"})</option>`).join("")}
          </select>
        </label>
      </div>

      <div class="panel">
        <label>
          Номер (по умолчанию +1)
          <input id="cartridge-number" type="number" min="1" required />
        </label>

        <label>
          Форматированный номер
          <input id="cartridge-formatted" disabled />
        </label>

        <label>
          Статус
          <select id="cartridge-status">
            <option value="refill">${statusLabel("refill")}</option>
            <option value="ready_to_install">${statusLabel("ready_to_install")}</option>
            <option value="installed">${statusLabel("installed")}</option>
            <option value="broken">${statusLabel("broken")}</option>
          </select>
        </label>

        <label>
          Комментарий
          <textarea id="cartridge-comment" rows="4"></textarea>
        </label>

        <button type="submit">Создать картридж</button>
        <p id="create-cartridge-msg" class="muted"></p>
      </div>
    </form>
  `;

  const nameInput = el("cartridge-name");
  const modelInput = el("cartridge-model");
  const regionSelect = el("cartridge-region");
  const numberInput = el("cartridge-number");
  const formattedInput = el("cartridge-formatted");
  const suggestBox = el("name-suggest-box");

  let suggestionTimer = null;

  const renderFormatted = () => {
    const regionId = regionSelect.value ? Number(regionSelect.value) : null;
    const region = regions.find((r) => r.id === regionId);
    const num = Number(numberInput.value);
    if (!region || !region.code || !num) {
      formattedInput.value = "";
      return;
    }
    formattedInput.value = `${Number(region.code)}_${String(num).padStart(4, "0")}`;
  };

  const updateDefaultNumber = async () => {
    try {
      const regionId = regionSelect.value ? Number(regionSelect.value) : null;
      const next = await fetchNextNumber(regionId);
      numberInput.value = String(next.number);
      formattedInput.value = next.formatted_number || "";
      renderFormatted();
    } catch (err) {
      el("create-cartridge-msg").textContent = err.message;
    }
  };

  nameInput.addEventListener("input", () => {
    if (!modelInput.value.trim()) {
      modelInput.value = nameInput.value;
    }

    clearTimeout(suggestionTimer);
    suggestionTimer = setTimeout(async () => {
      try {
        const items = await fetchNameSuggestions(nameInput.value);
        if (!items.length) {
          suggestBox.classList.add("hidden");
          suggestBox.innerHTML = "";
          return;
        }
        suggestBox.innerHTML = items
          .map((item) => `<button type="button" data-name="${item.replace(/"/g, "&quot;")}">${item}</button>`)
          .join("");
        suggestBox.classList.remove("hidden");
        suggestBox.querySelectorAll("button").forEach((btn) => {
          btn.addEventListener("click", () => {
            nameInput.value = btn.dataset.name;
            if (!modelInput.value.trim()) modelInput.value = btn.dataset.name;
            suggestBox.classList.add("hidden");
          });
        });
      } catch (_) {
        suggestBox.classList.add("hidden");
      }
    }, 250);
  });

  regionSelect.addEventListener("change", updateDefaultNumber);
  numberInput.addEventListener("input", renderFormatted);

  el("create-cartridge-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      name: nameInput.value.trim(),
      model: modelInput.value.trim() || nameInput.value.trim(),
      serial_number: el("cartridge-serial").value.trim() || undefined,
      region_id: regionSelect.value ? Number(regionSelect.value) : undefined,
      number: Number(numberInput.value),
      comment: el("cartridge-comment").value.trim() || undefined,
      status: el("cartridge-status").value,
    };

    try {
      const created = await api("/cartridges", {
        method: "POST",
        body: JSON.stringify(data),
      });
      el("create-cartridge-msg").textContent = `Картридж создан: ${created.name}`;
      await loadInitialData();
      navigate(`/cartridges/${created.id}`);
    } catch (err) {
      el("create-cartridge-msg").textContent = err.message;
    }
  });

  updateDefaultNumber();
}

function renderRegionsPage() {
  const page = el("page-regions");
  if (!isAdmin()) {
    page.innerHTML = `<div class="panel muted">Раздел регионов доступен только администратору.</div>`;
    return;
  }

  page.innerHTML = `
    <div class="section-title">
      <h2>Регионы</h2>
      <span class="muted">Используются при создании картриджей</span>
    </div>
    <div class="grid-two">
      <div class="panel">
        <h3>Список регионов</h3>
        <div class="timeline">
          ${regions
            .map(
              (r) => `
            <div class="timeline-item">
              <div><strong>${r.name}</strong></div>
              <div class="muted">Код: ${r.code ?? "-"}</div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
      <form id="region-create-form" class="panel">
        <h3>Создать регион</h3>
        <label>
          Название
          <input id="region-name" required />
        </label>
        <label>
          Код
          <input id="region-code" type="number" min="0" max="9999" required />
        </label>
        <button type="submit">Создать</button>
        <p id="region-msg" class="muted"></p>
      </form>
    </div>
  `;

  el("region-create-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/regions", {
        method: "POST",
        body: JSON.stringify({
          name: el("region-name").value.trim(),
          code: Number(el("region-code").value),
        }),
      });
      el("region-msg").textContent = "Регион создан";
      await loadInitialData();
      renderRegionsPage();
    } catch (err) {
      el("region-msg").textContent = err.message;
    }
  });
}

function renderDetailPage(cartridge) {
  const page = el("page-detail");
  const works = [...(cartridge.works || [])].sort((a, b) => new Date(b.performed_at || b.created_at) - new Date(a.performed_at || a.created_at));
  const statusLogs = [...(cartridge.status_logs || [])].sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));

  page.innerHTML = `
    <div class="section-title">
      <h2>${cartridge.name}</h2>
      <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
        ${canWrite() ? `<button type="button" id="go-work" class="ghost">Добавить работу</button>` : ""}
        ${canWrite() ? `<button type="button" id="go-status" class="ghost">Изменить статус</button>` : ""}
        <button type="button" id="back-home" class="ghost">Назад к списку</button>
      </div>
    </div>
    <div class="panel">
      <div class="muted">Модель: ${cartridge.model}</div>
      <div class="muted">Номер: ${cartridge.formatted_number || "-"}</div>
      <div class="muted">Регион: ${cartridge.region?.name || "Не выбран"}</div>
      <div class="muted">Статус: <span class="status-pill">${statusLabel(cartridge.status)}</span></div>
    </div>

    <div class="panel" style="margin-top: 12px">
      <div class="section-title">
        <h3>История картриджа</h3>
        <div style="display:flex; gap:8px;">
          <button type="button" id="history-tab-works" class="ghost">Работы</button>
          <button type="button" id="history-tab-status" class="ghost">Статусы</button>
        </div>
      </div>
      <div id="history-list" class="timeline"></div>
    </div>
  `;

  el("back-home").addEventListener("click", () => navigate("/"));

  if (canWrite()) {
    el("go-work").addEventListener("click", () => navigate(`/cartridges/${cartridge.id}/work`));
    el("go-status").addEventListener("click", () => navigate(`/cartridges/${cartridge.id}/status`));
  }

  const tabWorks = el("history-tab-works");
  const tabStatus = el("history-tab-status");
  const listRoot = el("history-list");

  const renderWorksHistory = () => {
    tabWorks.classList.add("active");
    tabStatus.classList.remove("active");
    listRoot.innerHTML = works.length
      ? works
          .map(
            (w) => `
          <article class="timeline-item work">
            <div><strong>Работа</strong> • ${fmtDate(w.performed_at)}</div>
            <div>${w.description}</div>
            ${w.note ? `<div class="muted">Примечание: ${w.note}</div>` : ""}
            <div class="muted">Исполнитель: ${w.performed_by?.username || "-"}</div>
          </article>
        `
          )
          .join("")
      : '<div class="muted">История работ пока пуста</div>';
  };

  const renderStatusHistory = () => {
    tabStatus.classList.add("active");
    tabWorks.classList.remove("active");
    listRoot.innerHTML = statusLogs.length
      ? statusLogs
          .map(
            (s) => `
          <article class="timeline-item status">
            <div><strong>Изменение статуса</strong> • ${fmtDate(s.changed_at)}</div>
            <div>${statusLabel(s.from_status)} → ${statusLabel(s.to_status)}</div>
            ${s.reason ? `<div class="muted">Причина: ${s.reason}</div>` : ""}
            <div class="muted">Кто изменил: ${s.changed_by?.username || "-"}</div>
          </article>
        `
          )
          .join("")
      : '<div class="muted">История статусов пока пуста</div>';
  };

  tabWorks.addEventListener("click", renderWorksHistory);
  tabStatus.addEventListener("click", renderStatusHistory);
  renderWorksHistory();
}

function renderWorkPage(cartridge) {
  const page = el("page-work");
  if (!canWrite()) {
    page.innerHTML = `<div class="panel muted">У вас нет прав для добавления работ.</div>`;
    return;
  }

  page.innerHTML = `
    <div class="section-title">
      <h2>Добавить работу: ${cartridge.name}</h2>
      <button type="button" id="back-detail-from-work" class="ghost">Назад к картриджу</button>
    </div>
    <form id="work-create-form" class="panel">
      <label>
        Описание
        <textarea id="detail-work-description" required></textarea>
      </label>
      <label>
        Примечание
        <textarea id="detail-work-note"></textarea>
      </label>
      <label>
        Дата
        <input id="detail-work-date" type="date" required />
      </label>
      <button type="submit">Сохранить работу</button>
      <p id="detail-work-msg" class="muted"></p>
    </form>
  `;

  el("detail-work-date").value = new Date().toISOString().slice(0, 10);
  el("back-detail-from-work").addEventListener("click", () => navigate(`/cartridges/${cartridge.id}`));
  el("work-create-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/works", {
        method: "POST",
        body: JSON.stringify({
          cartridge_id: cartridge.id,
          description: el("detail-work-description").value.trim(),
          note: el("detail-work-note").value.trim() || undefined,
          performed_at: new Date(el("detail-work-date").value).toISOString(),
        }),
      });
      navigate(`/cartridges/${cartridge.id}`);
    } catch (err) {
      el("detail-work-msg").textContent = err.message;
    }
  });
}

function renderStatusPage(cartridge) {
  const page = el("page-status");
  if (!canWrite()) {
    page.innerHTML = `<div class="panel muted">У вас нет прав для изменения статуса.</div>`;
    return;
  }

  page.innerHTML = `
    <div class="section-title">
      <h2>Изменить статус: ${cartridge.name}</h2>
      <button type="button" id="back-detail-from-status" class="ghost">Назад к картриджу</button>
    </div>
    <form id="status-update-form" class="panel">
      <label>
        Статус
        <select id="detail-status">
          <option value="refill" ${cartridge.status === "refill" ? "selected" : ""}>${statusLabel("refill")}</option>
          <option value="ready_to_install" ${cartridge.status === "ready_to_install" ? "selected" : ""}>${statusLabel("ready_to_install")}</option>
          <option value="installed" ${cartridge.status === "installed" ? "selected" : ""}>${statusLabel("installed")}</option>
          <option value="broken" ${cartridge.status === "broken" ? "selected" : ""}>${statusLabel("broken")}</option>
        </select>
      </label>
      <label>
        Причина
        <textarea id="detail-status-reason"></textarea>
      </label>
      <button type="submit">Обновить статус</button>
      <p id="detail-status-msg" class="muted"></p>
    </form>
  `;

  el("back-detail-from-status").addEventListener("click", () => navigate(`/cartridges/${cartridge.id}`));
  el("status-update-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api(`/cartridges/${cartridge.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: el("detail-status").value,
          status_reason: el("detail-status-reason").value.trim() || undefined,
        }),
      });
      navigate(`/cartridges/${cartridge.id}`);
    } catch (err) {
      el("detail-status-msg").textContent = err.message;
    }
  });
}

async function renderDetailById(id) {
  selectedCartridge = await api(`/cartridges/${id}`);
  renderDetailPage(selectedCartridge);
}

async function renderRoute() {
  if (!token) {
    showLogin();
    return;
  }

  hideAllPages();
  renderMenu();

  const page = pageByPath(window.location.pathname);

  if (page === "home") {
    el("page-home").classList.remove("hidden");
    renderHomePage();
    return;
  }

  if (page === "create") {
    el("page-create").classList.remove("hidden");
    renderCreatePage();
    return;
  }

  if (page === "regions") {
    el("page-regions").classList.remove("hidden");
    renderRegionsPage();
    return;
  }

  if (page === "detail") {
    const id = currentCartridgeIdFromPath();
    if (!id) {
      navigate("/");
      return;
    }
    el("page-detail").classList.remove("hidden");
    await renderDetailById(id);
    return;
  }

  if (page === "work") {
    const id = currentCartridgeIdFromPath();
    if (!id) {
      navigate("/");
      return;
    }
    el("page-work").classList.remove("hidden");
    const cartridge = await api(`/cartridges/${id}`);
    renderWorkPage(cartridge);
    return;
  }

  if (page === "status") {
    const id = currentCartridgeIdFromPath();
    if (!id) {
      navigate("/");
      return;
    }
    el("page-status").classList.remove("hidden");
    const cartridge = await api(`/cartridges/${id}`);
    renderStatusPage(cartridge);
    return;
  }
}

async function bootstrap() {
  if (!token) {
    showLogin();
    return;
  }

  try {
    me = await api("/users/me");
    await loadInitialData();
    showApp();
    await renderRoute();
  } catch (_) {
    setAuth("");
    showLogin("Сессия истекла. Войдите снова.");
  }
}

el("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: el("login-username").value.trim(),
        password: el("login-password").value,
      }),
      headers: {},
    });
    setAuth(data.access_token);
    await bootstrap();
  } catch (err) {
    el("login-error").textContent = err.message;
  }
});

el("logout-btn").addEventListener("click", () => {
  setAuth("");
  me = null;
  showLogin();
});

window.addEventListener("popstate", () => {
  renderRoute().catch((err) => alert(err.message));
});

bootstrap();
