// world-series.js — World Series section: this year's series or a champion, plus recent champions.

import { SEASON, getWorldSeriesGames, getWorldSeriesMVP, logoUrl } from "./api.js";
import { games, loadGames } from "./games.js";
import { openModal } from "./modals.js";
import { openPlayerById } from "./player.js";
import { abbrFor, state, teamById } from "./state.js";
import { openRosterModal } from "./team.js";
import { shortDayLabel } from "./upcoming.js";
import { esc, gameTime, parseISODate, readJSON, writeJSON } from "./util.js";

const WS_HISTORY = 10;

let wsSeq = 0;

// One season's World Series: not played / scheduled / in progress / over
async function getWorldSeries(year) {
    const cache = readJSON("wsCache", {});
    if (cache[year]) return cache[year];

    const data = await getWorldSeriesGames(year);
    const list = (data.dates || []).flatMap(d => d.games || [])
        .filter(g => !/Postponed|Cancelled/.test(g.status?.detailedState || ""));
    if (!list.length) return { year, status: "none" };

    const first = list[0];
    const teams = [first.teams.away.team, first.teams.home.team].map(t => ({ id: t.id, name: t.name, abbr: abbrFor(t) }));
    const finals = list.filter(g => g.status?.abstractGameState === "Final");
    const winsFor = id => finals.filter(g => (g.teams.away.team.id === id ? g.teams.away : g.teams.home).isWinner).length;
    const last = finals[finals.length - 1];
    const over = last?.seriesStatus?.isOver || Math.max(winsFor(teams[0].id), winsFor(teams[1].id)) >= 4;

    if (over) {
        const winnerId = last.seriesStatus?.winningTeam?.id || (winsFor(teams[0].id) > winsFor(teams[1].id) ? teams[0].id : teams[1].id);
        const winner = teams.find(t => t.id === winnerId) || teams[0];
        const loser = teams.find(t => t.id !== winner.id);
        const result = { year, status: "over", winner, loser,
            wins: winsFor(winner.id), losses: winsFor(loser.id), clinched: last.officialDate || last.gameDate.slice(0, 10) };
        try {
            const aw = await getWorldSeriesMVP(year);
            const mvp = aw.awards?.[0]?.player;
            if (mvp) result.mvp = { id: mvp.id, name: mvp.nameFirstLast || mvp.fullName };
        } catch { /* MVP is a bonus */ }
        // A finished World Series never changes. Re-read before saving because
        // several seasons load at the same time and each adds its own entry.
        const latest = readJSON("wsCache", {});
        latest[year] = result;
        writeJSON("wsCache", latest);
        return result;
    }

    const live = list.find(g => g.status?.abstractGameState === "Live");
    const next = list.find(g => g.status?.abstractGameState === "Preview");
    return {
        year, status: finals.length || live ? "live" : "scheduled", teams,
        score: teams.map(t => winsFor(t.id)),
        gameNumber: (live || next)?.seriesGameNumber || (live || next)?.seriesStatus?.gameNumber,
        nextDate: (live || next)?.officialDate, nextTime: (live || next)?.gameDate, isLive: !!live
    };
}

