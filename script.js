// =========================
// CONFIG
// =========================
const BACKEND = "https://mlb-stats-backend-1.onrender.com";
const MLB_API = "https://statsapi.mlb.com/api/v1";

// The MLB regular season runs roughly April–October. Before April, show last season.
const SEASON = (() => {
    const now = new Date();
    return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
})();

// Division IDs used by the MLB Stats API -> the element IDs in index.html
const DIVISION_IDS = {
    201: "AL-East", 202: "AL-Central", 200: "AL-West",
    204: "NL-East", 205: "NL-Central", 203: "NL-West"
};
const DIVISION_NAMES = {
    "American League East": "AL-East", "American League Central": "AL-Central", "American League West": "AL-West",
    "National League East": "NL-East", "National League Central": "NL-Central", "National League West": "NL-West",
    "AL East": "AL-East", "AL Central": "AL-Central", "AL West": "AL-West",
    "NL East": "NL-East", "NL Central": "NL-Central", "NL West": "NL-West"
};

function divisionKey(division) {
    if (!division) return null;
    return DIVISION_IDS[division.id] || DIVISION_NAMES[division.name] || DIVISION_NAMES[division.nameShort] || null;
}

const logoUrl = id => `https://www.mlbstatic.com/team-logos/${id}.svg`;
const logoFallbackUrl = id => `https://www.mlbstatic.com/team-logos/${id}.svg`;
const headshotUrl = (id, w = 120) =>
    `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_${w},q_auto:best/v1/people/${id}/headshot/67/current`;


// =========================
// SMALL HELPERS
// =========================
function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
}

function readJSON(key, fallback) {
    try {
        const v = JSON.parse(localStorage.getItem(key));
        return v ?? fallback;
    } catch {
        return fallback;
    }
}

function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

async function fetchJSON(url, timeoutMs = 20000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

let toastTimer;
function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => { toast.hidden = true; }, 250);
    }, 2500);
}

// Img fallback for team logos (some teams may not have the dark-background version)
document.addEventListener("error", e => {
    const img = e.target;
    if (img.tagName === "IMG" && img.dataset.fallback && img.src !== img.dataset.fallback) {
        img.src = img.dataset.fallback;
    }
}, true);


// =========================
// TEAM THEME SYSTEM
// =========================
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
    "Colorado Rockies":      { accent: "#33006F", highlight: "#4F5B66", bg: "#ffffff" }
};
// The A's are listed as just "Athletics" by MLB since their move
teamThemes["Athletics"] = teamThemes["Oakland Athletics"];

// Site-wide themes (picked in the ☰ Settings menu)
const presetThemes = {
    classic:   { accent: "#1F6B45", highlight: "#2C4A3A", bg: "#F5F7F4" },  // ballpark grass
    cleanblue: { accent: "#0051A8", highlight: "#1A1A1A", bg: "#F7F9FC" },
    graysoft:  { accent: "#444444", highlight: "#222222", bg: "#F7F7F6" },
    night:     { accent: "#4FBF85", highlight: "#C9D6CF", bg: "#0F1714" }   // night game
};

