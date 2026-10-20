// =========================
// CONFIG
// =========================
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

const logoUrl = id => `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${id}.svg`;
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
const teamThemes = {
    "New York Yankees": { accent: "#0C2340", highlight: "#C4CED4", bg: "#0A0C10" },
    "Boston Red Sox": { accent: "#BD3039", highlight: "#0D2B56", bg: "#0A0C10" },
    "Tampa Bay Rays": { accent: "#092C5C", highlight: "#8FBCE6", bg: "#00285D" },
    "Toronto Blue Jays": { accent: "#134A8E", highlight: "#1D2D5C", bg: "#0A0C10" },
    "Baltimore Orioles": { accent: "#DF4601", highlight: "#000000", bg: "#0A0C10" },

    "Minnesota Twins": { accent: "#002B5C", highlight: "#D31145", bg: "#0A0C10" },
    "Cleveland Guardians": { accent: "#0C2340", highlight: "#E31937", bg: "#0A0C10" },
    "Chicago White Sox": { accent: "#000000", highlight: "#C4CED4", bg: "#0A0C10" },
    "Detroit Tigers": { accent: "#0C2340", highlight: "#FA4616", bg: "#0A0C10" },
    "Kansas City Royals": { accent: "#004687", highlight: "#C09A5B", bg: "#0A0C10" },

    "Houston Astros": { accent: "#002D62", highlight: "#EB6E1F", bg: "#0A0C10" },
    "Texas Rangers": { accent: "#003278", highlight: "#C0111F", bg: "#0A0C10" },
    "Seattle Mariners": { accent: "#003278", highlight: "#0C2C56", bg: "#0A0C10" },
    "Los Angeles Angels": { accent: "#BA0021", highlight: "#003263", bg: "#0A0C10" },
    "Oakland Athletics": { accent: "#003831", highlight: "#EFB21E", bg: "#0A0C10" },

    "Atlanta Braves": { accent: "#0E2340", highlight: "#CE1141", bg: "#0A0C10" },
    "Philadelphia Phillies": { accent: "#E81828", highlight: "#002D72", bg: "#0A0C10" },
    "New York Mets": { accent: "#002D72", highlight: "#FF5910", bg: "#0A0C10" },
    "Miami Marlins": { accent: "#00A3E0", highlight: "#EF3340", bg: "#0A0C10" },
    "Washington Nationals": { accent: "#AB0003", highlight: "#14225A", bg: "#0A0C10" },

    "Chicago Cubs": { accent: "#0E3386", highlight: "#CC3433", bg: "#0A0C10" },
    "Milwaukee Brewers": { accent: "#12284B", highlight: "#FFC52F", bg: "#0A0C10" },
    "St. Louis Cardinals": { accent: "#C41E3A", highlight: "#FEDB00", bg: "#0A0C10" },
    "Pittsburgh Pirates": { accent: "#000000", highlight: "#FFB81C", bg: "#0A0C10" },
    "Cincinnati Reds": { accent: "#C6011F", highlight: "#000000", bg: "#0A0C10" },

    "Los Angeles Dodgers": { accent: "#005A9C", highlight: "#EF3E42", bg: "#0A0C10" },
    "San Diego Padres": { accent: "#2F241D", highlight: "#FFC425", bg: "#0A0C10" },
    "San Francisco Giants": { accent: "#FD5A1E", highlight: "#27251F", bg: "#0A0C10" },
    "Arizona Diamondbacks": { accent: "#A71930", highlight: "#E3D4AD", bg: "#0A0C10" },
    "Colorado Rockies": { accent: "#33006F", highlight: "#C4CED4", bg: "#0A0C10" }
};
// The A's are listed as just "Athletics" by MLB since their move
teamThemes["Athletics"] = teamThemes["Oakland Athletics"];

const presetThemes = {
    classic: { accent: "#ffd700", highlight: "#00b7ff", bg: "#0b0d11" },
    dodger: { accent: "#3d9bff", highlight: "#ef3e42", bg: "#08101c" },
    cardinal: { accent: "#e0313f", highlight: "#fedb00", bg: "#120a0b" },
    green: { accent: "#efb21e", highlight: "#2fbf7f", bg: "#07120f" },
    night: { accent: "#a5b4fc", highlight: "#94a3b8", bg: "#000000" }
};

// --- color contrast helpers: team colors like navy or black are unreadable
// on a dark background, so lighten them until text is readable (WCAG 4.5:1).
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
    let t = 0;
    let rgb = base;
    while (contrastRatio(rgb, bg) < minRatio && t < 1) {
        t += 0.05;
        rgb = base.map(c => c + (255 - c) * t);
    }
    return rgbToHex(rgb);
}

