
/* =========================
   UTILITIES
========================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function showLoading(message = "⏳ Loading MLB data...") {
  const loader = $("#loading");
  if (loader) {
    loader.textContent = message;
    loader.classList.remove("hidden");
  }
}
function hideLoading() {
  const loader = $("#loading");
  if (loader) loader.classList.add("hidden");
}

async function fetchWithRetry(url, options = {}, retries = 4, delay = 4000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      throw new Error(`Fetch failed: ${res.status}`);
    } catch (err) {
      console.warn(`Attempt ${i + 1} failed for ${url}... retrying in ${delay / 1000}s`);
      if (i < retries - 1) {
        showLoading("⚙️ Server waking up... please wait...");
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

/* =========================
   THEMES
========================= */
const uiThemes = {
  classic: { accent: "#007BFF", highlight: "#000000", bg: "#ffffff" },
  cleanblue: { accent: "#0051A8", highlight: "#1A1A1A", bg: "#F9FBFF" },
  graysoft: { accent: "#444444", highlight: "#222222", bg: "#FAFAFA" },
  night: { accent: "#ffffff", highlight: "#C9D1D9", bg: "#0D1117" },
};

// Team color set tuned for white/very-light backgrounds
const teamThemes = {
  "New York Yankees":      { accent: "#0C2340", highlight: "#0C2340", bg: "#ffffff" },
  "Boston Red Sox":        { accent: "#BD3039", highlight: "#BD3039", bg: "#ffffff" },
  "Tampa Bay Rays":        { accent: "#092C5C", highlight: "#092C5C", bg: "#ffffff" },
  "Toronto Blue Jays":     { accent: "#134A8E", highlight: "#134A8E", bg: "#ffffff" },
  "Baltimore Orioles":     { accent: "#DF4601", highlight: "#DF4601", bg: "#ffffff" },

  "Minnesota Twins":       { accent: "#002B5C", highlight: "#002B5C", bg: "#ffffff" },
  "Cleveland Guardians":   { accent: "#0C2340", highlight: "#E31937", bg: "#ffffff" },
  "Chicago White Sox":     { accent: "#000000", highlight: "#000000", bg: "#ffffff" },
  "Detroit Tigers":        { accent: "#0C2340", highlight: "#FA4616", bg: "#ffffff" },
  "Kansas City Royals":    { accent: "#004687", highlight: "#7A6A4F", bg: "#ffffff" },

  "Houston Astros":        { accent: "#002D62", highlight: "#EB6E1F", bg: "#ffffff" },
  "Texas Rangers":         { accent: "#003278", highlight: "#C0111F", bg: "#ffffff" },
  "Seattle Mariners":      { accent: "#003278", highlight: "#0C2C56", bg: "#ffffff" },
  "Los Angeles Angels":    { accent: "#BA0021", highlight: "#003263", bg: "#ffffff" },
  "Oakland Athletics":     { accent: "#003831", highlight: "#EFB21E", bg: "#ffffff" },

  "Atlanta Braves":        { accent: "#0E2340", highlight: "#CE1141", bg: "#ffffff" },
  "Philadelphia Phillies": { accent: "#E81828", highlight: "#002D72", bg: "#ffffff" },
  "New York Mets":         { accent: "#002D72", highlight: "#FF5910", bg: "#ffffff" },
  "Miami Marlins":         { accent: "#00A3E0", highlight: "#EF3340", bg: "#ffffff" },
  "Washington Nationals":  { accent: "#AB0003", highlight: "#14225A", bg: "#ffffff" },

  "Chicago Cubs":          { accent: "#0E3386", highlight: "#CC3433", bg: "#ffffff" },
  "Milwaukee Brewers":     { accent: "#12284B", highlight: "#FFC52F", bg: "#ffffff" },
  "St. Louis Cardinals":   { accent: "#C41E3A", highlight: "#FEDB00", bg: "#ffffff" },
  "Pittsburgh Pirates":    { accent: "#000000", highlight: "#FFB81C", bg: "#ffffff" },
  "Cincinnati Reds":       { accent: "#C6011F", highlight: "#333333", bg: "#ffffff" },

  "Los Angeles Dodgers":   { accent: "#005A9C", highlight: "#EF3E42", bg: "#ffffff" },
  "San Diego Padres":      { accent: "#2F241D", highlight: "#FFC425", bg: "#ffffff" },
  "San Francisco Giants":  { accent: "#FD5A1E", highlight: "#27251F", bg: "#ffffff" },
  "Arizona Diamondbacks":  { accent: "#A71930", highlight: "#5F574F", bg: "#ffffff" },
  "Colorado Rockies":      { accent: "#33006F", highlight: "#4F5B66", bg: "#ffffff" },
};