// --- color contrast helpers: some team colors (yellow on white, navy on black)
// are hard to read, so nudge them darker/lighter until text is readable (WCAG 4.5:1).
function hexToRgb(hex) {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
function rgbToHex(rgb) {
    return "#" + rgb.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
}
function luminance(rgb) {
    const [r, g, b] = rgb.map(c => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastRatio(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}
function readableOn(hex, bgHex, minRatio = 4.5) {
    const base = hexToRgb(hex);
    const bg = hexToRgb(bgHex);
    const target = luminance(bg) > 0.4 ? 0 : 255; // darken on light backgrounds, lighten on dark
    let t = 0;
    let rgb = base;
    while (contrastRatio(rgb, bg) < minRatio && t < 1) {
        t += 0.05;
        rgb = base.map(c => c + (target - c) * t);
    }
    return rgbToHex(rgb);
}

function applyColors({ accent, highlight, bg }) {
    // If the main team color is hard to read but the second color isn't, lead with the readable one.
    const bgRgb = hexToRgb(bg);
    if (contrastRatio(hexToRgb(accent), bgRgb) < 3 && contrastRatio(hexToRgb(highlight), bgRgb) >= 3) {
        [accent, highlight] = [highlight, accent];
    }
    const accentHex = readableOn(accent, bg);
    const root = document.documentElement;
    root.dataset.mode = luminance(bgRgb) > 0.4 ? "light" : "dark";
    root.style.setProperty("--bg", bg);
    root.style.setProperty("--accent", accentHex);
    root.style.setProperty("--highlight", readableOn(highlight, bg));
    // Text color used on top of the accent color (header, active tabs, buttons)
    const acc = hexToRgb(accentHex);
    root.style.setProperty("--on-accent",
        contrastRatio(acc, [255, 255, 255]) >= contrastRatio(acc, [17, 17, 17]) ? "#ffffff" : "#111111");
}

function getThemeChoice() {
    const saved = localStorage.getItem("themeChoice");
    if (saved && (saved === "team" || presetThemes[saved])) return saved;
    // Visitors from the older version: keep their team colors or site theme
    const autoTeam = (localStorage.getItem("autoTeamTheme") || "on").toLowerCase() !== "off";
    if (autoTeam && teamThemes[localStorage.getItem("favoriteTeamTheme")]) return "team";
    const oldUI = localStorage.getItem("selectedUITheme");
    return presetThemes[oldUI] ? oldUI : "classic";
}

function applyThemeChoice(choice) {
    const hint = document.getElementById("themeHint");
    hint.textContent = "";

    if (choice === "team") {
        const teamName = localStorage.getItem("favoriteTeamTheme");
        if (teamName && teamThemes[teamName]) {
            applyColors(teamThemes[teamName]);
            hint.textContent = `Using ${teamName} colors.`;
        } else {
            applyColors(presetThemes.classic);
            hint.textContent = "Star a team (☆) to use its colors.";
        }
    } else {
        applyColors(presetThemes[choice] || presetThemes.classic);
    }
    document.getElementById("theme").value = choice;
}

function setThemeChoice(choice) {
    localStorage.setItem("themeChoice", choice);
    applyThemeChoice(choice);
}


// =========================
// APP STATE
// =========================
const state = {
    teams: [],               // [{id, name, abbreviation, divKey, ...}]
    standings: {},           // teamId -> standings record
    favorites: readJSON("favorites", []).map(Number),
    season: SEASON,          // season being viewed (picker in the toolbar)
    rosterCache: {},         // "season-teamId" -> players[]
    careerCache: {},         // playerId -> { person, hitting, pitching } (career + year-by-year)
    playerView: "season",    // player window tab: season | career | years
    teamAbbr: {},            // teamId -> abbreviation (for year-by-year tables)
    teamParamHandled: false,
    currentTeam: null,
    currentTab: "hitters",
    sort: { hitters: { key: "pos", dir: 1 }, pitchers: { key: "role", dir: 1 } },
    searching: false
};

const teamById = id => state.teams.find(t => t.id === Number(id));


// =========================
// INIT PAGE
// =========================
document.addEventListener("DOMContentLoaded", () => {
    const seasonParam = Number(new URLSearchParams(location.search).get("season"));
    if (seasonParam >= 1969 && seasonParam <= SEASON) state.season = seasonParam;
    document.getElementById("seasonLabel").textContent = state.season;
    setupSeasonPicker();
    setupPlayerWindow();
    setupCompare();
    applyThemeChoice(getThemeChoice());
    restoreDivisionState();
    setupMenu();
    setupModals();
    setupSearch();
    setupDivisionToggles();
    setupTeamInteractions();
    loadData();
});


// =========================
// LOAD TEAMS + STANDINGS
// =========================
async function loadTeamList() {
    // 1) Your own backend (on Render). 2) Fall back to the MLB API directly.
    try {
        const data = await fetchJSON(`${BACKEND}/api/teams`, 60000);
        if (Array.isArray(data.teams) && data.teams.length) return data.teams;
    } catch (err) {
        console.warn("Backend /api/teams unavailable, using MLB API directly.", err);
    }
    const data = await fetchJSON(`${MLB_API}/teams?sportId=1&season=${state.season}`);
    return data.teams;
}

async function loadStandings() {
    const data = await fetchJSON(
        `${MLB_API}/standings?leagueId=103,104&season=${state.season}&standingsTypes=regularSeason&hydrate=division,team`
    );
    return data.records || [];
}

async function loadData() {
    state.teams = [];
    state.standings = {};
    const loadingSeason = state.season;
    showStatus("loading", loadingSeason === SEASON
        ? "Loading teams and standings…"
        : `Loading ${loadingSeason} standings…`);
    // Free Render apps go to sleep and take a while to wake up. Tell the user why it's slow.
    const slowTimer = setTimeout(() => {
        showStatus("loading", "Still loading… the server may be waking up. This can take up to a minute the first time.");
    }, 5000);

    // Past seasons: the teams come straight from that year's standings
    const [teamsResult, standingsResult] = await Promise.allSettled([
        state.season === SEASON ? loadTeamList() : Promise.resolve(null),
        loadStandings()
    ]);
    clearTimeout(slowTimer);
    if (loadingSeason !== state.season) return; // user picked another year while this loaded

    // Standings
    let records = [];
    if (standingsResult.status === "fulfilled") {
        records = standingsResult.value;
        records.forEach(div => {
            div.teamRecords.forEach(tr => {
                state.standings[tr.team.id] = { ...tr, divKey: divisionKey(div.division) };
            });
        });
    } else {
        console.error("Standings Load Error:", standingsResult.reason);
    }

    // Teams (fall back to the teams inside the standings data if needed)
    let teams = teamsResult.status === "fulfilled" ? teamsResult.value : null;
    if (!teams && records.length) {
        teams = records.flatMap(div => div.teamRecords.map(tr => ({ ...tr.team, division: div.division })));
    }

    if (!teams) {
        console.error("Teams Load Error:", teamsResult.reason || standingsResult.reason);
        showStatus("error", "Couldn't load teams. Check your connection and try again.", true);
        return;
    }

    state.teams = teams
        .map(t => ({ ...t, divKey: divisionKey(t.division) || state.standings[t.id]?.divKey }))
        .filter(t => t.divKey);
    state.teams.forEach(t => { if (t.abbreviation) state.teamAbbr[t.id] = t.abbreviation; });

    renderDivisions(records);
    renderFavorites();

    if (standingsResult.status === "rejected") {
        showStatus("warn", "Teams loaded, but standings couldn't be loaded right now.", true);
    } else {
        hideStatus();
    }

    // Links like index.html?team=158 (used by the Favorites page) open that team's roster
    const teamParam = state.teamParamHandled ? null : new URLSearchParams(location.search).get("team");
    state.teamParamHandled = true;
    if (teamParam && teamById(teamParam) && !anyModalOpen()) {
        openRosterModal(teamById(teamParam));
    }
    if (typeof afterDataLoaded === "function") afterDataLoaded(standingsResult.status === "fulfilled");
}

function showStatus(type, message, withRetry = false) {
    const banner = document.getElementById("statusBanner");
    banner.className = `status-banner ${type}`;
    banner.innerHTML = `
        ${type === "loading" ? '<span class="spinner" aria-hidden="true"></span>' : ""}
        <span>${esc(message)}</span>
        ${withRetry ? '<button class="ghost-btn" id="retryBtn">Try again</button>' : ""}`;
    banner.hidden = false;
    if (withRetry) {
        document.getElementById("retryBtn").addEventListener("click", () => {
            loadData();
        });
    }
}

function hideStatus() {
    document.getElementById("statusBanner").hidden = true;
}


// =========================
// RENDER: TEAM CARDS + STANDINGS
// =========================
function recordText(teamId) {
    const r = state.standings[teamId];
    return r ? `${r.wins}–${r.losses}` : "";
}

function starHTML(team) {
    const isFav = state.favorites.includes(team.id);
    return `<button class="favorite-star ${isFav ? "active" : ""}" data-team-id="${team.id}"
                aria-pressed="${isFav}" title="${isFav ? "Remove from" : "Add to"} My Teams"
                aria-label="${isFav ? "Remove" : "Add"} ${esc(team.name)} ${isFav ? "from" : "to"} My Teams">${isFav ? "★" : "☆"}</button>`;
}

function teamCardHTML(team) {
    return `
        <div class="team-card" role="button" tabindex="0" data-team-id="${team.id}"
             aria-label="${esc(team.name)}: view roster">
            <img src="${logoUrl(team.id)}" data-fallback="${logoFallbackUrl(team.id)}" class="team-logo" alt="" loading="lazy">
            <span class="team-text">
                <span class="team-name">${esc(team.name)}</span>
                <span class="team-record">${recordText(team.id)}</span>
            </span>
            ${starHTML(team)}
        </div>`;
}

const CLINCH = {
    z: "Clinched best record / bye",
    y: "Clinched division",
    x: "Clinched playoff spot",
    w: "Clinched wild card",
    e: "Eliminated"
};

function renderDivisions(records) {
    // Clear every table first: older seasons had fewer divisions (no Central before 1994)
    Object.values(DIVISION_IDS).forEach(key => {
        document.getElementById(`${key}-standings`).innerHTML = "";
    });

    // Team cards, ordered by standings rank when available
    Object.values(DIVISION_IDS).forEach(key => {
        const teams = state.teams
            .filter(t => t.divKey === key)
            .sort((a, b) =>
                (Number(state.standings[a.id]?.divisionRank) || 99) - (Number(state.standings[b.id]?.divisionRank) || 99)
                || a.name.localeCompare(b.name));
        const grid = document.getElementById(key); // optional card grid per division
        if (grid) grid.innerHTML = teams.map(teamCardHTML).join("");
    });

    // Standings tables
    const usedClinch = new Set();
    records.forEach(div => {
        const key = divisionKey(div.division);
        if (!key) return;

        const rows = div.teamRecords.map(tr => {
            const t = tr.team;
            const lastTen = tr.records?.splitRecords?.find(s => s.type === "lastTen");
            const clinch = tr.clinchIndicator;
            if (clinch && CLINCH[clinch]) usedClinch.add(clinch);
            const isFav = state.favorites.includes(t.id);
            return `
                <tr class="standings-row ${isFav ? "fav-row" : ""}" data-team-id="${t.id}" tabindex="0"
                    aria-label="${esc(t.name)}: view roster">
                    <td class="team-cell"><div class="team-cell-inner">
                        <img src="${logoUrl(t.id)}" data-fallback="${logoFallbackUrl(t.id)}" alt="" class="mini-logo" loading="lazy">
                        <span class="full-name">${esc(t.name)}</span>
                        <span class="short-name">${esc(t.abbreviation || t.teamName || t.name)}</span>
                        ${clinch && CLINCH[clinch] ? `<span class="clinch" title="${CLINCH[clinch]}">${clinch}</span>` : ""}
                    </div></td>
                    <td>${tr.wins}</td>
                    <td>${tr.losses}</td>
                    <td>${esc(tr.winningPercentage)}</td>
                    <td>${esc(tr.gamesBack)}</td>
                    <td class="hide-sm">${lastTen ? `${lastTen.wins}-${lastTen.losses}` : "—"}</td>
                    <td class="hide-sm">${esc(tr.streak?.streakCode || "—")}</td>
                    <td class="star-cell">${starHTML(teamById(t.id) || t)}</td>
                </tr>`;
        }).join("");

        document.getElementById(`${key}-standings`).innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th class="team-col">Team</th>
                        <th title="Wins">W</th>
                        <th title="Losses">L</th>
                        <th title="Winning percentage">PCT</th>
                        <th title="Games back">GB</th>
                        <th class="hide-sm" title="Last 10 games">L10</th>
                        <th class="hide-sm" title="Current streak">STRK</th>
                        <th class="star-cell"><span class="visually-hidden">Favorite</span></th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>`;
    });

    // One key for the playoff letters, shown under the standings
    const legendEl = document.getElementById("clinchLegend");
    const order = Object.keys(CLINCH).filter(k => usedClinch.has(k));
    legendEl.innerHTML = order.map(k => `<span><b>${k}</b> ${CLINCH[k]}</span>`).join("");
    legendEl.hidden = order.length === 0;

    applySearch(document.getElementById("teamSearch").value);
}

function renderFavorites() {
    const favTeams = state.favorites.map(teamById).filter(Boolean);
    document.getElementById("favoritesGrid").innerHTML = favTeams.map(teamCardHTML).join("");
    document.getElementById("favoritesEmpty").hidden = favTeams.length > 0;
}

function toggleFavorite(teamId) {
    const team = teamById(teamId);
    if (!team) return;
    const wasFav = state.favorites.includes(team.id);

    if (wasFav) {
        state.favorites = state.favorites.filter(id => id !== team.id);
        // If this team was the color theme, switch to another favorite (or none)
        if (localStorage.getItem("favoriteTeamTheme") === team.name) {
            const next = teamById(state.favorites[state.favorites.length - 1]);
            if (next) localStorage.setItem("favoriteTeamTheme", next.name);
            else localStorage.removeItem("favoriteTeamTheme");
        }
        showToast(`Removed ${team.name} from My Teams`);
    } else {
        state.favorites.push(team.id);
        localStorage.setItem("favoriteTeamTheme", team.name);
        showToast(getThemeChoice() === "team"
            ? `Added ${team.name} to My Teams · colors updated`
            : `Added ${team.name} to My Teams`);
    }
    writeJSON("favorites", state.favorites);
    if (getThemeChoice() === "team") applyThemeChoice("team");

    // Update every star + standings row for this team
    const isFav = !wasFav;
    document.querySelectorAll(`.favorite-star[data-team-id="${team.id}"]`).forEach(star => {
        star.classList.toggle("active", isFav);
        star.textContent = isFav ? "★" : "☆";
        star.setAttribute("aria-pressed", isFav);
        star.title = `${isFav ? "Remove from" : "Add to"} My Teams`;
        star.setAttribute("aria-label", `${isFav ? "Remove" : "Add"} ${team.name} ${isFav ? "from" : "to"} My Teams`);
    });
    document.querySelectorAll(`.standings-row[data-team-id="${team.id}"]`).forEach(r => r.classList.toggle("fav-row", isFav));
    renderFavorites();
    applySearch(document.getElementById("teamSearch").value);
}

function setupTeamInteractions() {
    document.addEventListener("click", e => {
        const star = e.target.closest(".favorite-star");
        if (star) {
            e.stopPropagation();
            toggleFavorite(star.dataset.teamId);
            return;
        }
        const card = e.target.closest(".team-card, .standings-row");
        if (card) {
            const team = teamById(card.dataset.teamId);
            if (team) openRosterModal(team, card);
        }
    });

    document.addEventListener("keydown", e => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const card = e.target.closest?.(".team-card, .standings-row");
        if (card && e.target === card) {
            e.preventDefault();
            const team = teamById(card.dataset.teamId);
            if (team) openRosterModal(team, card);
        }
    });
}


// =========================
// SEARCH + DIVISION OPEN/CLOSE
// =========================
function setupSearch() {
    const input = document.getElementById("teamSearch");
    input.addEventListener("input", () => applySearch(input.value));
    input.addEventListener("keydown", e => {
        if (e.key === "Escape" && input.value) {
            input.value = "";
            applySearch("");
            e.stopPropagation();
        }
    });

    // Press "/" anywhere to jump to search
    document.addEventListener("keydown", e => {
        if (e.key === "/" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && !anyModalOpen()) {
            e.preventDefault();
            input.focus();
        }
    });
}

function teamMatches(team, q) {
    return [team.name, team.abbreviation, team.teamName, team.locationName, team.franchiseName, team.clubName, team.shortName]
        .filter(Boolean)
        .some(v => v.toLowerCase().includes(q));
}

function applySearch(raw) {
    const q = raw.trim().toLowerCase();
    const wasSearching = state.searching;
    state.searching = q.length > 0;

    let totalMatches = 0;
    document.querySelectorAll("details[data-division]").forEach(details => {
        let matches = 0;
        details.querySelectorAll(".team-card, .standings-row").forEach(el => {
            const team = teamById(el.dataset.teamId);
            const show = !q || (team && teamMatches(team, q));
            el.hidden = !show;
            if (show && el.classList.contains("standings-row")) matches++;
        });
        totalMatches += matches;
        const hasTeams = details.querySelector(".standings-row") !== null;
        details.hidden = !hasTeams || (q && matches === 0);
        if (q && matches > 0) details.open = true;
    });

    document.querySelectorAll("section.league").forEach(sec => {
        sec.hidden = state.teams.length > 0 && !sec.querySelector("details:not([hidden])");
    });

    // Favorites follow the search too
    document.querySelectorAll("#favoritesGrid .team-card").forEach(el => {
        const team = teamById(el.dataset.teamId);
        el.hidden = q && !(team && teamMatches(team, q));
    });
    document.getElementById("favorites-section").hidden = q && !document.querySelector("#favoritesGrid .team-card:not([hidden])");

    document.getElementById("noResults").hidden = !(q && state.teams.length && totalMatches === 0);

    // Search cleared: put divisions back the way the user had them
    if (wasSearching && !state.searching) restoreDivisionState();
    updateToggleAllLabel();
}

function restoreDivisionState() {
    const saved = readJSON("divisionsOpen", null);
    if (!saved) return;
    document.querySelectorAll("details[data-division]").forEach(d => {
        if (d.dataset.division in saved) d.open = saved[d.dataset.division];
    });
}

function saveDivisionState() {
    if (state.searching) return; // don't remember auto-opened divisions from a search
    const open = {};
    document.querySelectorAll("details[data-division]").forEach(d => { open[d.dataset.division] = d.open; });
    writeJSON("divisionsOpen", open);
}

function setupDivisionToggles() {
    document.querySelectorAll("details[data-division]").forEach(d => {
        d.addEventListener("toggle", () => {
            saveDivisionState();
            updateToggleAllLabel();
        });
    });

    document.getElementById("toggleAllBtn").addEventListener("click", () => {
        const all = [...document.querySelectorAll("details[data-division]:not([hidden])")];
        const anyClosed = all.some(d => !d.open);
        all.forEach(d => { d.open = anyClosed; });
    });
}

function updateToggleAllLabel() {
    const all = [...document.querySelectorAll("details[data-division]:not([hidden])")];
    document.getElementById("toggleAllBtn").textContent = all.some(d => !d.open) ? "Expand all" : "Collapse all";
}


// =========================
// SIDE MENU (SETTINGS)
// =========================
function setupMenu() {
    const menuBtn = document.getElementById("menuBtn");
    const sideMenu = document.getElementById("sideMenu");
    const backdrop = document.getElementById("menuBackdrop");

    const openMenu = () => {
        sideMenu.classList.add("active");
        sideMenu.setAttribute("aria-hidden", "false");
        menuBtn.setAttribute("aria-expanded", "true");
        backdrop.hidden = false;
        setTimeout(() => document.getElementById("gamesBtn").focus(), 60);
    };
    const closeMenu = (returnFocus = true) => {
        if (!sideMenu.classList.contains("active")) return;
        sideMenu.classList.remove("active");
        sideMenu.setAttribute("aria-hidden", "true");
        menuBtn.setAttribute("aria-expanded", "false");
        backdrop.hidden = true;
        if (returnFocus) menuBtn.focus();
    };

    menuBtn.addEventListener("click", () =>
        sideMenu.classList.contains("active") ? closeMenu() : openMenu());
    document.getElementById("closeMenuBtn").addEventListener("click", () => closeMenu());
    backdrop.addEventListener("click", () => closeMenu(false));
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && sideMenu.classList.contains("active")) closeMenu();
    });

    // Theme picker
    document.getElementById("theme").addEventListener("change", e => {
        setThemeChoice(e.target.value);
        const label = e.target.options[e.target.selectedIndex].text;
        showToast(`Theme: ${label}`);
    });

    // Reset theme
    document.getElementById("resetThemeBtn").addEventListener("click", () => {
        localStorage.removeItem("favoriteTeamTheme");
        setThemeChoice("classic");
        showToast("Theme reset to Ballpark");
    });

    // Help
    const openHelp = () => { closeMenu(false); openModal("helpModal"); };
    document.getElementById("helpBtn").addEventListener("click", openHelp);
    document.getElementById("helpBtnHeader").addEventListener("click", openHelp);
}


// =========================
// MODALS (open/close, Esc, focus)
// =========================
const modalStack = []; // [{id, returnFocus}]

function anyModalOpen() {
    return modalStack.length > 0;
}

function openModal(id, opener) {
    const modal = document.getElementById(id);
    if (!modal.hidden) return;
    modal.hidden = false;
    modalStack.push({ id, returnFocus: opener || document.activeElement });
    document.documentElement.classList.add("no-scroll");
    modal.querySelector(".close-btn")?.focus();
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal.hidden) return;
    modal.hidden = true;
    const idx = modalStack.findIndex(m => m.id === id);
    const entry = idx >= 0 ? modalStack.splice(idx, 1)[0] : null;
    if (!modalStack.length) document.documentElement.classList.remove("no-scroll");
    if (entry?.returnFocus && document.contains(entry.returnFocus)) entry.returnFocus.focus();
}

function setupModals() {
    document.getElementById("closeModal").addEventListener("click", () => closeModal("rosterModal"));
    document.getElementById("closeHelp").addEventListener("click", () => closeModal("helpModal"));
    document.getElementById("backToRoster").addEventListener("click", () => closeModal("playerModal"));
    document.getElementById("closePlayerModal").addEventListener("click", () => {
        closeModal("playerModal");
        closeModal("rosterModal");
    });

    // Click on the dark backdrop closes that modal
    document.querySelectorAll(".modal").forEach(modal => {
        modal.addEventListener("click", e => {
            if (e.target === modal) closeModal(modal.id);
        });
    });

    // Esc closes the top-most modal
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && modalStack.length) {
            closeModal(modalStack[modalStack.length - 1].id);
        }
    });

    // Roster tabs
    document.getElementById("rosterTabs").addEventListener("click", e => {
        const btn = e.target.closest(".tab-btn");
        if (!btn) return;
        state.currentTab = btn.dataset.tab;
        renderRoster();
    });

    // Sorting + player click inside the roster
    document.getElementById("rosterBody").addEventListener("click", e => {
        const sortBtn = e.target.closest("[data-sort]");
        if (sortBtn) {
            const tab = state.currentTab;
            const key = sortBtn.dataset.sort;
            const col = columnsFor(tab).find(c => c.key === key);
            const cur = state.sort[tab];
            state.sort[tab] = cur.key === key ? { key, dir: -cur.dir } : { key, dir: col.firstDir || -1 };
            renderRoster();
            document.querySelector(`#rosterBody [data-sort="${key}"]`)?.focus();
            return;
        }
        if (e.target.closest("#rosterRetry")) {
            delete state.rosterCache[rosterKey(state.currentTeam.id)];
            openRosterModal(state.currentTeam);
            return;
        }
        const row = e.target.closest(".player-row");
        if (row) openPlayerModal(Number(row.dataset.id), row);
    });

    document.getElementById("rosterBody").addEventListener("keydown", e => {
        if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("player-row")) {
            e.preventDefault();
            openPlayerModal(Number(e.target.dataset.id), e.target);
        }
    });
}


// =========================
// ROSTER MODAL + PLAYER STATS
// =========================
const POS_ORDER = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "IF", "DH", "TWP", "P"];

