// standings.js — Loads teams and standings, draws the division tables and My teams, the season picker, and Refresh.

import { DIVISION_IDS, SEASON, divisionKey, getStandings, getTeams, getTeamsFromBackend, logoFallbackUrl, logoUrl } from "./api.js";
import { anyModalOpen } from "./modals.js";
import { applySearch } from "./search.js";
import { state, teamById } from "./state.js";
import { openRosterModal, teamGamesCache } from "./team.js";
import { applyThemeChoice, getThemeChoice } from "./theme.js";
import { esc, showToast, writeJSON } from "./util.js";

async function loadTeamList() {
    // 1) Your own backend (on Render). 2) Fall back to the MLB API directly.
    try {
        const data = await getTeamsFromBackend();
        if (Array.isArray(data.teams) && data.teams.length) return data.teams;
    } catch (err) {
        console.warn("Backend /api/teams unavailable, using MLB API directly.", err);
    }
    const data = await getTeams(state.season);
    return data.teams;
}

async function loadStandings() {
    const data = await getStandings(state.season);
    return data.records || [];
}

export async function loadData() {
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
    // app.js listens for this to refresh the home-page sections and handle shared links
    document.dispatchEvent(new CustomEvent("mlb:data-loaded", { detail: { ok: standingsResult.status === "fulfilled" } }));
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

export function recordText(teamId) {
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

export function setupTeamInteractions() {
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

export const FIRST_SEASON = 1969; // first year MLB had divisions

export function setupSeasonPicker() {
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

export function updateUpdatedLine() {
    const el = document.getElementById("updatedText");
    if (!state.lastUpdated) return;
    el.textContent = `Updated ${state.lastUpdated.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    document.getElementById("updatedLine").hidden = false;
}

export function setupRefresh() {
    document.getElementById("refreshBtn").addEventListener("click", async () => {
        const btn = document.getElementById("refreshBtn");
        btn.disabled = true;
        // Fresh rosters and schedules for this season next time they're opened
        Object.keys(state.rosterCache).forEach(k => { if (k.startsWith(`${state.season}-`)) delete state.rosterCache[k]; });
        Object.keys(teamGamesCache).forEach(k => { if (k.startsWith(`${state.season}-`)) delete teamGamesCache[k]; });
        await loadData();
        btn.disabled = false;
        showToast("Standings refreshed");
    });
}