function applyUITheme(themeName) {
  const theme = uiThemes[themeName];
  if (!theme) return;
  document.documentElement.style.setProperty("--accent", theme.accent);
  document.documentElement.style.setProperty("--highlight", theme.highlight);
  document.documentElement.style.setProperty("--bg", theme.bg);
  localStorage.setItem("selectedUITheme", themeName);
}

function applyTeamTheme(teamName) {
  const theme = teamThemes[teamName];
  if (!theme) return;
  document.documentElement.style.setProperty("--accent", theme.accent);
  document.documentElement.style.setProperty("--highlight", theme.highlight);
  document.documentElement.style.setProperty("--bg", theme.bg);
}

/* =========================
   STATE / CONSTANTS
========================= */
const BACKEND = "https://mlb-stats-backend-1.onrender.com";
const MLB = "https://statsapi.mlb.com";

const DIV_GRID_ID = {
  "American League East": "AL-East",
  "American League Central": "AL-Central",
  "American League West": "AL-West",
  "National League East": "NL-East",
  "National League Central": "NL-Central",
  "National League West": "NL-West",
};

// Standings panel id mapper (supports both full and short names)
function standingsTargetFor(nameOrShort) {
  const n = nameOrShort || "";
  const L = n.toLowerCase();
  if (L.includes("american") && L.includes("east")) return "AL-East-standings";
  if (L.includes("american") && L.includes("central")) return "AL-Central-standings";
  if (L.includes("american") && L.includes("west")) return "AL-West-standings";
  if (L.includes("national") && L.includes("east")) return "NL-East-standings";
  if (L.includes("national") && L.includes("central")) return "NL-Central-standings";
  if (L.includes("national") && L.includes("west")) return "NL-West-standings";
  // fallback if API ever returns "AL East" style
  if (L.includes("al") && L.includes("east")) return "AL-East-standings";
  if (L.includes("al") && L.includes("central")) return "AL-Central-standings";
  if (L.includes("al") && L.includes("west")) return "AL-West-standings";
  if (L.includes("nl") && L.includes("east")) return "NL-East-standings";
  if (L.includes("nl") && L.includes("central")) return "NL-Central-standings";
  if (L.includes("nl") && L.includes("west")) return "NL-West-standings";
  return null;
}

// cache for teams by id (helps Favorites page)
const TeamCache = {
  byId: new Map(), // id -> team object
  set(team) { this.byId.set(team.id, team); },
  get(id) { return this.byId.get(id); },
  has(id) { return this.byId.has(id); },
  all() { return Array.from(this.byId.values()); },
};

