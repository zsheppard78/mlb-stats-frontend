// games.js — Today's games: scores, live updates, probable pitchers and day navigation.

import { getGamesOn, getScheduleRange, logoUrl } from "./api.js";
import { closeModal, openModal } from "./modals.js";
import { abbrFor, teamById } from "./state.js";
import { openRosterModal } from "./team.js";
import { addDays, dayLabel, esc, gameTime, isoDate, shortDate } from "./util.js";

export const games = { date: isoDate(new Date()), timer: null, seq: 0 };

export function openGames(opener) {
    games.date = isoDate(new Date());
    openModal("gamesModal", opener);
    loadGames();
}

export function setupGames() {
    document.getElementById("closeGames").addEventListener("click", () => closeModal("gamesModal"));
    document.getElementById("gamesPrev").addEventListener("click", () => { games.date = addDays(games.date, -1); loadGames(); });
    document.getElementById("gamesNext").addEventListener("click", () => { games.date = addDays(games.date, 1); loadGames(); });
    document.getElementById("gamesToday").addEventListener("click", () => { games.date = isoDate(new Date()); loadGames(); });
    document.getElementById("gamesBody").addEventListener("click", e => {
        const jump = e.target.closest("[data-jump]");
        if (jump) { games.date = jump.dataset.jump; loadGames(); return; }
        const teamBtn = e.target.closest("[data-open-team]");
        if (teamBtn) {
            const team = teamById(teamBtn.dataset.openTeam);
            if (team) openRosterModal(team, teamBtn);
        }
    });
}

export async function loadGames({ quiet = false } = {}) {
    clearTimeout(games.timer);
    const seq = ++games.seq;
    const date = games.date;
    document.getElementById("gamesDate").textContent = dayLabel(date);
    document.getElementById("gamesToday").hidden = date === isoDate(new Date());
    const body = document.getElementById("gamesBody");
    if (!quiet) body.innerHTML = `<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading games…</div>`;

    let list = [];
    try {
        const data = await getGamesOn(date);
        list = data.dates?.[0]?.games || [];
    } catch (err) {
        if (seq !== games.seq) return;
        console.error("Schedule error:", err);
        body.innerHTML = `<div class="loading-block error">Games couldn't be loaded. <button class="ghost-btn" data-jump="${date}">Try again</button></div>`;
        return;
    }
    if (seq !== games.seq || document.getElementById("gamesModal").hidden) return;

    if (!list.length) {
        body.innerHTML = `<div class="loading-block">No MLB games on ${esc(dayLabel(date))}.</div>`;
        findNearbyGameDay(date, seq);
        return;
    }

    body.innerHTML = `<div class="games-grid">${list.map(gameCardHTML).join("")}</div>`;

    // Live games refresh themselves every 30 seconds while the window is open
    if (list.some(g => g.status?.abstractGameState === "Live")) {
        games.timer = setTimeout(() => {
            if (!document.getElementById("gamesModal").hidden) loadGames({ quiet: true });
        }, 30000);
    }
}

async function findNearbyGameDay(date, seq) {
    try {
        const [next, prev] = await Promise.all([
            getScheduleRange(addDays(date, 1), addDays(date, 60)),
            getScheduleRange(addDays(date, -60), addDays(date, -1))
        ]);
        if (seq !== games.seq) return;
        const nextDay = next.dates?.find(d => d.games?.length)?.date;
        const prevDates = (prev.dates || []).filter(d => d.games?.length);
        const prevDay = prevDates[prevDates.length - 1]?.date;
        const buttons = [
            prevDay && `<button class="ghost-btn" data-jump="${prevDay}">‹ Last games: ${esc(shortDate(prevDay))}</button>`,
            nextDay && `<button class="ghost-btn" data-jump="${nextDay}">Next games: ${esc(shortDate(nextDay))} ›</button>`
        ].filter(Boolean).join("");
        if (buttons) {
            document.getElementById("gamesBody").insertAdjacentHTML("beforeend", `<div class="jump-row">${buttons}</div>`);
        }
    } catch { /* the "no games" message is enough */ }
}

export function gameStatus(g) {
    const s = g.status || {};
    const ls = g.linescore || {};
    if (s.abstractGameState === "Final") {
        const extra = ls.currentInning && ls.scheduledInnings && ls.currentInning !== ls.scheduledInnings ? `/${ls.currentInning}` : "";
        return { text: s.detailedState === "Final" ? `Final${extra}` : s.detailedState, live: false, final: true };
    }
    if (s.abstractGameState === "Live") {
        if (s.detailedState !== "In Progress") return { text: s.detailedState, live: true };
        const half = ls.inningHalf === "Top" ? "Top" : ls.inningHalf === "Bottom" ? "Bot" : (ls.inningState || "");
        return { text: `${half} ${ls.currentInningOrdinal || ""}`.trim(), live: true };
    }
    if (s.startTimeTBD) return { text: "Time TBD" };
    if (/Postponed|Suspended|Cancelled/i.test(s.detailedState)) return { text: s.detailedState };
    return { text: gameTime(g.gameDate) };
}

function gameCardHTML(g) {
    const st = gameStatus(g);
    const started = st.live || st.final;
    const side = key => {
        const t = g.teams[key];
        const team = t.team;
        const rec = t.leagueRecord;
        const winner = st.final && t.isWinner;
        const known = teamById(team.id);
        return `<div class="game-team ${winner ? "winner" : ""}">
            <img src="${logoUrl(team.id)}" alt="" class="game-logo" loading="lazy">
            ${known ? `<button class="team-link" data-open-team="${team.id}">${esc(team.name)}</button>` : `<span>${esc(team.name)}</span>`}
            <span class="game-rec">${rec && g.gameType === "R" ? `${rec.wins}-${rec.losses}` : ""}</span>
            <span class="game-score">${started ? (t.score ?? 0) : ""}</span>
        </div>`;
    };
    const series = g.gameType !== "R" && g.seriesStatus
        ? `<span class="game-series">${esc(g.seriesStatus.shortDescription || g.description || "")}${g.seriesStatus.result ? ` · ${esc(g.seriesStatus.result)}` : ""}</span>`
        : "";
    let foot = "";
    if (st.final && g.decisions) {
        const d = g.decisions;
        foot = [d.winner && `W: ${d.winner.fullName}`, d.loser && `L: ${d.loser.fullName}`, d.save && `SV: ${d.save.fullName}`]
            .filter(Boolean).map(esc).join(" · ");
    } else if (!started) {
        const pp = k => g.teams[k].probablePitcher?.fullName || "TBD";
        foot = `${esc(abbrFor(g.teams.away.team))}: ${esc(pp("away"))} · ${esc(abbrFor(g.teams.home.team))}: ${esc(pp("home"))}`;
    }
    return `<article class="game-card ${st.live ? "is-live" : ""}">
        <header class="game-head">
            <span class="game-status">${st.live ? '<span class="live-dot" aria-hidden="true"></span>' : ""}${esc(st.text)}</span>
            ${series}
        </header>
        ${side("away")}
        ${side("home")}
        ${foot ? `<footer class="game-foot">${foot}</footer>` : ""}
        ${g.venue?.name ? `<p class="game-venue">${esc(g.venue.name)}</p>` : ""}
    </article>`;
}
