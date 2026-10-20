// player.js — Player window: bio, season, career, by year, game log and splits; opening any player by id.

import { getPlayer, getPlayerStats, headshotUrl } from "./api.js";
import { HIT_YEAR_KEYS, PITCH_YEAR_KEYS, groupsFor, loadCareers, parseCareer, seasonSpan, statDefs } from "./career.js";
import { renderCareerChart } from "./charts.js";
import { addToCompare, openCompare } from "./compare.js";
import { openModal } from "./modals.js";
import { abbrFor, state } from "./state.js";
import { rosterKey } from "./team.js";
import { esc, formatDate, readJSON, shortDate, showToast, writeJSON } from "./util.js";

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

export let currentPlayer = null; // player shown in the player window

export function openPlayerModal(id, opener) {
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
    rememberPlayer(p);

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

export function setupPlayerWindow() {
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

function rememberPlayer(p) {
    const recent = readJSON("recentPlayers", []).filter(x => x.id !== p.id);
    recent.unshift({ id: p.id, name: p.name, note: [p.posName, p.teamName].filter(Boolean).join(" · ") });
    writeJSON("recentPlayers", recent.slice(0, 6));
}

// Open the player window for anyone (leaders, search, shared links)
export async function openPlayerById(id, opener, season = state.season) {
    if (opener) { opener.setAttribute("aria-busy", "true"); opener.classList.add("is-loading"); }
    try {
        const data = await getPlayer(id, season);
        const person = data.people?.[0];
        if (!person) throw new Error("Player not found");
        state.careerCache[id] = parseCareer(person);
        const seasonStat = group => {
            const splits = person.stats?.find(s => s.group?.displayName === group && s.type?.displayName === "season")?.splits || [];
            return (splits.find(sp => !sp.team) || splits[0])?.stat || null;
        };
        const groups = groupsFor(person);
        showPlayer({
            id,
            name: person.fullName,
            lastName: person.lastName,
            number: person.primaryNumber || "",
            pos: person.primaryPosition?.abbreviation || "",
            posName: person.primaryPosition?.name || "",
            person,
            teamName: person.currentTeam?.name || "",
            hitting: seasonStat("hitting"),
            pitching: seasonStat("pitching"),
            inHitters: groups.includes("hitting"),
            inPitchers: groups.includes("pitching"),
            fromRoster: false,
            season // the season tab, game log and splits use this year
        }, opener);
    } catch (err) {
        console.error("Player load error:", err);
        showToast("That player couldn't be loaded. Try again in a moment.");
    } finally {
        if (opener) { opener.removeAttribute("aria-busy"); opener.classList.remove("is-loading"); }
    }
}

const statCache = {};

async function fetchPlayerStats(p, kind, group) {
    const season = p.season || state.season;
    const key = `${p.id}-${season}-${kind}-${group}`;
    if (!statCache[key]) {
        const data = await getPlayerStats(p.id, kind, group, season);
        statCache[key] = data.stats?.[0]?.splits || [];
    }
    return statCache[key];
}

async function renderStatTab(p, box, groups, kind, build) {
    box.innerHTML = `<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading…</div>`;
    const view = state.playerView;
    try {
        const parts = await Promise.all(groups.map(g => fetchPlayerStats(p, kind, g).then(rows => [g, rows])));
        if (currentPlayer !== p || state.playerView !== view) return;
        const html = parts.map(([g, rows]) => build(g, rows)).join("");
        box.innerHTML = html || `<p class="empty-hint">No ${p.season || state.season} ${kind === "gameLog" ? "games" : "splits"} for this player.</p>`;
    } catch (err) {
        console.error(err);
        if (currentPlayer === p) box.innerHTML = `<p class="empty-hint">These stats couldn't be loaded. Try again in a moment.</p>`;
    }
}

function renderGameLog(p, box, groups) {
    renderStatTab(p, box, groups, "gameLog", (group, rows) => {
        if (!rows.length) return "";
        const last = rows.slice(-15).reverse();
        const hit = group === "hitting";
        const cols = hit
            ? [["AB", "atBats"], ["H", "hits"], ["HR", "homeRuns"], ["RBI", "rbi"], ["BB", "baseOnBalls"], ["SO", "strikeOuts"], ["AVG", "avg"]]
            : [["IP", "inningsPitched"], ["H", "hits"], ["ER", "earnedRuns"], ["BB", "baseOnBalls"], ["SO", "strikeOuts"], ["ERA", "era"]];
        const head = `<tr><th class="name-col"><span class="th-text">Date</span></th><th><span class="th-text">Opp</span></th>
            <th><span class="th-text">${hit ? "Result" : "Dec"}</span></th>${cols.map(([l]) => `<th><span class="th-text">${l}</span></th>`).join("")}</tr>`;
        const body = last.map(r => {
            const opp = `${r.isHome ? "vs" : "@"} ${esc(abbrFor(r.opponent))}`;
            const res = hit
                ? (r.isWin === true ? "W" : r.isWin === false ? "L" : "—")
                : (r.stat.wins ? "W" : r.stat.losses ? "L" : r.stat.saves ? "SV" : r.stat.holds ? "HLD" : "—");
            return `<tr><td class="name-col">${esc(shortDate(r.date))}</td><td class="team-td">${opp}</td><td>${res}</td>${
                cols.map(([, k]) => `<td>${esc(r.stat[k] ?? "—")}</td>`).join("")}</tr>`;
        }).join("");
        return `<h3 class="stats-title">${hit ? "Hitting" : "Pitching"} · last ${last.length} games <small>${p.season || state.season}</small></h3>
            <div class="table-scroll"><table class="stats-table year-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>
            ${hit ? '<p class="table-hint">AVG is the season average after that game.</p>' : '<p class="table-hint">ERA is the season ERA after that game.</p>'}`;
    });
}

function renderSplits(p, box, groups) {
    renderStatTab(p, box, groups, "statSplits", (group, rows) => {
        if (!rows.length) return "";
        const hit = group === "hitting";
        const cols = hit
            ? [["PA", "plateAppearances"], ["AVG", "avg"], ["HR", "homeRuns"], ["RBI", "rbi"], ["OBP", "obp"], ["OPS", "ops"]]
            : [["IP", "inningsPitched"], ["ERA", "era"], ["Opp AVG", "avg"], ["SO", "strikeOuts"], ["BB", "baseOnBalls"], ["WHIP", "whip"]];
        const label = r => {
            const d = r.split?.description || r.split?.code || "";
            if (!hit && r.split?.code === "vl") return "vs Left-handed batters";
            if (!hit && r.split?.code === "vr") return "vs Right-handed batters";
            if (hit && r.split?.code === "vl") return "vs Left-handed pitchers";
            if (hit && r.split?.code === "vr") return "vs Right-handed pitchers";
            return d;
        };
        const head = `<tr><th class="name-col"><span class="th-text">Split</span></th>${cols.map(([l]) => `<th><span class="th-text">${l}</span></th>`).join("")}</tr>`;
        const body = rows.map(r => `<tr><td class="name-col">${esc(label(r))}</td>${
            cols.map(([, k]) => `<td>${esc(r.stat[k] ?? "—")}</td>`).join("")}</tr>`).join("");
        return `<h3 class="stats-title">${hit ? "Hitting" : "Pitching"} splits <small>${p.season || state.season}</small></h3>
            <div class="table-scroll"><table class="stats-table year-table splits-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
    });
}