/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  // Smooth page transitions for anchor links to .html
  enablePageTransitions();

  // Side menu (hamburger)
  wireHamburger();

  // UI Theme select
  wireUITheme();

  // Auto Team Theme toggle (if present)
  wireAutoTeamThemeToggle();

  // Reset theme button
  const resetBtn = $("#resetThemeBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      localStorage.removeItem("favoriteTeamTheme");
      applyUITheme("classic");
      alert("Theme reset to default (Blue on White).");
    });
  }

  // Help link
  const helpBtn = $("#helpBtn");
  if (helpBtn) {
    helpBtn.addEventListener("click", () => {
      alert(
        "Welcome to MLB Explorer!\n\n" +
          "✅ Open a division to see teams & standings\n" +
          "✅ Click a team → roster & player stats\n" +
          "⭐ Favorite teams (saves in browser)\n" +
          "🎨 Auto team theme is optional (toggle in menu)\n\n" +
          "Have fun!"
      );
    });
  }

  // Load teams + standings (on index/home)
  await loadTeams();
  await loadStandings();

  // Load Favorites page (if favoritesGrid exists)
  populateFavoritesPage();

  // Live search
  wireSearch();

  // Apply previously saved favorite team theme (optional)
  const favTeamThemeName = localStorage.getItem("favoriteTeamTheme");
  if (favTeamThemeName && teamThemes[favTeamThemeName]) {
    // Only apply if auto-team-theme isn't explicitly OFF at boot
    const auto = (localStorage.getItem("autoTeamTheme") || "on").toLowerCase();
    if (auto !== "off") {
      applyTeamTheme(favTeamThemeName);
    }
  }
});

/* =========================
   HAMBURGER / MENU
========================= */
function wireHamburger() {
  const menuBtn = $("#menuBtn");
  const sideMenu = $("#sideMenu");
  if (!menuBtn || !sideMenu) return;

  menuBtn.addEventListener("click", () => {
    const isOpen = sideMenu.classList.toggle("active");
    document.body.classList.toggle("menu-open", isOpen);
  });

  // click outside to close
  document.addEventListener("click", (e) => {
    if (!sideMenu.classList.contains("active")) return;
    if (sideMenu.contains(e.target) || menuBtn.contains(e.target)) return;
    sideMenu.classList.remove("active");
    document.body.classList.remove("menu-open");
  });
}

/* =========================
   UI THEME SELECT
========================= */
function wireUITheme() {
  const themeSelector = $("#theme");
  if (!themeSelector) return;

  const savedTheme = localStorage.getItem("selectedUITheme") || "classic";
  themeSelector.value = savedTheme;
  applyUITheme(savedTheme);

  themeSelector.addEventListener("change", (e) => {
    applyUITheme(e.target.value);
  });
}

/* =========================
   AUTO TEAM THEME TOGGLE
========================= */
function wireAutoTeamThemeToggle() {
  const ctl = $("#autoTeamTheme"); // <select id="autoTeamTheme"> on the side menu
  if (!ctl) return;

  const saved = (localStorage.getItem("autoTeamTheme") || "on").toLowerCase();
  ctl.value = saved;

  ctl.addEventListener("change", () => {
    localStorage.setItem("autoTeamTheme", ctl.value.toLowerCase());
  });
}

/* =========================
   SEARCH (Live)
========================= */
function wireSearch() {
  const search = $("#searchTeams");
  if (!search) return;

  let t = null;
  search.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    clearTimeout(t);
    t = setTimeout(() => {
      $$(".team-card").forEach((card) => {
        const name = (card.dataset.teamName || "").toLowerCase();
        card.style.display = name.includes(q) ? "flex" : "none";
      });
    }, 80);
  });
}

