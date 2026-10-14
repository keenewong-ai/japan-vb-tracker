(() => {
  const HKT = "Asia/Hong_Kong";
  let matches = [];
  let players = [];
  let playerStatsMap = {};
  let gossip = [];
  let social = [];
  let teamsMap = {};
  let leaguesMap = {};
  let meta = {};
  let activeTab = "upcoming";
  let genderFilter = "all";
  const PHOTO_V = "20261014j";
  const CACHE_V = "20261014j";

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

  const POS_JA = {
    OP: "オポジット",
    OH: "アウトサイドヒッター",
    MB: "ミドルブロッカー",
    S: "セッター",
    L: "リベロ",
    WS: "アウトサイドヒッター",
    OPP: "オポジット",
  };

  function positionLabel(pos) {
    if (!pos) return "";
    return POS_JA[String(pos).toUpperCase()] || pos;
  }


  const ASSET_BASE = "/japan-vb-tracker/";

  function assetUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
    if (path.startsWith("/japan-vb-tracker/")) return path;
    if (path.startsWith("/")) return path;
    return ASSET_BASE + path.replace(/^\.\//, "");
  }

  function teamInitials(name) {
    const s = String(name || "").trim();
    const latin = s.match(/[A-Za-zÀ-ÿ]+/g);
    if (latin && latin.length >= 2) return (latin[0][0] + latin[1][0]).toUpperCase();
    if (latin && latin.length === 1) return latin[0].slice(0, 2).toUpperCase();
    const cjk = s.match(/[\u3040-\u30ff\u4e00-\u9fff]/g);
    if (cjk && cjk.length) return cjk.slice(0, 2).join("");
    return (s.slice(0, 2) || "?").toUpperCase();
  }

  function teamLogoUrl(name) {
    const meta = teamsMap[name];
    const logo = meta && meta.logo;
    if (!logo) return "";
    const base = assetUrl(logo);
    return base + (base.includes("?") ? "&" : "?") + "v=" + CACHE_V;
  }

  function teamNameHtml(name) {
    const logo = teamLogoUrl(name);
    const ini = teamInitials(name);
    const ph = assetUrl("assets/teams/placeholder.svg") + "?v=" + CACHE_V;
    const img = logo
      ? `<img class="team-logo" src="${esc(logo)}" alt="" width="28" height="28" decoding="async" loading="lazy" onerror="this.onerror=null;this.src='${ph}';" />`
      : `<span class="team-logo-fallback" aria-hidden="true">${esc(ini)}</span>`;
    return `<span class="team-with-logo">${img}<span class="team-name">${esc(name)}</span></span>`;
  }

  function leagueMeta(competition) {
    return leaguesMap[competition] || null;
  }

  function competitionHtml(m) {
    const comp = m.competition || "";
    const meta = leagueMeta(comp) || {};
    const country = m.leagueCountry || meta.country || "";
    const flagPath = meta.flag || (m.leagueCountryCode ? `assets/flags/${m.leagueCountryCode}.svg` : "");
    const flagUrl = flagPath ? assetUrl(flagPath) + (flagPath.includes("?") ? "&" : "?") + "v=" + CACHE_V : "";
    const flag = flagUrl
      ? `<img class="league-flag" src="${esc(flagUrl)}" alt="" width="18" height="12" decoding="async" loading="lazy" onerror="this.style.display='none'" />`
      : "";
    const countryHtml = country
      ? `<span class="league-country">${esc(country)}</span>`
      : "";
    return `<span class="comp">${flag}${countryHtml}<span class="league-name">${esc(comp)}</span></span>`;
  }

  function playerByName(name) {
    return players.find((p) => p.name === name) || null;
  }

  function playerPhotoUrl(p) {
    const base = (p && p.photo) || "/japan-vb-tracker/assets/players/placeholder.svg";
    return base + (base.includes("?") ? "&" : "?") + "v=" + PHOTO_V;
  }

  function playerChipHtml(name) {
    const p = playerByName(name);
    const photo = playerPhotoUrl(p);
    const fallback = "/japan-vb-tracker/assets/players/placeholder.svg?v=" + PHOTO_V;
    return `<span class="chip"><img class="chip-avatar" src="${esc(photo)}" alt="" width="22" height="22" decoding="async" loading="lazy" onerror="this.onerror=null;this.src='${fallback}';" /><span class="chip-name">${esc(name)}</span></span>`;
  }

  function matchCardHtml(m) {
    const playerChips = (m.japanPlayers || [])
      .map((p) => playerChipHtml(p))
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
          ${competitionHtml(m)}
        </div>
        <div class="match-teams">
          ${teamNameHtml(m.home)}
          <span class="vs">vs</span>
          ${teamNameHtml(m.away)}
          ${score}
        </div>
        <div class="match-meta">
          <span>🕐 ${esc(formatHkt(m.datetime))}${rel ? ` · ${esc(rel)}` : ""}</span>
          ${venue}
          ${broadcast}
        </div>
        ${playerChips ? `<div class="japan-players">${playerChips}</div>` : ""}
      </article>`;
  }

  function playerCardHtml(p) {
    const posJa = positionLabel(p.position);
    const clubBits = [p.club, p.league].filter(Boolean).join(" · ");
    const base = p.photo || "/japan-vb-tracker/assets/players/placeholder.svg";
    const photo = base + (base.includes("?") ? "&" : "?") + "v=" + PHOTO_V;
    const fallback = "/japan-vb-tracker/assets/players/placeholder.svg?v=" + PHOTO_V;
    const hasStats = !!playerStatsMap[p.id];
    const en = p.nameEn ? String(p.nameEn).toUpperCase() : "";
    return `
      <article class="player-card" tabindex="0" data-player-id="${esc(p.id)}" role="button"
        aria-label="${esc(p.name)} 球員詳情">
        <div class="pc-photo">
          <img class="player-photo" src="${esc(photo)}" alt="${esc(p.name)}"
            decoding="async" loading="lazy"
            onerror="this.onerror=null;this.src='${fallback}';" />
        </div>
        <div class="pc-info">
          ${posJa ? `<span class="pc-pos">${esc(posJa)}</span>` : ""}
          <h3 class="name">${esc(p.name)}</h3>
          ${en ? `<p class="en">${esc(en)}</p>` : ""}
          ${clubBits ? `<p class="club">${esc(clubBits)}</p>` : ""}
          <div class="player-tags">
            <span class="badge ${esc(p.gender)}">${p.gender === "men" ? "男排" : "女排"}</span>
            ${p.position ? `<span class="pos">${esc(p.position)}</span>` : ""}
            ${hasStats ? `<span class="pos stats-hint">有數據</span>` : ""}
          </div>
          ${p.note ? `<p class="club note">${esc(p.note)}</p>` : ""}
        </div>
      </article>`;
  }


  function playerById(id) {
    return players.find((p) => p.id === id) || null;
  }

  function gossipGenderOk(g) {
    if (genderFilter === "all") return true;
    const ids = g.playerIds || [];
    const names = g.playerNames || [];
    const linked = [];
    ids.forEach((id) => {
      const p = playerById(id);
      if (p) linked.push(p);
    });
    names.forEach((n) => {
      const p = playerByName(n);
      if (p && !linked.some((x) => x.id === p.id)) linked.push(p);
    });
    if (!linked.length) return true;
    return linked.some((p) => p.gender === genderFilter);
  }

  function formatGossipDate(isoDate) {
    if (!isoDate) return "";
    const d = new Date(isoDate + "T12:00:00+08:00");
    if (Number.isNaN(d.getTime())) return isoDate;
    return new Intl.DateTimeFormat("zh-HK", {
      timeZone: HKT,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    }).format(d);
  }

  function gossipCardHtml(g) {
    const url = g.sourceUrl || "";
    if (!url) return "";
    const names = g.playerNames || [];
    const chips = names.map((n) => playerChipHtml(n)).join("");
    const tags = (g.tags || [])
      .map((t) => `<span class="gossip-tag">${esc(t)}</span>`)
      .join("");
    const source = g.source ? esc(g.source) : "來源";
    return `
      <article class="gossip-card">
        <div class="gossip-card-inner">
          <div class="gossip-top">
            <time class="gossip-date" datetime="${esc(g.date || "")}">${esc(formatGossipDate(g.date))}</time>
            ${tags}
          </div>
          <h3 class="gossip-title">${esc(g.title || "")}</h3>
          <p class="gossip-summary">${esc(g.summary || "")}</p>
          ${chips ? `<div class="japan-players">${chips}</div>` : ""}
          <div class="gossip-actions">
            <a class="gossip-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">睇原文 · ${source} ↗</a>
          </div>
        </div>
      </article>`;
  }


  function socialGenderOk(s) {
    if (genderFilter === "all") return true;
    const p = (s.playerId && playerById(s.playerId)) || (s.playerName && playerByName(s.playerName));
    if (!p) return true;
    return p.gender === genderFilter;
  }

  function platformLabel(platform) {
    const map = {
      instagram: "Instagram",
      x: "X",
      twitter: "X",
      threads: "Threads",
      facebook: "Facebook",
      youtube: "YouTube",
    };
    return map[String(platform || "").toLowerCase()] || (platform || "社交");
  }

  function platformBadgeClass(platform) {
    const key = String(platform || "").toLowerCase();
    if (key === "instagram") return "ig";
    if (key === "x" || key === "twitter") return "x";
    if (key === "threads") return "threads";
    return "other";
  }

  function socialCardHtml(s) {
    const url = s.postUrl || "";
    if (!url) return "";
    const name = s.playerName || "";
    const p = (s.playerId && playerById(s.playerId)) || (name && playerByName(name)) || null;
    const photo = playerPhotoUrl(p);
    const fallback = "/japan-vb-tracker/assets/players/placeholder.svg?v=" + PHOTO_V;
    const plat = platformLabel(s.platform);
    const platClass = platformBadgeClass(s.platform);
    const account = s.account ? esc(s.account) : "";
    return `
      <article class="social-card">
        <div class="social-head">
          <img class="social-avatar" src="${esc(photo)}" alt="" width="48" height="48"
            decoding="async" loading="lazy"
            onerror="this.onerror=null;this.src='${fallback}';" />
          <div class="social-meta">
            <div class="social-name-row">
              <span class="social-name">${esc(name || "球員")}</span>
              <span class="platform-badge ${platClass}">${esc(plat)}</span>
            </div>
            <div class="social-sub">
              <time datetime="${esc(s.date || "")}">${esc(formatGossipDate(s.date))}</time>
              ${account ? `<span class="social-account">${account}</span>` : ""}
            </div>
          </div>
        </div>
        <p class="social-caption">${esc(s.caption || "")}</p>
        <div class="social-actions">
          <a class="gossip-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">睇原 post · ${esc(plat)} ↗</a>
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
    const glist = gossip
      .filter((g) => g.sourceUrl && gossipGenderOk(g))
      .slice()
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    const upEl = $("#panel-upcoming");
    const pastEl = $("#panel-past");
    const plEl = $("#panel-players");
    const goEl = $("#panel-gossip");
    const soEl = $("#panel-social");

    const slist = social
      .filter((s) => s.postUrl && socialGenderOk(s))
      .slice()
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    upEl.innerHTML = upcoming.length
      ? `<div class="section-head"><h2 class="section-title">UPCOMING</h2><p class="section-sub">即將開波</p></div><div class="match-list">${upcoming.map(matchCardHtml).join("")}</div>`
      : `<div class="section-head"><h2 class="section-title">UPCOMING</h2><p class="section-sub">即將開波</p></div><div class="empty">暫時冇即將開波嘅賽事</div>`;
    pastEl.innerHTML = past.length
      ? `<div class="section-head"><h2 class="section-title">RESULTS</h2><p class="section-sub">過往賽果</p></div><div class="match-list">${past.map(matchCardHtml).join("")}</div>`
      : `<div class="section-head"><h2 class="section-title">RESULTS</h2><p class="section-sub">過往賽果</p></div><div class="empty">暫時冇過往賽果</div>`;
    plEl.innerHTML = plist.length
      ? `<div class="section-head"><h2 class="section-title">PLAYERS</h2><p class="section-sub">2026 VNL 登錄球員</p></div><div class="player-list">${plist.map(playerCardHtml).join("")}</div>`
      : `<div class="section-head"><h2 class="section-title">PLAYERS</h2><p class="section-sub">2026 VNL 登錄球員</p></div><div class="empty">暫時冇球員資料</div>`;
    goEl.innerHTML = glist.length
      ? `<div class="section-head"><h2 class="section-title">NEWS</h2><p class="section-sub">八卦新聞</p></div><div class="gossip-list">${glist.map(gossipCardHtml).join("")}</div>`
      : `<div class="section-head"><h2 class="section-title">NEWS</h2><p class="section-sub">八卦新聞</p></div><div class="empty">暫時未有公開八卦／生活動態<br/><span style="font-size:0.85em">只會刊登有可靠來源同原文連結嘅項目，唔會杜撰。</span></div>`;
    soEl.innerHTML = slist.length
      ? `<div class="section-head"><h2 class="section-title">SOCIAL</h2><p class="section-sub">球員動態 · IG／X</p></div><div class="social-list">${slist.map(socialCardHtml).join("")}</div>`
      : `<div class="section-head"><h2 class="section-title">SOCIAL</h2><p class="section-sub">球員動態 · IG／X</p></div><div class="empty">暫時未有可驗證嘅球員社交動態<br/><span style="font-size:0.85em">只會刊登有真實 post 連結嘅項目（IG／X 等），唔會杜撰。</span></div>`;

    $$(".match-card", upEl).forEach(bindMatch);
    $$(".match-card", pastEl).forEach(bindMatch);
    $$(".player-card", plEl).forEach(bindPlayer);
  }


  function bindPlayer(el) {
    const open = () => openPlayer(el.dataset.playerId);
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  }

  function fmtNum(n, digits = 2) {
    if (n == null || Number.isNaN(Number(n))) return null;
    const x = Number(n);
    if (Number.isInteger(x)) return String(x);
    return x.toFixed(digits);
  }

  function playerStatsSection(s) {
    if (!s) {
      return `<p class="no-stats">暫無公開數據（唔會估分）。</p>`;
    }
    const cards = [];
    const push = (label, value, sub) => {
      if (value == null || value === "") return;
      cards.push(`
        <div class="pstat-card">
          <div class="pstat-label">${esc(label)}</div>
          <div class="pstat-value">${esc(String(value))}</div>
          ${sub ? `<div class="pstat-sub">${esc(sub)}</div>` : ""}
        </div>`);
    };

    const isLiberoLike = (s.receptions != null || s.digs != null) && (s.points == null || s.points === 0) && !s.runningSets;

    push("出場場數", s.matches, s.sets != null ? `${s.sets} 局` : null);
    if (!isLiberoLike) {
      push("總得分", s.points, s.avgPoints != null ? `場均 ${fmtNum(s.avgPoints)}` : null);
      push("場均得分", s.avgPoints != null ? fmtNum(s.avgPoints) : null, "長均得分");
      push("扣球得分", s.attackPoints, s.avgAttackPoints != null ? `場均 ${fmtNum(s.avgAttackPoints)}` : null);
      if (s.attackAttempts != null) {
        const pct = s.attackSuccessPct != null ? `成功率 ${fmtNum(s.attackSuccessPct, 1)}%` : null;
        push("扣球出手", s.attackAttempts, pct);
      } else if (s.attackSuccessPct != null) {
        push("扣球成功率", `${fmtNum(s.attackSuccessPct, 1)}%`, null);
      }
      push("攔網得分", s.blockPoints, s.avgBlocks != null ? `場均 ${fmtNum(s.avgBlocks)}` : null);
      push("發球得分／Ace", s.servePoints, s.avgAces != null ? `場均 ${fmtNum(s.avgAces)}` : null);
    }
    push("救球", s.digs, s.digSuccessPct != null ? `成功率 ${fmtNum(s.digSuccessPct, 1)}%` : null);
    push("接發球", s.receptions, [
      s.recPositivePct != null ? `到位率 ${fmtNum(s.recPositivePct, 1)}%` : null,
      s.receptionErrors != null ? `失誤 ${s.receptionErrors}` : null,
    ].filter(Boolean).join(" · ") || null);
    push("組織傳球", s.runningSets, "Running sets");

    if (!cards.length) {
      return `<p class="no-stats">暫無公開數據（唔會估分）。</p>`;
    }
    return `
      <div class="season-tag">
        <span class="badge upcoming">${esc(s.season || "VNL 2026")}</span>
        <span class="comp">來源：${esc(s.source || "Volleyball World / VBLineup")}</span>
      </div>
      ${s.note ? `<div class="note-box" style="margin-top:0;margin-bottom:12px">${esc(s.note)}</div>` : ""}
      <div class="pstat-grid">${cards.join("")}</div>`;
  }

  function openPlayer(id) {
    const p = players.find((x) => x.id === id);
    if (!p) return;
    const s = playerStatsMap[id] || null;
    const body = $("#modal-body");
    const base = p.photo || "/japan-vb-tracker/assets/players/placeholder.svg";
    const photo = base + (base.includes("?") ? "&" : "?") + "v=" + PHOTO_V;
    const fallback = "/japan-vb-tracker/assets/players/placeholder.svg?v=" + PHOTO_V;
    const clubBits = [p.club, p.league].filter(Boolean).join(" · ");
    body.innerHTML = `
      <div class="player-detail-head">
        <img class="player-photo lg" src="${esc(photo)}" alt="" width="88" height="88"
          decoding="async"
          onerror="this.onerror=null;this.src='${fallback}';" />
        <div>
          <h2 id="modal-title">${esc(p.name)}</h2>
          ${p.nameEn ? `<div class="sub" style="margin:0 0 6px">${esc(p.nameEn)}</div>` : ""}
          <div class="sub" style="margin:0">
            <span class="badge ${esc(p.gender)}">${p.gender === "men" ? "男排" : "女排"}</span>
            ${p.position ? `<span class="pos">${esc(p.position)}</span>` : ""}
          </div>
          ${clubBits ? `<div class="club" style="margin-top:6px">${esc(clubBits)}</div>` : ""}
        </div>
      </div>
      ${p.note ? `<div class="note-box">${esc(p.note)}</div>` : ""}
      <h3 style="margin:16px 0 8px;font-size:0.95rem">賽季數據</h3>
      ${playerStatsSection(s)}
    `;
    $("#modal").hidden = false;
    document.body.style.overflow = "hidden";
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
      <h2 id="modal-title" class="modal-match-title">${teamNameHtml(m.home)}<span class="vs">vs</span>${teamNameHtml(m.away)}</h2>
      <div class="sub">
        <span class="badge ${esc(m.gender)}">${m.gender === "men" ? "男排" : "女排"}</span>
        <span class="badge ${esc(m.status)}">${m.status === "upcoming" ? "即將" : "完場"}</span>
        ${competitionHtml(m)}
      </div>
      <div class="match-meta" style="margin:0 0 8px">
        <span>🕐 ${esc(formatHkt(m.datetime))}</span>
        ${m.venue ? `<span>📍 ${esc(m.venue)}</span>` : ""}
        ${m.broadcast ? `<span>📺 ${esc(m.broadcast)}</span>` : ""}
      </div>
      ${m.score ? `<p style="font-size:1.4rem;font-weight:800;color:var(--accent);margin:8px 0">${esc(m.score)}</p>` : ""}
      ${setHtml ? `<div class="set-scores">${setHtml}</div>` : ""}
      ${(m.japanPlayers || []).length ? `<div class="japan-players" style="margin-bottom:12px">${(m.japanPlayers || []).map((p) => playerChipHtml(p)).join("")}</div>` : ""}
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


  function initKenBurns() {
    const stage = document.getElementById("kb-stage");
    if (!stage) return;
    const scrim = stage.querySelector(".kb-scrim");
    const IMAGES = [
      "assets/bg/team1.jpg",
      "assets/bg/team2.jpg",
      "assets/bg/team3.jpg",
      "assets/bg/team4.jpg",
    ];
    const recipes = [
      { s0: 1.0, x0: 0, y0: 0, s1: 1.18, x1: -4, y1: -3 },
      { s0: 1.15, x0: 3, y0: 2, s1: 1.0, x1: -2, y1: 0 },
      { s0: 1.05, x0: -3, y0: 2, s1: 1.2, x1: 3, y1: -2 },
      { s0: 1.12, x0: 2, y0: -2, s1: 1.0, x1: -3, y1: 3 },
    ];
    const layers = IMAGES.map((src) => {
      const wrap = document.createElement("div");
      wrap.className = "kb";
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      img.decoding = "async";
      img.fetchPriority = "low";
      wrap.appendChild(img);
      stage.insertBefore(wrap, scrim);
      return { wrap, img };
    });
    // First slide visible immediately (CSS default is opacity:0)
    layers[0].wrap.style.opacity = "1";

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }
    function clamp(v, a, b) {
      return Math.max(a, Math.min(b, v));
    }
    function applyKB(layer, localT, recipe) {
      const t = clamp(localT, 0, 1);
      const s = lerp(recipe.s0, recipe.s1, t);
      const x = lerp(recipe.x0, recipe.x1, t);
      const y = lerp(recipe.y0, recipe.y1, t);
      layer.img.style.transform =
        `scale(${s.toFixed(4)}) translate(${x.toFixed(2)}%, ${y.toFixed(2)}%)`;
    }

    const CYCLE_MS = 14000; // slow Ken Burns loop on the active slide
    const CROSS_MS = 52000; // full idle tour across all 4 photos
    let start = performance.now();

    function paint(now) {
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const scrollP = max > 0 ? window.scrollY / max : 0;
      const idleP = ((now - start) / CROSS_MS) % 1;
      // Scroll takes over once the user moves; otherwise idle auto-tour
      const useP = window.scrollY > 32 ? scrollP : idleP;
      const n = layers.length;
      const raw = useP * n;
      const i = clamp(Math.floor(raw), 0, n - 1);
      const frac = raw - Math.floor(raw);
      const timeLocal = ((now - start) / CYCLE_MS) % 1;

      layers.forEach((layer, idx) => {
        let op = 0;
        if (idx === i) {
          op = frac < 0.75 ? 1 : 1 - (frac - 0.75) / 0.25;
        } else if (idx === i + 1) {
          op = frac < 0.75 ? 0 : (frac - 0.75) / 0.25;
        } else if (idx === n - 1 && useP >= 0.999) {
          op = 1;
        }
        const scrollLocal = clamp(raw - idx, 0, 1);
        const local = idx === i ? Math.max(scrollLocal, timeLocal) : scrollLocal;
        layer.wrap.style.opacity = String(clamp(op, 0, 1));
        applyKB(layer, local, recipes[idx]);
      });
      requestAnimationFrame(paint);
    }

    requestAnimationFrame(paint);
  }

  async function init() {
    initKenBurns();
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
      const [m, pl, metaRaw, statsRaw, gossipRaw, socialRaw, teamsRaw, leaguesRaw] = await Promise.all([
        loadJson("data/matches.json"),
        loadJson("data/players.json"),
        loadJson("data/meta.json"),
        loadJson("data/player-stats.json").catch(() => ({ players: {} })),
        loadJson("data/gossip.json").catch(() => []),
        loadJson("data/social.json").catch(() => []),
        loadJson("data/teams.json").catch(() => ({})),
        loadJson("data/leagues.json").catch(() => ({})),
      ]);
      matches = m;
      players = pl;
      meta = metaRaw;
      playerStatsMap = (statsRaw && statsRaw.players) || {};
      gossip = Array.isArray(gossipRaw) ? gossipRaw.filter((g) => g && g.sourceUrl) : [];
      social = Array.isArray(socialRaw) ? socialRaw.filter((s) => s && s.postUrl) : [];
      teamsMap = teamsRaw && typeof teamsRaw === "object" ? teamsRaw : {};
      leaguesMap = leaguesRaw && typeof leaguesRaw === "object" ? leaguesRaw : {};
      renderMeta();
      renderPanels();
      setTab("upcoming");
      window.dispatchEvent(new Event("resize"));
    } catch (err) {
      $("#panel-upcoming").innerHTML =
        `<div class="empty">載入失敗：${esc(err.message)}<br/>用本地伺服器開（唔好直接 file://）</div>`;
      $("#panel-upcoming").hidden = false;
      $("#panel-upcoming").classList.add("active");
    }
  }

  init();
})();