const num = v => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
};

const HITTER_COLUMNS = [
    { key: "name", label: "Player", firstDir: 1, sortVal: p => p.lastName },
    { key: "pos", label: "Pos", firstDir: 1, sortVal: p => POS_ORDER.indexOf(p.pos) === -1 ? 99 : POS_ORDER.indexOf(p.pos) },
    { key: "g", label: "G", title: "Games", stat: s => s.gamesPlayed },
    { key: "ab", label: "AB", title: "At bats", stat: s => s.atBats },
    { key: "avg", label: "AVG", title: "Batting average", stat: s => s.avg },
    { key: "hr", label: "HR", title: "Home runs", stat: s => s.homeRuns },
    { key: "rbi", label: "RBI", title: "Runs batted in", stat: s => s.rbi },
    { key: "sb", label: "SB", title: "Stolen bases", stat: s => s.stolenBases },
    { key: "obp", label: "OBP", title: "On-base percentage", stat: s => s.obp },
    { key: "ops", label: "OPS", title: "On-base plus slugging", stat: s => s.ops }
];

const PITCHER_COLUMNS = [
    { key: "name", label: "Player", firstDir: 1, sortVal: p => p.lastName },
    { key: "role", label: "Role", title: "SP = starter, RP = reliever", firstDir: 1,
        sortVal: p => (p.role === "SP" ? 0 : p.role === "RP" ? 1 : 2) * 1000 - (num(p.pitching?.inningsPitched) || 0) },
    { key: "w-l", label: "W-L", title: "Wins-losses", stat: s => s.wins, display: s => s.wins != null ? `${s.wins}-${s.losses}` : null },
    { key: "era", label: "ERA", title: "Earned run average (lower is better)", firstDir: 1, stat: s => s.era },
    { key: "g", label: "G", title: "Games pitched", stat: s => s.gamesPitched },
    { key: "gs", label: "GS", title: "Games started", stat: s => s.gamesStarted },
    { key: "sv", label: "SV", title: "Saves", stat: s => s.saves },
    { key: "ip", label: "IP", title: "Innings pitched", stat: s => s.inningsPitched },
    { key: "so", label: "SO", title: "Strikeouts", stat: s => s.strikeOuts },
    { key: "whip", label: "WHIP", title: "Walks + hits per inning (lower is better)", firstDir: 1, stat: s => s.whip }
];