/* =========================
   TEAMS (cards) + FAVORITES
========================= */
async function loadTeams() {
  const teamsGridExists = $("#AL-East") || $("#NL-West");
  if (!teamsGridExists) return; // not on index/home

  showLoading("⏳ Loading teams...");
  try {
    const res = await fetchWithRetry(`${BACKEND}/api/teams`);
    const json = await res.json();
    const teams = json.teams || [];
    hideLoading();

    // Cache teams by id for Favorites page
    teams.forEach((t) => TeamCache.set(t));

    // Map full division names -> grid containers
    const favorites = JSON.parse(localStorage.getItem("favorites") || "[]");

    teams.forEach((team) => {
      const divName = team.division?.name || "";
      const containerId = DIV_GRID_ID[divName];
      if (!containerId) return;
      const container = document.getElementById(containerId);
      if (!container) return;

      const card = document.createElement("div");
      card.className = "team-card";
      card.dataset.teamName = team.name.toLowerCase();

      const logoUrl = `https://www.mlbstatic.com/team-logos/${team.id}.svg`;
      const isFav = favorites.includes(team.id);

      card.innerHTML = `
        <img src="${logoUrl}" class="team-logo" alt="${team.name} logo">
        <p class="team-name">${team.name}</p>
        <div class="favorite-container">
          <span class="favorite-star ${isFav ? "active" : ""}" data-id="${team.id}" data-name="${team.name}">★</span>
          <span class="favorite-label">Favorite</span>
        </div>
      `;

      // Card click (roster + optional auto theme)
      card.addEventListener("click", (evt) => {
        // If star clicked, don't open modal
        if (evt.target.classList.contains("favorite-star")) return;

        const auto = (localStorage.getItem("autoTeamTheme") || "on").toLowerCase();
        if (auto !== "off") {
          applyTeamTheme(team.name);
          saveFavoriteTeamTheme(team.name);
        }
        openRosterModal(team);
      });

      container.appendChild(card);
    });

    // Favorite star listeners (do not change theme here)
    $$(".favorite-star").forEach((star) => {
      star.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = parseInt(star.dataset.id);
        let favs = JSON.parse(localStorage.getItem("favorites") || "[]");

        if (favs.includes(id)) {
          favs = favs.filter((x) => x !== id);
          star.classList.remove("active");
        } else {
          favs.push(id);
          star.classList.add("active");
        }
        localStorage.setItem("favorites", JSON.stringify(favs));
      });
    });
  } catch (err) {
    console.error("Team Load Error:", err);
    showLoading("⚠️ Unable to load teams. Please refresh.");
  }
}

function saveFavoriteTeamTheme(teamName) {
  localStorage.setItem("favoriteTeamTheme", teamName);
}

function loadFavoriteTeamTheme() {
  const name = localStorage.getItem("favoriteTeamTheme");
  if (name && teamThemes[name]) applyTeamTheme(name);
}

/* =========================
   FAVORITES PAGE (optional)
========================= */
function populateFavoritesPage() {
  const grid = $("#favoritesGrid");
  if (!grid) return; // not on favorites.html

  grid.innerHTML = "";
  const favIds = JSON.parse(localStorage.getItem("favorites") || "[]");
  if (!favIds.length) {
    grid.innerHTML = `<p style="color:var(--highlight)">No favorites yet. ⭐ Mark teams on the home page.</p>`;
    return;
  }

  // If some teams are not cached (e.g., arrived directly), fetch teams quickly:
  const ensureTeams = async () => {
    if (TeamCache.byId.size > 0) return;
    try {
      const res = await fetchWithRetry(`${BACKEND}/api/teams`);
      const data = await res.json();
      (data.teams || []).forEach((t) => TeamCache.set(t));
    } catch (e) {
      console.warn("Could not backfill team cache for favorites:", e);
    }
  };

  ensureTeams().then(() => {
    favIds.forEach((id) => {
      const t = TeamCache.get(id);
      if (!t) return;
      const card = document.createElement("div");
      card.className = "team-card";
      card.dataset.teamName = t.name.toLowerCase();

      const logoUrl = `https://www.mlbstatic.com/team-logos/${t.id}.svg`;
      card.innerHTML = `
        <img src="${logoUrl}" class="team-logo" alt="${t.name} logo">
        <p class="team-name">${t.name}</p>
        <div class="favorite-container">
          <span class="favorite-star active" data-id="${t.id}" data-name="${t.name}">★</span>
          <span class="favorite-label">Favorite</span>
        </div>
      `;

      card.addEventListener("click", (evt) => {
        if (evt.target.classList.contains("favorite-star")) return;
        const auto = (localStorage.getItem("autoTeamTheme") || "on").toLowerCase();
        if (auto !== "off") {
          applyTeamTheme(t.name);
          saveFavoriteTeamTheme(t.name);
        }
        openRosterModal(t);
      });

      // star in favorites allows un-favorite
      card.querySelector(".favorite-star").addEventListener("click", (e) => {
        e.stopPropagation();
        let favs = JSON.parse(localStorage.getItem("favorites") || "[]");
        favs = favs.filter((x) => x !== id);
        localStorage.setItem("favorites", JSON.stringify(favs));
        card.remove();
        if (!$("#favoritesGrid").children.length) {
          $("#favoritesGrid").innerHTML = `<p style="color:var(--highlight)">No favorites yet. ⭐ Mark teams on the home page.</p>`;
        }
      });

      grid.appendChild(card);
    });
  });
}