function applyColors({ accent, highlight, bg }) {
    // If the main team color is too dark to read but the second color isn't
    // (e.g. Brewers navy + gold), lead with the brighter one.
    const bgRgb = hexToRgb(bg);
    if (contrastRatio(hexToRgb(accent), bgRgb) < 3 && contrastRatio(hexToRgb(highlight), bgRgb) >= 3) {
        [accent, highlight] = [highlight, accent];
    }
    const root = document.documentElement.style;
    root.setProperty("--bg", bg);
    root.setProperty("--accent", readableOn(accent, bg));
    root.setProperty("--highlight", readableOn(highlight, bg));
}

function getThemeChoice() {
    const saved = localStorage.getItem("themeChoice");
    if (saved) return saved;
    // Older versions saved a team theme automatically; keep using it for those visitors.
    return localStorage.getItem("favoriteTeamTheme") ? "team" : "classic";
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
    rosterCache: {},         // teamId -> players[]
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
    document.getElementById("seasonLabel").textContent = `${SEASON} season · standings, rosters & player stats`;
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
        const data = await fetchJSON("/api/teams", 60000);
        if (Array.isArray(data.teams) && data.teams.length) return data.teams;
    } catch (err) {
        console.warn("Backend /api/teams unavailable, using MLB API directly.", err);
    }
    const data = await fetchJSON(`${MLB_API}/teams?sportId=1&season=${SEASON}`);
    return data.teams;
}

async function loadStandings() {
    const data = await fetchJSON(
        `${MLB_API}/standings?leagueId=103,104&season=${SEASON}&standingsTypes=regularSeason&hydrate=division,team`
    );
    return data.records || [];
}

async function loadData() {
    showStatus("loading", "Loading teams and standings…");
    // Free Render apps go to sleep and take a while to wake up. Tell the user why it's slow.
    const slowTimer = setTimeout(() => {
        showStatus("loading", "Still loading… the server may be waking up. This can take up to a minute the first time.");
    }, 5000);

    const [teamsResult, standingsResult] = await Promise.allSettled([loadTeamList(), loadStandings()]);
    clearTimeout(slowTimer);

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
        console.error("Teams Load Error:", teamsResult.reason);
        showStatus("error", "Couldn't load teams. Check your connection and try again.", true);
        return;
    }

    state.teams = teams
        .map(t => ({ ...t, divKey: divisionKey(t.division) || state.standings[t.id]?.divKey }))
        .filter(t => t.divKey);

    renderDivisions(records);
    renderFavorites();

    if (standingsResult.status === "rejected") {
        showStatus("warn", "Teams loaded, but standings couldn't be loaded right now.", true);
    } else {
        hideStatus();
    }
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
            state.teams = [];
            state.standings = {};
            Object.values(DIVISION_IDS).forEach(key => {
                document.getElementById(key).innerHTML = "";
                document.getElementById(`${key}-standings`).innerHTML = "";
            });
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