const columnsFor = tab => (tab === "pitchers" ? PITCHER_COLUMNS : HITTER_COLUMNS);

function parseRoster(roster) {
    return roster.map(entry => {
        const person = entry.person || {};
        const statsFor = group =>
            person.stats?.find(s => s.group?.displayName === group && s.type?.displayName === "season")?.splits?.[0]?.stat || null;
        const pos = entry.position?.abbreviation || person.primaryPosition?.abbreviation || "";
        const posType = entry.position?.type || person.primaryPosition?.type || "";
        const pitching = statsFor("pitching");

        let role = "";
        if (pitching) {
            role = (pitching.gamesStarted || 0) >= Math.max(1, (pitching.gamesPitched || 0) / 2) ? "SP" : "RP";
        }

        const isPitcher = posType === "Pitcher" || pos === "P";
        const isTwoWay = posType === "Two-Way Player" || pos === "TWP";

        return {
            id: person.id,
            name: person.fullName,
            lastName: person.lastName || person.fullName,
            number: entry.jerseyNumber || person.primaryNumber || "",
            pos,
            posName: entry.position?.name || person.primaryPosition?.name || pos,
            person,
            hitting: statsFor("hitting"),
            pitching,
            role,
            inPitchers: isPitcher || isTwoWay,
            inHitters: !isPitcher || isTwoWay
        };
    });
}

const rosterKey = teamId => `${state.season}-${teamId}`;