/* =========================
   STANDINGS (2024)
========================= */
async function loadStandings() {
  // Only run if any standings container exists
  const needs = [
    "AL-East-standings", "AL-Central-standings", "AL-West-standings",
    "NL-East-standings", "NL-Central-standings", "NL-West-standings",
  ].some((id) => document.getElementById(id));
  if (!needs) return;

  try {
    const res = await fetch(
      `${MLB}/api/v1/standings?leagueId=103,104&season=2024&standingsTypes=regularSeason&hydrate=division`
    );
    const data = await res.json();
    const records = data.records || [];

    records.forEach((div) => {
      const name = div.division?.name || div.division?.abbreviation || "";
      const targetId = standingsTargetFor(name);
      if (!targetId) return;
      const target = document.getElementById(targetId);
      if (!target) return;

      let html = `
        <table>
          <tr>
            <th>Team</th>
            <th>W</th>
            <th>L</th>
            <th>PCT</th>
          </tr>
      `;
      (div.teamRecords || []).forEach((tr) => {
        html += `
          <tr>
            <td>${tr.team.name}</td>
            <td>${tr.wins}</td>
            <td>${tr.losses}</td>
            <td>${tr.winningPercentage}</td>
          </tr>
        `;
      });
      html += `</table>`;
      target.innerHTML = html;
    });
  } catch (err) {
    console.error("Standings Load Error:", err);
  }
}

/* =========================
   ROSTER MODAL + PLAYER MODAL
========================= */
async function openRosterModal(team) {
  const modal = $("#rosterModal");
  if (!modal) return;

  $("#teamNameModal").textContent = team.name;
  modal.style.display = "flex";

  const batters = $("#batters");
  const pitchers = $("#pitchers");
  const catchers = $("#catchers");
  [batters, pitchers, catchers].forEach((el) => (el.innerHTML = ""));

  try {
    const rosterRes = await fetch(`${MLB}/api/v1/teams/${team.id}/roster`);
    const rosterData = await rosterRes.json();
    const players = rosterData.roster || [];

    const groups = {
      "Starting Pitchers": [],
      "Relief Pitchers": [],
      "Pitchers/DH": [],
      Catchers: [],
      Infielders: [],
      Outfielders: [],
    };

    const posMap = {
      SP: "Starting Pitchers",
      RP: "Relief Pitchers",
      CP: "Relief Pitchers",
      LRP: "Relief Pitchers",
      MRP: "Relief Pitchers",
      C: "Catchers",
      "1B": "Infielders",
      "2B": "Infielders",
      "3B": "Infielders",
      SS: "Infielders",
      IF: "Infielders",
      LF: "Outfielders",
      CF: "Outfielders",
      RF: "Outfielders",
      OF: "Outfielders",
      DH: "Pitchers/DH",
      PH: "Pitchers/DH",
      PR: "Pitchers/DH",
    };

    for (const p of players) {
      const pos = p.position?.abbreviation || "DH";
      const group = posMap[pos] || "Pitchers/DH";

      const statsUrl = `${MLB}/api/v1/people/${p.person.id}/stats?stats=season&season=2024`;
      let stats = {};
      try {
        const statsRes = await fetch(statsUrl);
        const statsJson = await statsRes.json();
        stats = statsJson.stats?.[0]?.splits?.[0]?.stat || {};
      } catch {
        stats = {};
      }

      const headshot = `https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_auto:best/v1/people/${p.person.id}/headshot/silo/current`;

      groups[group].push({
        name: p.person.fullName,
        position: pos,
        stats,
        headshot,
        id: p.person.id,
      });
    }

    for (const [title, people] of Object.entries(groups)) {
      if (!people.length) continue;

      let tab = "batters";
      if (title.includes("Pitcher") || title.includes("DH")) tab = "pitchers";
      if (title.includes("Catch")) tab = "catchers";

      const div = document.getElementById(tab);
      div.innerHTML += `<h3>${title}</h3>`;

      people.forEach((pl) => {
        div.innerHTML += `
          <div class="player-row" data-id="${pl.id}">
            <img src="${pl.headshot}" class="player-headshot" alt="${pl.name} headshot" />
            <div class="player-info">
              <strong>${pl.name}</strong> (${pl.position})<br>
              AVG: ${pl.stats.avg || "—"} |
              HR: ${pl.stats.homeRuns || "—"} |
              RBI: ${pl.stats.rbi || "—"} |
              ERA: ${pl.stats.era || "—"}
            </div>
          </div>
        `;
      });
    }
  } catch (e) {
    console.error("Roster load error:", e);
  }
}

