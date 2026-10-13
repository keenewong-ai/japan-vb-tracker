(() => {
  const HKT = "Asia/Hong_Kong";
  let matches = [];
  let players = [];
  let meta = {};
  let activeTab = "upcoming";
  let genderFilter = "all";

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  async function loadJson(path) {
    const res = await fetch(path + "?t=" + Date.now());
    if (!res.ok) throw new Error("Failed to load " + path);
    return res.json();
  }

  function parseDt(iso) {
    return new Date(iso);
  }

  function formatHkt(iso) {
    const d = parseDt(iso);
    if (Number.isNaN(d.getTime())) return iso || "時間待定";
    return new Intl.DateTimeFormat("zh-HK", {
      timeZone: HKT,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d) + " HKT";
  }

  function relativeLabel(iso) {
    const d = parseDt(iso);
    if (Number.isNaN(d.getTime())) return "";
    const now = Date.now();
    const diff = d.getTime() - now;
    const abs = Math.abs(diff);
    const mins = Math.round(abs / 60000);
    const hours = Math.round(abs / 3600000);
    const days = Math.round(abs / 86400000);
    if (abs < 60000) return diff >= 0 ? "就嚟開波" : "啱啱完";
    if (mins < 60) return diff >= 0 ? `${mins} 分鐘後` : `${mins} 分鐘前`;
    if (hours < 48) return diff >= 0 ? `${hours} 小時後` : `${hours} 小時前`;
    return diff >= 0 ? `${days} 日後` : `${days} 日前`;
  }

  function genderOk(m) {
    return genderFilter === "all" || m.gender === genderFilter;
  }

  function sortUpcoming(a, b) {
    return parseDt(a.datetime) - parseDt(b.datetime);
  }
  function sortPast(a, b) {
    return parseDt(b.datetime) - parseDt(a.datetime);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function matchCardHtml(m) {
    const players = (m.japanPlayers || [])
      .map((p) => `<span class="chip">${esc(p)}</span>`)
      .join("");
    const score = m.score
      ? `<span class="score">${esc(m.score)}</span>`
      : "";
    const venue = m.venue ? `<span>📍 ${esc(m.venue)}</span>` : "";
    const broadcast = m.broadcast ? `<span>📺 ${esc(m.broadcast)}</span>` : "";
    const rel = relativeLabel(m.datetime);
    return `
      <article class="match-card" tabindex="0" data-id="${esc(m.id)}" role="button" aria-label="${esc(m.home)} vs ${esc(m.away)}">
        <div class="match-top">
          <span class="badge ${esc(m.gender)}">${m.gender === "men" ? "男排" : "女排"}</span>
          <span class="badge ${esc(m.status)}">${m.status === "upcoming" ? "即將" : "完場"}</span>
          <span class="comp">${esc(m.competition || "")}</span>
        </div>
        <div class="match-teams">
          <span>${esc(m.home)}</span>
          <span class="vs">vs</span>
          <span>${esc(m.away)}</span>
          ${score}
        </div>
        <div class="match-meta">
          <span>🕐 ${esc(formatHkt(m.datetime))}${rel ? ` · ${esc(rel)}` : ""}</span>
          ${venue}
          ${broadcast}
        </div>
        ${players ? `<div class="japan-players">${players}</div>` : ""}
      </article>`;
  }

  function playerCardHtml(p) {
    const pos = p.position ? `<span class="pos">${esc(p.position)}</span>` : "";
    const clubBits = [p.club, p.league].filter(Boolean).join(" · ");
    const photo = p.photo || "assets/players/placeholder.svg";
    return `
      <article class="player-card">
        <img class="player-photo" src="${esc(photo)}" alt="${esc(p.name)}" loading="lazy" width="56" height="56"
          onerror="this.onerror=null;this.src='assets/players/placeholder.svg';" />
        <div class="player-body">
          <div class="player-head">
            <div>
              <div class="name">${esc(p.name)}</div>
              ${p.nameEn ? `<div class="en">${esc(p.nameEn)}</div>` : ""}
            </div>
            <div class="player-tags">
              <span class="badge ${esc(p.gender)}">${p.gender === "men" ? "男排" : "女排"}</span>
              ${pos}
            </div>
          </div>
          ${clubBits ? `<div class="club">${esc(clubBits)}</div>` : ""}
          ${p.note ? `<div class="club">${esc(p.note)}</div>` : ""}
        </div>
      </article>`;
  }

  function renderPanels() {
    const upcoming = matches
      .filter((m) => m.status === "upcoming" && genderOk(m))
      .sort(sortUpcoming);
    const past = matches
      .filter((m) => m.status === "final" && genderOk(m))
      .sort(sortPast);
    const plist = players
      .filter((p) => genderFilter === "all" || p.gender === genderFilter)
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));

    const upEl = $("#panel-upcoming");
    const pastEl = $("#panel-past");
    const plEl = $("#panel-players");

    upEl.innerHTML = upcoming.length
      ? `<div class="match-list">${upcoming.map(matchCardHtml).join("")}</div>`
      : `<div class="empty">暫時冇即將開波嘅賽事</div>`;
    pastEl.innerHTML = past.length
      ? `<div class="match-list">${past.map(matchCardHtml).join("")}</div>`
      : `<div class="empty">暫時冇過往賽果</div>`;
    plEl.innerHTML = plist.length
      ? `<div class="player-list">${plist.map(playerCardHtml).join("")}</div>`
      : `<div class="empty">暫時冇球員資料</div>`;

    $$(".match-card", upEl).forEach(bindMatch);
    $$(".match-card", pastEl).forEach(bindMatch);
  }

  function bindMatch(el) {
    const open = () => openMatch(el.dataset.id);
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  }

  function openMatch(id) {
    const m = matches.find((x) => x.id === id);
    if (!m) return;
    const body = $("#modal-body");
    const setHtml = (m.setScores || [])
      .map((s) => `<span>${esc(s)}</span>`)
      .join("");
    const stats = m.playerStats || {};
    const names = Object.keys(stats);
    let statsHtml;
    if (!names.length) {
      statsHtml = `<p class="no-stats">呢場暫時未有球員數據（唔會估分）。</p>`;
    } else {
      statsHtml = `<div class="stats-grid">${names
        .map((name) => {
          const s = stats[name] || {};
          const bits = [];
          if (s.points != null) bits.push(`得分 <strong>${esc(s.points)}</strong>`);
          if (s.attacks != null) bits.push(`攻擊 <strong>${esc(s.attacks)}</strong>`);
          if (s.blocks != null) bits.push(`攔網 <strong>${esc(s.blocks)}</strong>`);
          if (s.serves != null) bits.push(`發球 <strong>${esc(s.serves)}</strong>`);
          return `
            <div class="stat-card">
              <h3>${esc(name)}</h3>
              <div class="stat-row">${bits.join(" · ") || "—"}</div>
              ${s.note ? `<div class="sub" style="margin-top:6px">${esc(s.note)}</div>` : ""}
            </div>`;
        })
        .join("")}</div>`;
    }

    body.innerHTML = `
      <h2 id="modal-title">${esc(m.home)} vs ${esc(m.away)}</h2>
      <div class="sub">
        <span class="badge ${esc(m.gender)}">${m.gender === "men" ? "男排" : "女排"}</span>
        <span class="badge ${esc(m.status)}">${m.status === "upcoming" ? "即將" : "完場"}</span>
        ${esc(m.competition || "")}
      </div>
      <div class="match-meta" style="margin:0 0 8px">
        <span>🕐 ${esc(formatHkt(m.datetime))}</span>
        ${m.venue ? `<span>📍 ${esc(m.venue)}</span>` : ""}
        ${m.broadcast ? `<span>📺 ${esc(m.broadcast)}</span>` : ""}
      </div>
      ${m.score ? `<p style="font-size:1.4rem;font-weight:800;color:var(--accent);margin:8px 0">${esc(m.score)}</p>` : ""}
      ${setHtml ? `<div class="set-scores">${setHtml}</div>` : ""}
      ${(m.japanPlayers || []).length ? `<div class="japan-players" style="margin-bottom:12px">${(m.japanPlayers || []).map((p) => `<span class="chip">${esc(p)}</span>`).join("")}</div>` : ""}
      <h3 style="margin:12px 0 8px;font-size:0.95rem">球員數據</h3>
      ${statsHtml}
      ${m.note ? `<div class="note-box">${esc(m.note)}</div>` : ""}
    `;
    $("#modal").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    $("#modal").hidden = true;
    document.body.style.overflow = "";
  }

  function setTab(name) {
    activeTab = name;
    $$(".tab").forEach((btn) => {
      const on = btn.dataset.tab === name;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    $$(".panel").forEach((p) => {
      const on = p.id === "panel-" + name;
      p.classList.toggle("active", on);
      p.hidden = !on;
    });
  }

  function setGender(g) {
    genderFilter = g;
    $$(".filter").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.gender === g);
    });
    renderPanels();
  }

  function renderMeta() {
    const el = $("#lastUpdated");
    if (!meta.lastUpdated) {
      el.textContent = "更新時間未知";
      return;
    }
    el.textContent = "最後更新：" + formatHkt(meta.lastUpdated);
  }

  async function init() {
    $$(".tab").forEach((btn) =>
      btn.addEventListener("click", () => setTab(btn.dataset.tab))
    );
    $$(".filter").forEach((btn) =>
      btn.addEventListener("click", () => setGender(btn.dataset.gender))
    );
    $$("[data-close]").forEach((el) =>
      el.addEventListener("click", closeModal)
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    try {
      [matches, players, meta] = await Promise.all([
        loadJson("data/matches.json"),
        loadJson("data/players.json"),
        loadJson("data/meta.json"),
      ]);
      renderMeta();
      renderPanels();
      setTab("upcoming");
    } catch (err) {
      $("#panel-upcoming").innerHTML =
        `<div class="empty">載入失敗：${esc(err.message)}<br/>用本地伺服器開（唔好直接 file://）</div>`;
      $("#panel-upcoming").hidden = false;
      $("#panel-upcoming").classList.add("active");
    }
  }

  init();
})();
