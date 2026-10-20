// team-postseason.js — Team window: Postseason tab with every playoff run since 1969.

import { SEASON, getTeamPostseason } from "./api.js";
import { games } from "./games.js";
import { closeModal } from "./modals.js";
import { loadData } from "./standings.js";
import { abbrFor, state, teamById } from "./state.js";
import { openRosterModal } from "./team.js";
import { esc, readJSON, showToast, writeJSON } from "./util.js";

const PS_FIRST_SEASON = 1969;

const ROUND_ORDER = { F: 1, D: 2, L: 3, W: 4 };

function roundName(type, desc = "") {
    const lg = /^AL|American/.test(desc) ? "AL" : /^NL|National/.test(desc) ? "NL" : "";
    return { F: "Wild Card", D: `${lg}DS`.replace(/^DS$/, "Division Series"), L: `${lg}CS`.replace(/^CS$/, "LCS"), W: "World Series" }[type] || desc;
}

// One season of a team's playoff games -> list of series with results
function summarizePostseason(games, teamId) {
    const byRound = {};
    games.filter(g => !/Postponed|Cancelled/.test(g.status?.detailedState || "")).forEach(g => {
        (byRound[g.gameType] = byRound[g.gameType] || []).push(g);
    });
    return Object.entries(byRound)
        .sort(([a], [b]) => (ROUND_ORDER[a] || 0) - (ROUND_ORDER[b] || 0))
        .map(([type, list]) => {
            const side = g => (g.teams.home.team.id === teamId ? g.teams.home : g.teams.away);
            const other = g => (g.teams.home.team.id === teamId ? g.teams.away : g.teams.home);
            const finals = list.filter(g => g.status?.abstractGameState === "Final");
            const wins = finals.filter(g => side(g).isWinner).length;
            const losses = finals.filter(g => other(g).isWinner).length;
            // Done when no un-played game is still required (the API marks "if necessary" games)
            const pending = list.some(g => g.status?.abstractGameState !== "Final" && g.ifNecessary !== "Y");
            const finished = !pending && finals.length > 0;
            const opp = other(list[0]).team;
            return {
                type, round: roundName(type, list[0].seriesDescription),
                opp: { id: opp.id, name: opp.name, abbr: abbrFor(opp) },
                wins, losses, won: finished ? wins > losses : null
            };
        });
}

async function loadTeamPostseason(team, onProgress) {
    const cacheKey = `ps-${team.id}`;
    const cache = readJSON("postseasonCache", {});
    const teamCache = cache[cacheKey] || {};
    const first = Math.max(PS_FIRST_SEASON, Number(team.firstYearOfPlay) || PS_FIRST_SEASON);
    const years = [];
    for (let y = SEASON; y >= first; y--) years.push(y);

    const results = {};
    let done = 0;
    const todo = years.filter(y => {
        if (y in teamCache) { results[y] = teamCache[y]; return false; }
        return true;
    });
    done = years.length - todo.length;
    onProgress?.(done, years.length);

    // Fetch a few seasons at a time so we don't flood the API
    const queue = [...todo];
    const worker = async () => {
        while (queue.length) {
            const y = queue.shift();
            try {
                const data = await getTeamPostseason(team.id, y);
                const games = (data.dates || []).flatMap(d => d.games || []);
                results[y] = games.length ? summarizePostseason(games, team.id) : null;
            } catch {
                results[y] = undefined; // couldn't load; try again next time
            }
            onProgress?.(++done, years.length);
        }
    };
    await Promise.all(Array.from({ length: 8 }, worker));

    // Cache finished seasons (a playoff run in progress can still change)
    const latest = readJSON("postseasonCache", {});
    latest[cacheKey] = latest[cacheKey] || {};
    years.forEach(y => {
        const r = results[y];
        if (r === undefined) return;
        if (y === SEASON && (r || []).some(s => s.won === null)) return;
        if (y === SEASON && r === null) return; // this year's playoffs may not have started
        latest[cacheKey][y] = r;
    });
    writeJSON("postseasonCache", latest);
    return years.map(y => ({ year: y, series: results[y] })).filter(r => r.series !== undefined);
}