async function openRosterModal(team, opener) {
    state.currentTeam = team;
    state.currentTab = "hitters";
    if (typeof resetTeamView === "function") resetTeamView();

    document.getElementById("teamNameModal").textContent = team.name;
    const logo = document.getElementById("teamLogoModal");
    logo.dataset.fallback = logoFallbackUrl(team.id);
    logo.src = logoUrl(team.id);
    document.getElementById("rosterSub").textContent = recordText(team.id)
        ? `${recordText(team.id)} · ${state.season} season stats`
        : `${state.season} season stats`;
    document.getElementById("rosterTabs").innerHTML = "";
    document.getElementById("rosterBody").innerHTML =
        `<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading roster…</div>`;
    openModal("rosterModal", opener);

    const key = rosterKey(team.id);
    if (!state.rosterCache[key]) {
        try {
            // One request gets the whole active roster *with* each player's season stats
            const data = await fetchJSON(
                `${MLB_API}/teams/${team.id}/roster?rosterType=${state.season === SEASON ? "active" : "fullSeason"}&season=${state.season}` +
                `&hydrate=person(stats(type=season,season=${state.season},group=[hitting,pitching]))`
            );
            state.rosterCache[key] = parseRoster(data.roster || []);
        } catch (err) {
            console.error("Roster Load Error:", err);
            if (state.currentTeam !== team) return;
            document.getElementById("rosterBody").innerHTML = `
                <div class="loading-block error">
                    Couldn't load the ${esc(team.name)} roster.
                    <button class="ghost-btn" id="rosterRetry">Try again</button>
                </div>`;
            return;
        }
    }
    // The user may have clicked a different team while this one was loading
    if (state.currentTeam === team && state.teamView !== "games") renderRoster();
}

function renderRoster() {
    const players = state.rosterCache[rosterKey(state.currentTeam.id)] || [];
    const hitters = players.filter(p => p.inHitters);
    const pitchers = players.filter(p => p.inPitchers);
    const tab = state.currentTab;

    document.getElementById("rosterTabs").innerHTML = [
        { key: "hitters", label: `Hitters (${hitters.length})` },
        { key: "pitchers", label: `Pitchers (${pitchers.length})` }
    ].map(t => `
        <button class="tab-btn ${t.key === tab ? "active" : ""}" role="tab"
                aria-selected="${t.key === tab}" data-tab="${t.key}">${t.label}</button>`).join("");

    const list = tab === "pitchers" ? pitchers : hitters;
    const statGroup = tab === "pitchers" ? "pitching" : "hitting";
    const columns = columnsFor(tab);
    const { key: sortKey, dir } = state.sort[tab];
    const sortCol = columns.find(c => c.key === sortKey) || columns[0];

    const valueFor = (p, col) => {
        if (col.sortVal) return col.sortVal(p);
        const s = p[statGroup];
        return s ? num(col.stat(s)) : null;
    };

    const sorted = [...list].sort((a, b) => {
        const va = valueFor(a, sortCol);
        const vb = valueFor(b, sortCol);
        // Players without stats always go to the bottom
        if (va === null && vb === null) return a.lastName.localeCompare(b.lastName);
        if (va === null) return 1;
        if (vb === null) return -1;
        if (typeof va === "string") return va.localeCompare(vb) * dir;
        return (va - vb) * dir || a.lastName.localeCompare(b.lastName);
    });

    const head = columns.map(c => {
        const active = c.key === sortCol.key;
        const ariaSort = active ? (dir === 1 ? "ascending" : "descending") : "none";
        const arrow = active ? (dir === 1 ? " ▲" : " ▼") : "";
        return `<th class="${c.key === "name" ? "name-col" : ""}" aria-sort="${ariaSort}">
                    <button data-sort="${c.key}" title="${esc(c.title || "Sort by " + c.label)}">${c.label}${arrow}</button>
                </th>`;
    }).join("");

    const body = sorted.map(p => {
        const s = p[statGroup];
        const cells = columns.map(c => {
            if (c.key === "name") {
                return `<td class="name-col"><div class="name-cell">
                    <img src="${headshotUrl(p.id)}" class="player-headshot" alt="" loading="lazy">
                    <span class="player-name-wrap">
                        <strong>${esc(p.name)}</strong>
                        <small>${p.number ? "#" + esc(p.number) : ""}</small>
                    </span>
                </div></td>`;
            }
            if (c.key === "pos") return `<td>${esc(p.pos)}</td>`;
            if (c.key === "role") return `<td>${esc(p.role || (p.pos === "TWP" ? "TWP" : "—"))}</td>`;
            const v = s ? (c.display ? c.display(s) : c.stat(s)) : null;
            return `<td>${v ?? "—"}</td>`;
        }).join("");
        return `<tr class="player-row" data-id="${p.id}" tabindex="0" aria-label="${esc(p.name)}: view details">${cells}</tr>`;
    }).join("");

    const noStats = list.length && list.every(p => !p[statGroup]);

    document.getElementById("rosterBody").innerHTML = list.length ? `
        <p class="table-hint">${noStats
            ? `No ${state.season} stats yet for these players.`
            : "Click a column to sort · click a player for details"}</p>
        <div class="table-scroll">
            <table class="stats-table">
                <thead><tr>${head}</tr></thead>
                <tbody>${body}</tbody>
            </table>
        </div>`
        : `<div class="loading-block">No players listed.</div>`;
}


// =========================
// SEASON PICKER
// =========================
const FIRST_SEASON = 1969; // first year MLB had divisions

function setupSeasonPicker() {
    const select = document.getElementById("seasonSelect");
    let options = "";
    for (let y = SEASON; y >= FIRST_SEASON; y--) options += `<option value="${y}">${y}</option>`;
    select.innerHTML = options;
    select.value = String(state.season);

    select.addEventListener("change", () => {
        state.season = Number(select.value);
        document.getElementById("seasonLabel").textContent = state.season;
        loadData();
    });
}


// =========================
// CAREER + YEAR-BY-YEAR DATA (shared by player window and compare)
// =========================
const HIT_STATS = [
    { key: "gamesPlayed", label: "G", title: "Games" },
    { key: "plateAppearances", label: "PA", title: "Plate appearances" },
    { key: "atBats", label: "AB", title: "At bats" },
    { key: "runs", label: "R", title: "Runs" },
    { key: "hits", label: "H", title: "Hits" },
    { key: "doubles", label: "2B", title: "Doubles" },
    { key: "triples", label: "3B", title: "Triples" },
    { key: "homeRuns", label: "HR", title: "Home runs" },
    { key: "rbi", label: "RBI", title: "Runs batted in" },
    { key: "stolenBases", label: "SB", title: "Stolen bases" },
    { key: "baseOnBalls", label: "BB", title: "Walks" },
    { key: "strikeOuts", label: "SO", title: "Strikeouts", lowerIsBetter: true },
    { key: "avg", label: "AVG", title: "Batting average" },
    { key: "obp", label: "OBP", title: "On-base percentage" },
    { key: "slg", label: "SLG", title: "Slugging percentage" },
    { key: "ops", label: "OPS", title: "On-base plus slugging" }
];

const PITCH_STATS = [
    { key: "wins", label: "W", title: "Wins" },
    { key: "losses", label: "L", title: "Losses", lowerIsBetter: true },
    { key: "era", label: "ERA", title: "Earned run average", lowerIsBetter: true },
    { key: "gamesPitched", label: "G", title: "Games pitched" },
    { key: "gamesStarted", label: "GS", title: "Games started" },
    { key: "saves", label: "SV", title: "Saves" },
    { key: "inningsPitched", label: "IP", title: "Innings pitched" },
    { key: "strikeOuts", label: "SO", title: "Strikeouts" },
    { key: "baseOnBalls", label: "BB", title: "Walks allowed", lowerIsBetter: true },
    { key: "homeRuns", label: "HR", title: "Home runs allowed", lowerIsBetter: true },
    { key: "whip", label: "WHIP", title: "Walks + hits per inning", lowerIsBetter: true },
    { key: "avg", label: "Opp AVG", title: "Opponents' batting average", lowerIsBetter: true }
];