// Close roster modal
const closeModalBtn = $("#closeModal");
if (closeModalBtn) {
  closeModalBtn.addEventListener("click", () => {
    $("#rosterModal").style.display = "none";
  });
}
window.addEventListener("click", (e) => {
  const m = $("#rosterModal");
  if (m && e.target === m) m.style.display = "none";
});

// Tab switching
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  $$(".tab-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const tab = btn.dataset.tab;
  $$(".tab-content").forEach((c) => c.classList.remove("active"));
  const panel = document.getElementById(tab);
  if (panel) panel.classList.add("active");
});

// Player modal
document.addEventListener("click", async (e) => {
  const row = e.target.closest(".player-row");
  if (!row) return;

  const id = row.dataset.id;
  const modal = $("#playerModal");
  if (!modal) return;

  try {
    const res = await fetch(`${MLB}/api/v1/people/${id}`);
    const data = await res.json();
    const person = data.people?.[0];

    $("#playerHeadshot").src = `https://img.mlbstatic.com/mlb-photos/image/upload/w_300,q_auto:best/v1/people/${id}/headshot/silo/current`;
    $("#playerName").textContent = person?.fullName || "Unknown";
    $("#playerTeam").textContent = person?.currentTeam?.name || "Unknown";
    $("#playerInfo").innerHTML = `
      Age: ${person?.currentAge ?? "—"}<br>
      Height: ${person?.height ?? "—"}<br>
      Weight: ${person?.weight ? person.weight + " lbs" : "—"}<br>
      Birthplace: ${person?.birthCity ?? "—"}
    `;

    modal.style.display = "flex";
  } catch (err) {
    console.error("Player load error:", err);
  }
});

const closePlayerModal = $("#closePlayerModal");
if (closePlayerModal) {
  closePlayerModal.addEventListener("click", () => {
    $("#playerModal").style.display = "none";
  });
}
window.addEventListener("click", (e) => {
  const m = $("#playerModal");
  if (m && e.target === m) m.style.display = "none";
});

/* =========================
   PAGE TRANSITIONS
========================= */
function enablePageTransitions() {
  $$("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href === "#" || href.startsWith("javascript")) return;
    if (!href.endsWith(".html")) return;

    link.addEventListener("click", (e) => {
      e.preventDefault();
      document.body.classList.add("fade-out");
      setTimeout(() => (window.location.href = href), 300);
    });
  });
}
