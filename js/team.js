// team.js — Team window: roster with sortable stats, and the Games tab (recent results, coming up).

import { getRoster, getTeamSchedule, headshotUrl, logoFallbackUrl, logoUrl } from "./api.js";
import { gameStatus } from "./games.js";
import { openModal } from "./modals.js";
import { recordText } from "./standings.js";
import { state, teamById } from "./state.js";
import { renderTeamPostseason, viewTeamInSeason } from "./team-postseason.js";
import { esc, shortDate } from "./util.js";

const POS_ORDER = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "IF", "DH", "TWP", "P"];

export const num = v => {
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

export const columnsFor = tab => (tab === "pitchers" ? PITCHER_COLUMNS : HITTER_COLUMNS);

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

export const rosterKey = teamId => `${state.season}-${teamId}`;

export async function openRosterModal(team, opener) {
    state.currentTeam = team;
    state.currentTab = "hitters";
    resetTeamView();

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
            const data = await getRoster(team.id, state.season);
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
    if (state.currentTeam === team && (state.teamView || "roster") === "roster") renderRoster();
}

export function renderRoster() {
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

function resetTeamView() {
    state.teamView = "roster";
    updateTeamViewTabs();
}

function updateTeamViewTabs() {
    document.querySelectorAll("#teamViewTabs [data-team-view]").forEach(b => {
        b.classList.toggle("active", b.dataset.teamView === state.teamView);
        b.setAttribute("aria-pressed", b.dataset.teamView === state.teamView);
    });
    document.getElementById("rosterTabs").hidden = state.teamView !== "roster";
}

export function setupTeamView() {
    document.getElementById("teamViewTabs").addEventListener("click", e => {
        const btn = e.target.closest("[data-team-view]");
        if (!btn || btn.dataset.teamView === state.teamView) return;
        state.teamView = btn.dataset.teamView;
        updateTeamViewTabs();
        if (state.teamView === "games") renderTeamGames(state.currentTeam);
        else if (state.teamView === "postseason") renderTeamPostseason(state.currentTeam);
        else if (state.rosterCache[rosterKey(state.currentTeam.id)]) renderRoster();
        else openRosterModal(state.currentTeam);
    });
    document.getElementById("rosterBody").addEventListener("click", e => {
        const yearBtn = e.target.closest("[data-ps-year]");
        if (yearBtn) { viewTeamInSeason(state.currentTeam, Number(yearBtn.dataset.psYear)); return; }
        const t = e.target.closest("[data-open-team]");
        if (t && teamById(t.dataset.openTeam)) {
            openRosterModal(teamById(t.dataset.openTeam), t);
        }
    });
}

export const teamGamesCache = {};

async function renderTeamGames(team) {
    const body = document.getElementById("rosterBody");
    const key = `${state.season}-${team.id}`;
    body.innerHTML = `<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading games…</div>`;
    try {
        if (!teamGamesCache[key]) {
            const data = await getTeamSchedule(team.id, state.season);
            teamGamesCache[key] = (data.dates || []).flatMap(d => d.games || []);
        }
    } catch (err) {
        console.error("Team schedule error:", err);
        if (state.currentTeam === team && state.teamView === "games") {
            body.innerHTML = `<p class="empty-hint">The schedule couldn't be loaded. Try again in a moment.</p>`;
        }
        return;
    }
    if (state.currentTeam !== team || state.teamView !== "games") return;

    const all = teamGamesCache[key];
    const done = all.filter(g => g.status?.abstractGameState === "Final" && g.status?.detailedState !== "Postponed");
    const live = all.filter(g => g.status?.abstractGameState === "Live");
    const upcoming = all.filter(g => g.status?.abstractGameState === "Preview" && !/Postponed|Cancelled/.test(g.status?.detailedState));

    const row = g => {
        const home = g.teams.home.team.id === team.id;
        const us = home ? g.teams.home : g.teams.away;
        const them = home ? g.teams.away : g.teams.home;
        const opp = them.team;
        const oppKnown = teamById(opp.id);
        const st = gameStatus(g);
        let result;
        if (st.final) result = `<span class="result ${us.isWinner ? "win" : "loss"}">${us.isWinner ? "W" : "L"}</span> ${us.score}–${them.score}`;
        else if (st.live) result = `<span class="live-dot" aria-hidden="true"></span>${esc(st.text)} · ${us.score ?? 0}–${them.score ?? 0}`;
        else result = esc(st.text);
        const tag = g.gameType !== "R" ? `<small class="post-tag">${esc(g.seriesDescription || "Postseason")}${g.seriesGameNumber ? ` G${g.seriesGameNumber}` : ""}</small>` : "";
        return `<tr>
            <td class="name-col">${esc(shortDate(g.officialDate || g.gameDate.slice(0, 10)))}</td>
            <td class="opp-cell">${home ? "vs" : "@"}
                <img src="${logoUrl(opp.id)}" alt="" class="mini-logo" loading="lazy">
                ${oppKnown ? `<button class="team-link" data-open-team="${opp.id}">${esc(opp.name)}</button>` : esc(opp.name)} ${tag}</td>
            <td class="result-cell">${result}</td>
        </tr>`;
    };
    const table = (title, list) => list.length ? `
        <h3 class="stats-title">${title}</h3>
        <div class="table-scroll"><table class="stats-table games-table"><tbody>${list.map(row).join("")}</tbody></table></div>` : "";

    const recent = done.slice(-10).reverse();
    const last10 = recent.length ? (() => {
        const w = recent.filter(g => (g.teams.home.team.id === team.id ? g.teams.home : g.teams.away).isWinner).length;
        return ` <small>${w}–${recent.length - w}</small>`;
    })() : "";

    const html = table("Live now", live) + table(`Last ${recent.length} games${last10}`, recent) + table("Coming up", upcoming.slice(0, 5));
    body.innerHTML = html || `<p class="empty-hint">No ${state.season} games found for the ${esc(team.name)}.</p>`;
}