// Short stat lists for the year-by-year tables
const HIT_YEAR_KEYS = ["gamesPlayed", "atBats", "hits", "homeRuns", "rbi", "stolenBases", "avg", "obp", "ops"];
const PITCH_YEAR_KEYS = ["wins", "losses", "era", "gamesPitched", "gamesStarted", "saves", "inningsPitched", "strikeOuts", "whip"];

const statDefs = group => (group === "pitching" ? PITCH_STATS : HIT_STATS);

function teamShort(team) {
    if (!team) return "";
    return state.teamAbbr[team.id] || team.abbreviation || team.name || "";
}

// Turn an MLB "people" record (hydrated with career + yearByYear stats) into something easy to use
function parseCareer(person) {
    const out = { person, hitting: null, pitching: null };
    ["hitting", "pitching"].forEach(group => {
        const entries = (person.stats || []).filter(s => s.group?.displayName === group);
        const isMLB = sp => !sp.sport || sp.sport.id === 1;
        const career = entries.find(s => s.type?.displayName === "career")?.splits?.find(isMLB)?.stat || null;
        const yearSplits = (entries.find(s => s.type?.displayName === "yearByYear")?.splits || []).filter(isMLB);

        // One row per season. Traded players have a row per team plus a combined row (no team).
        const bySeason = new Map();
        yearSplits.forEach(sp => {
            if (!bySeason.has(sp.season)) bySeason.set(sp.season, []);
            bySeason.get(sp.season).push(sp);
        });
        const years = [...bySeason.entries()]
            .map(([season, splits]) => {
                const teamSplits = splits.filter(sp => sp.team);
                const total = splits.find(sp => !sp.team) || splits[0];
                const teamLabel = teamSplits.length > 1
                    ? teamSplits.map(sp => teamShort(sp.team)).join(" / ")
                    : teamShort(total.team || teamSplits[0]?.team);
                return { season: Number(season), team: teamLabel, stat: total.stat };
            })
            .sort((a, b) => a.season - b.season);

        if (career || years.length) out[group] = { career, years };
    });
    return out;
}

async function loadCareers(ids) {
    const missing = ids.filter(id => !state.careerCache[id]);
    if (missing.length) {
        const data = await fetchJSON(
            `${MLB_API}/people?personIds=${missing.join(",")}` +
            `&hydrate=currentTeam,stats(group=[hitting,pitching],type=[career,yearByYear])`
        );
        (data.people || []).forEach(person => { state.careerCache[person.id] = parseCareer(person); });
    }
    return ids.map(id => state.careerCache[id]).filter(Boolean);
}

function seasonSpan(career, group) {
    const years = career?.[group]?.years || [];
    if (!years.length) return "";
    const first = years[0].season;
    const last = years[years.length - 1].season;
    return first === last ? `${first}` : `${first}–${last}`;
}

// Which stat groups matter for a player (pitchers: pitching, two-way: both, everyone else: hitting)
function groupsFor(person) {
    const type = person?.primaryPosition?.type || "";
    const abbr = person?.primaryPosition?.abbreviation || "";
    if (type === "Two-Way Player" || abbr === "TWP") return ["hitting", "pitching"];
    if (type === "Pitcher" || abbr === "P") return ["pitching"];
    return ["hitting"];
}


// =========================
// PLAYER WINDOW
// =========================
function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso + "T12:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function statTiles(title, items) {
    const tiles = items
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([label, v]) => `<div class="stat-tile"><span>${label}</span><strong>${esc(v)}</strong></div>`)
        .join("");
    return tiles ? `<h3 class="stats-title">${title}</h3><div class="stat-tiles">${tiles}</div>` : "";
}

function hittingTiles(title, h) {
    return statTiles(title, [
        ["G", h.gamesPlayed], ["AVG", h.avg], ["HR", h.homeRuns], ["RBI", h.rbi],
        ["R", h.runs], ["H", h.hits], ["SB", h.stolenBases], ["BB", h.baseOnBalls],
        ["SO", h.strikeOuts], ["OBP", h.obp], ["SLG", h.slg], ["OPS", h.ops]
    ]);
}

function pitchingTiles(title, pi) {
    return statTiles(title, [
        ["W-L", pi.wins != null ? `${pi.wins}-${pi.losses}` : null], ["ERA", pi.era], ["G", pi.gamesPitched], ["GS", pi.gamesStarted],
        ["SV", pi.saves], ["IP", pi.inningsPitched], ["SO", pi.strikeOuts], ["BB", pi.baseOnBalls],
        ["WHIP", pi.whip], ["HR", pi.homeRuns], ["AVG", pi.avg], ["HLD", pi.holds]
    ]);
}

function yearTable(group, data) {
    const keys = group === "pitching" ? PITCH_YEAR_KEYS : HIT_YEAR_KEYS;
    const defs = keys.map(k => statDefs(group).find(d => d.key === k));
    const head = `<tr><th class="name-col"><span class="th-text">Year</span></th><th><span class="th-text">Team</span></th>${
        defs.map(d => `<th title="${esc(d.title)}"><span class="th-text">${d.label}</span></th>`).join("")}</tr>`;
    const rows = data.years.map(y => `
        <tr><td class="name-col">${y.season}</td><td class="team-td">${esc(y.team)}</td>${
        defs.map(d => `<td>${esc(y.stat?.[d.key] ?? "—")}</td>`).join("")}</tr>`).join("");
    const careerRow = data.career ? `
        <tr class="career-row"><td class="name-col">Career</td><td></td>${
        defs.map(d => `<td>${esc(data.career[d.key] ?? "—")}</td>`).join("")}</tr>` : "";
    return `
        <h3 class="stats-title">${group === "pitching" ? "Pitching" : "Hitting"} by year</h3>
        <div class="table-scroll"><table class="stats-table year-table">
            <thead>${head}</thead><tbody>${rows}${careerRow}</tbody>
        </table></div>`;
}

let currentPlayer = null; // player shown in the player window

function openPlayerModal(id, opener) {
    const entry = (state.rosterCache[rosterKey(state.currentTeam?.id)] || []).find(x => x.id === id);
    if (!entry) return;
    showPlayer({ ...entry, teamName: state.currentTeam.name, fromRoster: true }, opener);
}

// p: { id, name, number, posName, person, teamName, hitting, pitching, inHitters, inPitchers, fromRoster }
function showPlayer(p, opener) {
    currentPlayer = p;
    const id = p.id;
    const person = p.person;
    document.getElementById("backToRoster").hidden = !p.fromRoster || document.getElementById("rosterModal").hidden;
    if (typeof rememberPlayer === "function") rememberPlayer(p);

    const img = document.getElementById("playerHeadshot");
    img.src = headshotUrl(id, 300);
    img.alt = `${p.name} headshot`;
    document.getElementById("playerName").textContent = p.name;
    document.getElementById("playerTeam").textContent =
        [p.number ? `#${p.number}` : "", p.posName, p.teamName].filter(Boolean).join(" · ");

    const born = [person.birthCity, person.birthStateProvince || person.birthCountry].filter(Boolean).join(", ");
    const bio = [
        ["Age", person.currentAge],
        ["Bats / Throws", person.batSide && person.pitchHand ? `${person.batSide.code} / ${person.pitchHand.code}` : null],
        ["Height", person.height],
        ["Weight", person.weight ? `${person.weight} lbs` : null],
        ["Born", born || null],
        ["MLB debut", person.mlbDebutDate ? formatDate(person.mlbDebutDate) : null]
    ];
    document.getElementById("playerInfo").innerHTML = bio
        .map(([label, v]) => `<div><span>${label}</span><strong>${esc(v ?? "—")}</strong></div>`)
        .join("");

    state.playerView = "season";
    renderPlayerView();
    openModal("playerModal", opener);

    // Fetch career numbers in the background so the Career / By year tabs open instantly
    loadCareers([id]).then(() => {
        if (currentPlayer === p && state.playerView !== "season") renderPlayerView();
    }).catch(err => console.warn("Career stats unavailable:", err));
}