export async function renderTeamPostseason(team) {
    const body = document.getElementById("rosterBody");
    body.innerHTML = `<div class="loading-block"><span class="spinner" aria-hidden="true"></span> <span id="psProgress">Loading postseason history…</span></div>`;
    let seasons;
    try {
        seasons = await loadTeamPostseason(team, (done, total) => {
            const el = document.getElementById("psProgress");
            if (el && total > done) el.textContent = `Loading postseason history… ${done} of ${total} seasons`;
        });
    } catch (err) {
        console.error("Postseason history error:", err);
        if (state.currentTeam === team && state.teamView === "postseason") {
            body.innerHTML = `<p class="empty-hint">Postseason history couldn't be loaded. Try again in a moment.</p>`;
        }
        return;
    }
    if (state.currentTeam !== team || state.teamView !== "postseason") return;

    const first = Math.max(PS_FIRST_SEASON, Number(team.firstYearOfPlay) || PS_FIRST_SEASON);
    const trips = seasons.filter(s => s.series && s.series.length);
    const titles = trips.filter(s => s.series.some(x => x.type === "W" && x.won));
    const pennants = trips.filter(s => s.series.some(x => x.type === "W"));

    if (!trips.length) {
        body.innerHTML = `<p class="empty-hint ps-empty">The ${esc(team.name)} haven't reached the postseason since ${first}.</p>`;
        return;
    }

    const stat = (n, label) => `<div class="ps-stat"><strong>${n}</strong><span>${label}</span></div>`;
    const summary = `<div class="ps-summary">
        ${stat(trips.length, trips.length === 1 ? "playoff trip" : "playoff trips")}
        ${stat(pennants.length, pennants.length === 1 ? "pennant" : "pennants")}
        ${stat(titles.length, titles.length === 1 ? "World Series title" : "World Series titles")}
        <p class="ps-since">Since ${first}${titles.length ? ` · Champions in ${titles.map(t => t.year).join(", ")}` : ""}${trips[0] ? ` · Last trip: ${trips[0].year}` : ""}</p>
    </div>`;

    const outcome = list => {
        const last = list[list.length - 1];
        if (last.won === null) return { text: `In progress: ${last.round}`, cls: "live" };
        if (last.type === "W" && last.won) return { text: "Won World Series", cls: "champ" };
        return { text: `Lost ${last.round === "Wild Card" ? "Wild Card Series" : last.round}`, cls: "" };
    };

    const rows = trips.map(s => {
        const o = outcome(s.series);
        const detail = s.series.map(x => {
            const verb = x.won === null ? "vs" : x.won ? "beat" : "lost to";
            return `<span class="ps-series"><b>${esc(x.round)}</b> ${verb} ${esc(x.opp.abbr || x.opp.name)} ${x.wins}–${x.losses}</span>`;
        }).join("");
        return `<tr>
            <td class="name-col"><button class="team-link ps-year" data-ps-year="${s.year}" title="See the ${s.year} season">${s.year}</button></td>
            <td><span class="ps-result ${o.cls}">${o.cls === "champ" ? "🏆 " : ""}${esc(o.text)}</span>
                <div class="ps-detail ps-detail-inline">${detail}</div></td>
            <td class="ps-detail-col"><div class="ps-detail">${detail}</div></td>
        </tr>`;
    }).join("");

    body.innerHTML = `${summary}
        <div class="table-scroll"><table class="stats-table ps-table">
            <thead><tr><th class="name-col"><span class="th-text">Year</span></th><th><span class="th-text">Finish</span></th><th class="ps-detail-col"><span class="th-text">Series</span></th></tr></thead>
            <tbody>${rows}</tbody>
        </table></div>
        <p class="table-hint">Click a year to see that season's standings and roster. History starts in ${first}, the first season of division play${Number(team.firstYearOfPlay) > PS_FIRST_SEASON ? " for this franchise" : ""}.</p>`;
}

// Jump the whole site to a season and reopen this team there
export async function viewTeamInSeason(team, year) {
    const select = document.getElementById("seasonSelect");
    select.value = String(year);
    state.season = year;
    document.getElementById("seasonLabel").textContent = year;
    await loadData();
    const again = teamById(team.id);
    if (again) {
        state.teamView = "roster";
        openRosterModal(again);
    } else {
        closeModal("rosterModal");
        showToast(`The ${team.name} didn't play in ${year}.`);
    }
}