function teamCardHTML(team) {
    const isFav = state.favorites.includes(team.id);
    return `
        <div class="team-card" role="button" tabindex="0" data-team-id="${team.id}"
             aria-label="${esc(team.name)}: view roster">
            <button class="favorite-star ${isFav ? "active" : ""}" data-team-id="${team.id}"
                    aria-pressed="${isFav}" title="${isFav ? "Remove from" : "Add to"} My Teams"
                    aria-label="${isFav ? "Remove" : "Add"} ${esc(team.name)} ${isFav ? "from" : "to"} My Teams">${isFav ? "★" : "☆"}</button>
            <img src="${logoUrl(team.id)}" data-fallback="${logoFallbackUrl(team.id)}" class="team-logo" alt="" loading="lazy">
            <p class="team-name">${esc(team.name)}</p>
            <p class="team-record">${recordText(team.id)}</p>
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
    // Team cards, ordered by standings rank when available
    Object.values(DIVISION_IDS).forEach(key => {
        const teams = state.teams
            .filter(t => t.divKey === key)
            .sort((a, b) =>
                (Number(state.standings[a.id]?.divisionRank) || 99) - (Number(state.standings[b.id]?.divisionRank) || 99)
                || a.name.localeCompare(b.name));
        document.getElementById(key).innerHTML = teams.map(teamCardHTML).join("");
    });

    // Standings tables
    records.forEach(div => {
        const key = divisionKey(div.division);
        if (!key) return;
        const usedClinch = new Set();

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
                </tr>`;
        }).join("");

        const legend = [...usedClinch].map(c => `<span><b>${c}</b> ${CLINCH[c]}</span>`).join("");

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
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            ${legend ? `<p class="clinch-legend">${legend}</p>` : ""}`;
    });

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
            if (show && el.classList.contains("team-card")) matches++;
        });
        totalMatches += matches;
        details.hidden = q && matches === 0;
        if (q && matches > 0) details.open = true;
    });

    document.querySelectorAll("section.league").forEach(sec => {
        sec.hidden = q && !sec.querySelector("details:not([hidden])");
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
        document.getElementById("theme").focus();
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
        showToast("Theme reset to Classic (Gold)");
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
    document.body.classList.add("no-scroll");
    modal.querySelector(".close-btn")?.focus();
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal.hidden) return;
    modal.hidden = true;
    const idx = modalStack.findIndex(m => m.id === id);
    const entry = idx >= 0 ? modalStack.splice(idx, 1)[0] : null;
    if (!modalStack.length) document.body.classList.remove("no-scroll");
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
            delete state.rosterCache[state.currentTeam.id];
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

async function openRosterModal(team, opener) {
    state.currentTeam = team;
    state.currentTab = "hitters";

    document.getElementById("teamNameModal").textContent = team.name;
    const logo = document.getElementById("teamLogoModal");
    logo.dataset.fallback = logoFallbackUrl(team.id);
    logo.src = logoUrl(team.id);
    document.getElementById("rosterSub").textContent = recordText(team.id)
        ? `${recordText(team.id)} · ${SEASON} season stats`
        : `${SEASON} season stats`;
    document.getElementById("rosterTabs").innerHTML = "";
    document.getElementById("rosterBody").innerHTML =
        `<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading roster…</div>`;
    openModal("rosterModal", opener);

    if (!state.rosterCache[team.id]) {
        try {
            // One request gets the whole active roster *with* each player's season stats
            const data = await fetchJSON(
                `${MLB_API}/teams/${team.id}/roster?rosterType=active&season=${SEASON}` +
                `&hydrate=person(stats(type=season,season=${SEASON},group=[hitting,pitching]))`
            );
            state.rosterCache[team.id] = parseRoster(data.roster || []);
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
    if (state.currentTeam === team) renderRoster();
}

function renderRoster() {
    const players = state.rosterCache[state.currentTeam.id] || [];
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
            ? `No ${SEASON} stats yet for these players.`
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
// PLAYER BIO POPUP
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

function openPlayerModal(id, opener) {
    const p = (state.rosterCache[state.currentTeam?.id] || []).find(x => x.id === id);
    if (!p) return;
    const person = p.person;

    const img = document.getElementById("playerHeadshot");
    img.src = headshotUrl(id, 300);
    img.alt = `${p.name} headshot`;
    document.getElementById("playerName").textContent = p.name;
    document.getElementById("playerTeam").textContent =
        [p.number ? `#${p.number}` : "", p.posName, state.currentTeam.name].filter(Boolean).join(" · ");

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

    let statsHTML = "";
    const h = p.hitting;
    const pi = p.pitching;
    if (p.inHitters && h) {
        statsHTML += statTiles(`${SEASON} Hitting`, [
            ["G", h.gamesPlayed], ["AVG", h.avg], ["HR", h.homeRuns], ["RBI", h.rbi],
            ["R", h.runs], ["H", h.hits], ["SB", h.stolenBases], ["BB", h.baseOnBalls],
            ["SO", h.strikeOuts], ["OBP", h.obp], ["SLG", h.slg], ["OPS", h.ops]
        ]);
    }
    if (p.inPitchers && pi) {
        statsHTML += statTiles(`${SEASON} Pitching`, [
            ["W-L", `${pi.wins}-${pi.losses}`], ["ERA", pi.era], ["G", pi.gamesPitched], ["GS", pi.gamesStarted],
            ["SV", pi.saves], ["IP", pi.inningsPitched], ["SO", pi.strikeOuts], ["BB", pi.baseOnBalls],
            ["WHIP", pi.whip], ["HR", pi.homeRuns], ["AVG", pi.avg], ["HLD", pi.holds]
        ]);
    }
    document.getElementById("playerStats").innerHTML = statsHTML || `<p class="empty-hint">No ${SEASON} stats yet.</p>`;

    openModal("playerModal", opener);
}