async function renderPlayerView() {
    const p = currentPlayer;
    if (!p) return;
    const view = state.playerView;
    const yr = p.season || state.season; // season this window was opened for

    document.getElementById("playerViewTabs").innerHTML = [
        { key: "season", label: `${yr}` },
        { key: "career", label: "Career" },
        { key: "years", label: "By year" },
        { key: "games", label: "Game log" },
        { key: "splits", label: "Splits" }
    ].map(t => `<button class="tab-btn ${t.key === view ? "active" : ""}" data-view="${t.key}"
        aria-pressed="${t.key === view}">${t.label}</button>`).join("");

    const box = document.getElementById("playerStats");
    const groups = [p.inHitters && "hitting", p.inPitchers && "pitching"].filter(Boolean);

    if (view === "games" || view === "splits") {
        (view === "games" ? renderGameLog : renderSplits)(p, box, groups);
        return;
    }

    if (view === "season") {
        let html = "";
        if (p.inHitters && p.hitting) html += hittingTiles(`${yr} hitting`, p.hitting);
        if (p.inPitchers && p.pitching) html += pitchingTiles(`${yr} pitching`, p.pitching);
        box.innerHTML = html || `<p class="empty-hint">No ${yr} stats for this player.</p>`;
        return;
    }

    let career = state.careerCache[p.id];
    if (!career) {
        box.innerHTML = `<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading career stats…</div>`;
        try {
            [career] = await loadCareers([p.id]);
        } catch {
            box.innerHTML = `<p class="empty-hint">Career stats couldn't be loaded. Try again in a moment.</p>`;
            return;
        }
        if (currentPlayer !== p || state.playerView !== view) return;
    }

    let html = "";
    groups.forEach(group => {
        const data = career?.[group];
        if (!data) return;
        if (view === "career" && data.career) {
            const span = seasonSpan(career, group);
            const label = group === "pitching" ? "Career pitching" : "Career hitting";
            html += (group === "pitching" ? pitchingTiles : hittingTiles)(
                `${label}${span ? ` <small>${span} · ${data.years.length} season${data.years.length === 1 ? "" : "s"}</small>` : ""}`,
                data.career);
        }
        if (view === "years" && data.years.length) html += `<div class="chart-slot" data-group="${group}"></div>` + yearTable(group, data);
    });
    box.innerHTML = html || `<p class="empty-hint">No MLB career stats for this player yet.</p>`;
    if (view === "years") {
        box.querySelectorAll(".chart-slot").forEach(slot => renderCareerChart(slot, career, slot.dataset.group));
    }
}

function setupPlayerWindow() {
    document.getElementById("playerViewTabs").addEventListener("click", e => {
        const btn = e.target.closest("[data-view]");
        if (!btn) return;
        state.playerView = btn.dataset.view;
        renderPlayerView();
    });
    document.getElementById("compareFromPlayer").addEventListener("click", () => {
        if (!currentPlayer) return;
        addToCompare(currentPlayer.id, currentPlayer.person);
        openCompare(document.getElementById("compareFromPlayer"));
    });
}


// =========================
// COMPARE PLAYERS
// =========================
const MAX_COMPARE = 4;

const compare = {
    ids: readJSON("compareIds", []).map(Number).filter(Boolean).slice(0, MAX_COMPARE),
    mode: "career",       // career | season
    group: null,          // hitting | pitching (null = pick automatically)
    season: null,         // chosen season in "season" mode
    searchTimer: null,
    searchSeq: 0
};

function saveCompare() {
    writeJSON("compareIds", compare.ids);
}

function addToCompare(id, person) {
    id = Number(id);
    if (compare.ids.includes(id)) return true;
    if (compare.ids.length >= MAX_COMPARE) {
        showToast(`You can compare up to ${MAX_COMPARE} players. Remove one first.`);
        return false;
    }
    compare.ids.push(id);
    saveCompare();
    if (person && !state.careerCache[id]) {
        // Show the name right away; stats arrive with loadCareers
        compare.pending = compare.pending || {};
        compare.pending[id] = person;
    }
    return true;
}

function removeFromCompare(id) {
    compare.ids = compare.ids.filter(x => x !== Number(id));
    saveCompare();
    renderCompare();
}

function openCompare(opener) {
    openModal("compareModal", opener);
    document.getElementById("compareSearch").focus();
    renderCompare();
}

function setupCompare() {
    const input = document.getElementById("compareSearch");
    const results = document.getElementById("compareResults");

    document.getElementById("compareBtn").addEventListener("click", () => {
        document.getElementById("closeMenuBtn").click();
        openCompare(document.getElementById("menuBtn"));
    });
    document.getElementById("closeCompare").addEventListener("click", () => closeModal("compareModal"));

    input.addEventListener("input", () => {
        clearTimeout(compare.searchTimer);
        const q = input.value.trim();
        if (q.length < 2) { results.hidden = true; results.innerHTML = ""; return; }
        compare.searchTimer = setTimeout(() => searchPlayers(q), 250);
    });
    input.addEventListener("keydown", e => {
        if (e.key === "ArrowDown") {
            const first = results.querySelector("button");
            if (first) { e.preventDefault(); first.focus(); }
        }
        if (e.key === "Escape" && input.value) {
            e.stopPropagation();
            input.value = "";
            results.hidden = true;
        }
    });
    results.addEventListener("keydown", e => {
        const items = [...results.querySelectorAll("button")];
        const i = items.indexOf(document.activeElement);
        if (e.key === "ArrowDown" && i < items.length - 1) { e.preventDefault(); items[i + 1].focus(); }
        if (e.key === "ArrowUp") { e.preventDefault(); (i > 0 ? items[i - 1] : input).focus(); }
    });
    results.addEventListener("click", e => {
        const btn = e.target.closest("[data-person-id]");
        if (!btn) return;
        const person = compare.lastResults?.find(x => x.id === Number(btn.dataset.personId));
        const added = addToCompare(btn.dataset.personId, person);
        results.hidden = true;
        results.innerHTML = "";
        if (added) {
            input.value = "";
            input.focus();
            renderCompare();
        }
    });

    // Clicking anywhere else closes the search results
    document.getElementById("compareModal").addEventListener("click", e => {
        if (!e.target.closest(".compare-search")) results.hidden = true;
    });
    input.addEventListener("focus", () => {
        if (results.innerHTML && input.value.trim().length >= 2) results.hidden = false;
    });

    document.getElementById("compareChips").addEventListener("click", e => {
        const btn = e.target.closest("[data-remove]");
        if (btn) removeFromCompare(btn.dataset.remove);
    });

    document.getElementById("compareControls").addEventListener("click", e => {
        const g = e.target.closest("[data-cmp-group]");
        if (g) { compare.group = g.dataset.cmpGroup; compare.season = null; renderCompare(); return; }
        const m = e.target.closest("[data-cmp-mode]");
        if (m) { compare.mode = m.dataset.cmpMode; renderCompare(); return; }
        const v = e.target.closest("[data-cmp-view]");
        if (v) { compare.view = v.dataset.cmpView; renderCompare(); }
    });
    document.getElementById("compareSeason").addEventListener("change", e => {
        compare.season = Number(e.target.value);
        renderCompare();
    });

    document.getElementById("compareClear").addEventListener("click", () => {
        compare.ids = [];
        compare.group = null;
        compare.season = null;
        saveCompare();
        renderCompare();
    });
}