export function setupWorldSeries() {
    document.getElementById("wsHistory").addEventListener("click", e => {
        const btn = e.target.closest("[data-ws-year]");
        if (!btn) return;
        const select = document.getElementById("seasonSelect");
        select.value = btn.dataset.wsYear;
        select.dispatchEvent(new Event("change"));
        document.getElementById("ws-section").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.getElementById("wsCard").addEventListener("click", e => {
        const mvp = e.target.closest("[data-player-id]");
        if (mvp) { openPlayerById(Number(mvp.dataset.playerId), mvp, Number(mvp.dataset.season)); return; }
        const team = e.target.closest("[data-open-team]");
        if (team && teamById(team.dataset.openTeam)) { openRosterModal(teamById(team.dataset.openTeam), team); return; }
        const gamesBtn = e.target.closest("[data-games-date]");
        if (gamesBtn) {
            games.date = gamesBtn.dataset.gamesDate;
            openModal("gamesModal", gamesBtn);
            loadGames();
        }
    });
}

function teamNameHTML(t) {
    return teamById(t.id)
        ? `<button class="team-link" data-open-team="${t.id}">${esc(t.name)}</button>`
        : esc(t.name);
}

function wsCardHTML(ws, label) {
    if (ws.status === "none") {
        const why = ws.year === 1994 ? " The season ended early because of the players' strike." : "";
        return `<p class="ws-label">${ws.year}</p><p class="ws-empty">No World Series was played in ${ws.year}.${why}</p>`;
    }
    if (ws.status === "over") {
        const len = ws.wins + ws.losses;
        return `<img src="${logoUrl(ws.winner.id)}" alt="" class="ws-logo">
            <div class="ws-text">
                <p class="ws-label">${label || `${ws.year} World Series champions`}</p>
                <p class="ws-team">${teamNameHTML(ws.winner)}</p>
                <p class="ws-detail">Beat the ${esc(ws.loser.name)} ${ws.wins}–${ws.losses}${len === 4 ? " (a sweep)" : ` in ${len} games`}${ws.clinched ? ` · won ${esc(parseISODate(ws.clinched).toLocaleDateString(undefined, { month: "long", day: "numeric" }))}` : ""}</p>
                ${ws.mvp ? `<p class="ws-detail">Series MVP: <button class="team-link" data-player-id="${ws.mvp.id}" data-season="${ws.year}">${esc(ws.mvp.name)}</button></p>` : ""}
            </div>`;
    }
    // scheduled or in progress
    const [a, b] = ws.teams;
    const [sa, sb] = ws.score;
    const status = ws.status === "scheduled"
        ? `Game 1 is ${esc(shortDayLabel(ws.nextDate).replace(/^Today$/, "today").replace(/^Tomorrow$/, "tomorrow"))}${ws.nextTime ? ` at ${esc(gameTime(ws.nextTime))}` : ""}`
        : sa === sb ? `Series tied ${sa}–${sb}` : `${esc((sa > sb ? a : b).abbr)} leads ${Math.max(sa, sb)}–${Math.min(sa, sb)}`;
    const next = ws.nextDate
        ? `<button class="ghost-btn small" data-games-date="${ws.nextDate}">${ws.isLive ? "Watch the score" : `Game ${ws.gameNumber || ""} · ${esc(shortDayLabel(ws.nextDate))}`}</button>`
        : "";
    return `<div class="ws-matchup">
            <img src="${logoUrl(a.id)}" alt="" class="ws-logo small">
            <span class="ws-vs">vs</span>
            <img src="${logoUrl(b.id)}" alt="" class="ws-logo small">
        </div>
        <div class="ws-text">
            <p class="ws-label">${ws.year} World Series${ws.isLive ? ' · <span class="live-dot" aria-hidden="true"></span>live now' : ""}</p>
            <p class="ws-team">${teamNameHTML(a)} <span class="ws-and">vs</span> ${teamNameHTML(b)}</p>
            <p class="ws-detail">${status}</p>
            ${next}
        </div>`;
}

export async function renderWorldSeries() {
    const section = document.getElementById("ws-section");
    const card = document.getElementById("wsCard");
    const history = document.getElementById("wsHistory");
    const seq = ++wsSeq;
    const year = state.season;
    section.hidden = false;
    card.innerHTML = `<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading the World Series…</div>`;

    try {
        let ws = await getWorldSeries(year);
        let label = "";
        // Season still going and no World Series scheduled yet: show the defending champions
        if (ws.status === "none" && year === SEASON && year !== 1994) {
            const prev = await getWorldSeries(year - 1);
            if (prev.status === "over") { ws = prev; label = `Defending champions (${prev.year})`; }
            else ws = { year, status: "none" };
            if (!label) ws = { year, status: "none" };
        }
        if (seq !== wsSeq) return;
        card.innerHTML = ws.status === "none" && year === SEASON
            ? `<p class="ws-label">${year} World Series</p><p class="ws-empty">The ${year} World Series hasn't been scheduled yet.</p>`
            : wsCardHTML(ws, label);
        card.classList.toggle("is-champion", ws.status === "over");
    } catch (err) {
        console.warn("World Series unavailable:", err);
        if (seq === wsSeq) card.innerHTML = `<p class="ws-empty">World Series results couldn't be loaded right now.</p>`;
    }

    // Recent champions: the last 10 finished World Series, newest first
    try {
        const years = [];
        for (let y = SEASON; y >= Math.max(1903, SEASON - WS_HISTORY - 2); y--) years.push(y);
        const all = await Promise.all(years.map(y => getWorldSeries(y).catch(() => null)));
        if (seq !== wsSeq) return;
        const champs = all.filter(w => w && w.status === "over").slice(0, WS_HISTORY);
        history.innerHTML = champs.map(w => `
            <button class="ws-chip ${w.year === year ? "active" : ""}" data-ws-year="${w.year}"
                    aria-pressed="${w.year === year}" title="${esc(w.winner.name)} beat the ${esc(w.loser.name)} ${w.wins}–${w.losses}">
                <span class="ws-chip-year">${w.year}</span>
                <img src="${logoUrl(w.winner.id)}" alt="" class="mini-logo" loading="lazy">
                <span class="ws-chip-team">${esc(w.winner.abbr || w.winner.name)}</span>
            </button>`).join("");
    } catch (err) {
        console.warn("Champion history unavailable:", err);
    }
}