async function searchPlayers(q) {
    const results = document.getElementById("compareResults");
    const seq = ++compare.searchSeq;
    results.hidden = false;
    results.innerHTML = `<li class="result-note">Searching…</li>`;
    try {
        const data = await fetchJSON(`${MLB_API}/people/search?names=${encodeURIComponent(q)}&sportIds=1&limit=25`);
        if (seq !== compare.searchSeq) return; // a newer search is running
        // Only people who actually played in the majors
        const people = (data.people || []).filter(x => x.mlbDebutDate).slice(0, 8);
        compare.lastResults = people;
        results.innerHTML = people.length
            ? people.map(x => {
                const added = compare.ids.includes(x.id);
                const debut = x.mlbDebutDate.slice(0, 4);
                return `<li><button type="button" data-person-id="${x.id}" ${added ? "disabled" : ""}>
                    <img src="${headshotUrl(x.id, 60)}" alt="" loading="lazy">
                    <span><strong>${esc(x.fullName)}</strong>
                    <small>${esc(x.primaryPosition?.abbreviation || "")} · debut ${debut}${x.active ? " · active" : ""}${added ? " · added" : ""}</small></span>
                </button></li>`;
            }).join("")
            : `<li class="result-note">No MLB players match "${esc(q)}".</li>`;
    } catch (err) {
        if (seq !== compare.searchSeq) return;
        console.error("Player search error:", err);
        results.innerHTML = `<li class="result-note">Search isn't available right now. Try again in a moment.</li>`;
    }
}

function seasonLine(career, group, season) {
    return career?.[group]?.years.find(y => y.season === season) || null;
}

async function renderCompare() {
    const chips = document.getElementById("compareChips");
    const body = document.getElementById("compareBody");
    const controls = document.getElementById("compareControls");
    const clearBtn = document.getElementById("compareClear");

    if (!compare.ids.length) {
        chips.innerHTML = "";
        controls.hidden = true;
        clearBtn.hidden = true;
        body.innerHTML = `<p class="empty-hint compare-empty">Search for a player above to start. You can compare up to ${MAX_COMPARE}, past or present.</p>`;
        return;
    }
    clearBtn.hidden = false;

    // Chips first (names may be known before stats load)
    const nameOf = id => state.careerCache[id]?.person.fullName || compare.pending?.[id]?.fullName || "Loading…";
    const renderChips = () => {
        chips.innerHTML = compare.ids.map(id => {
            const c = state.careerCache[id];
            const span = c ? (seasonSpan(c, "hitting") || seasonSpan(c, "pitching")) : "";
            return `<span class="compare-chip">
                <span class="series-dot" style="background:var(--series-${compareSlot(id)})" aria-hidden="true"></span>
                <img src="${headshotUrl(id, 60)}" alt="" loading="lazy">
                <span><strong>${esc(nameOf(id))}</strong>${span ? `<small>${span}</small>` : ""}</span>
                <button type="button" data-remove="${id}" aria-label="Remove ${esc(nameOf(id))}">&times;</button>
            </span>`;
        }).join("");
    };
    renderChips();

    let careers;
    if (compare.ids.some(id => !state.careerCache[id])) {
        body.innerHTML = `<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading stats…</div>`;
        try {
            careers = await loadCareers(compare.ids);
        } catch (err) {
            console.error("Compare load error:", err);
            body.innerHTML = `<p class="empty-hint">Stats couldn't be loaded. Check your connection and try again.</p>`;
            return;
        }
        renderChips();
    }
    careers = compare.ids.map(id => state.careerCache[id]).filter(Boolean);
    const ids = careers.map(c => c.person.id);

    // Hitting or pitching: default to pitching only when every player is a pitcher
    const group = compare.group ||
        (careers.every(c => groupsFor(c.person)[0] === "pitching") ? "pitching" : "hitting");

    // Seasons available for this group; default to the latest year they all played
    const seasonSets = careers.map(c => new Set((c[group]?.years || []).map(y => y.season)));
    const allSeasons = [...new Set(seasonSets.flatMap(s => [...s]))].sort((a, b) => b - a);
    const shared = allSeasons.filter(y => seasonSets.every(s => s.has(y)));
    if (!compare.season || !allSeasons.includes(compare.season)) compare.season = shared[0] || allSeasons[0] || null;

    controls.hidden = false;
    controls.querySelectorAll("[data-cmp-group]").forEach(b => {
        b.classList.toggle("active", b.dataset.cmpGroup === group);
        b.setAttribute("aria-pressed", b.dataset.cmpGroup === group);
    });
    controls.querySelectorAll("[data-cmp-mode]").forEach(b => {
        b.classList.toggle("active", b.dataset.cmpMode === compare.mode);
        b.setAttribute("aria-pressed", b.dataset.cmpMode === compare.mode);
    });
    controls.querySelectorAll("[data-cmp-view]").forEach(b => {
        b.classList.toggle("active", b.dataset.cmpView === (compare.view || "table"));
        b.setAttribute("aria-pressed", b.dataset.cmpView === (compare.view || "table"));
    });
    const chartView = compare.view === "chart";
    document.getElementById("cmpModeTabs").hidden = chartView;
    const seasonSelect = document.getElementById("compareSeason");
    seasonSelect.hidden = chartView || compare.mode !== "season";
    if (chartView) {
        renderCompareChart(body, careers, group);
        return;
    }
    seasonSelect.innerHTML = allSeasons.map(y =>
        `<option value="${y}">${y}${seasonSets.length > 1 && shared.includes(y) ? "" : seasonSets.length > 1 ? " (not all played)" : ""}</option>`).join("");
    if (compare.season) seasonSelect.value = String(compare.season);

    // Build the rows
    const lines = careers.map(c => compare.mode === "career"
        ? (c[group]?.career ? { stat: c[group].career, team: seasonSpan(c, group) } : null)
        : seasonLine(c, group, compare.season));

    const defs = statDefs(group);
    const headCells = careers.map(c => `
        <th scope="col"><div class="cmp-player">
            <img src="${headshotUrl(c.person.id, 80)}" alt="" loading="lazy">
            <span>${esc(c.person.fullName)}</span>
        </div></th>`).join("");

    const infoRow = `<tr class="info-row"><th scope="row">${compare.mode === "career" ? "Seasons" : "Team"}</th>${
        lines.map(l => `<td>${l ? esc(l.team || "—") : `<span class="muted">${compare.mode === "career" ? "No stats" : "Didn't play"}</span>`}</td>`).join("")}</tr>`;

    const statRows = defs.map(d => {
        const values = lines.map(l => (l ? num(l.stat?.[d.key]) : null));
        const present = values.filter(v => v !== null);
        let best = null;
        if (present.length > 1 && new Set(present).size > 1) {
            best = d.lowerIsBetter ? Math.min(...present) : Math.max(...present);
        }
        const cells = lines.map((l, i) => {
            const raw = l?.stat?.[d.key];
            const isBest = best !== null && values[i] === best;
            return `<td class="${isBest ? "best" : ""}">${raw ?? "—"}${isBest ? '<span class="visually-hidden"> (best)</span>' : ""}</td>`;
        }).join("");
        return `<tr><th scope="row" title="${esc(d.title)}">${d.label}</th>${cells}</tr>`;
    }).join("");

    const noneHaveGroup = lines.every(l => !l);
    body.innerHTML = noneHaveGroup
        ? `<p class="empty-hint compare-empty">None of these players have MLB ${group} stats${compare.mode === "season" ? ` in ${compare.season}` : ""}. Try ${group === "pitching" ? "Hitting" : "Pitching"}.</p>`
        : `
        <div class="table-scroll">
            <table class="compare-table">
                <thead><tr><th scope="col"><span class="visually-hidden">Stat</span></th>${headCells}</tr></thead>
                <tbody>${infoRow}${statRows}</tbody>
            </table>
        </div>
        <p class="table-hint">${ids.length > 1
            ? "The best number in each row is highlighted. For ERA, WHIP, walks and similar stats, lower is better."
            : "Add another player to compare."}</p>`;
}
