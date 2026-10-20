// leaders.js — League leaders: top 10 by category, league and season.

import { SEASON, getLeaders, headshotUrl } from "./api.js";
import { closeModal, openModal } from "./modals.js";
import { openPlayerById } from "./player.js";
import { FIRST_SEASON } from "./standings.js";
import { state } from "./state.js";
import { esc } from "./util.js";

const LEADER_CATS = {
    hitting: [
        { key: "homeRuns", label: "Home runs" },
        { key: "battingAverage", label: "Batting avg" },
        { key: "runsBattedIn", label: "RBI" },
        { key: "onBasePlusSlugging", label: "OPS" },
        { key: "hits", label: "Hits" },
        { key: "stolenBases", label: "Stolen bases" }
    ],
    pitching: [
        { key: "earnedRunAverage", label: "ERA" },
        { key: "strikeouts", label: "Strikeouts" },
        { key: "wins", label: "Wins" },
        { key: "saves", label: "Saves" },
        { key: "walksAndHitsPerInningPitched", label: "WHIP" },
        { key: "inningsPitched", label: "Innings" }
    ]
};

const leaders = { group: "hitting", cat: "homeRuns", league: "", season: null, seq: 0 };

export function openLeaders(opener) {
    if (!leaders.season) leaders.season = state.season;
    openModal("leadersModal", opener);
    renderLeaderControls();
    loadLeaders();
}

export function setupLeaders() {
    document.getElementById("closeLeaders").addEventListener("click", () => closeModal("leadersModal"));
    const seasonSel = document.getElementById("leadersSeason");
    let opts = "";
    for (let y = SEASON; y >= FIRST_SEASON; y--) opts += `<option value="${y}">${y}</option>`;
    seasonSel.innerHTML = opts;
    seasonSel.addEventListener("change", () => { leaders.season = Number(seasonSel.value); loadLeaders(); });
    document.getElementById("leadersLeague").addEventListener("change", e => { leaders.league = e.target.value; loadLeaders(); });

    document.getElementById("leadersControls").addEventListener("click", e => {
        const g = e.target.closest("[data-lead-group]");
        if (g && g.dataset.leadGroup !== leaders.group) {
            leaders.group = g.dataset.leadGroup;
            leaders.cat = LEADER_CATS[leaders.group][0].key;
            renderLeaderControls();
            loadLeaders();
            return;
        }
        const c = e.target.closest("[data-lead-cat]");
        if (c) { leaders.cat = c.dataset.leadCat; renderLeaderControls(); loadLeaders(); }
    });
    document.getElementById("leadersBody").addEventListener("click", e => {
        const row = e.target.closest("[data-player-id]");
        if (row) openPlayerById(Number(row.dataset.playerId), row, leaders.season);
    });
}

function renderLeaderControls() {
    document.getElementById("leadersSeason").value = String(leaders.season);
    document.querySelectorAll("[data-lead-group]").forEach(b => {
        b.classList.toggle("active", b.dataset.leadGroup === leaders.group);
        b.setAttribute("aria-pressed", b.dataset.leadGroup === leaders.group);
    });
    document.getElementById("leaderCats").innerHTML = LEADER_CATS[leaders.group].map(c =>
        `<button class="chip ${c.key === leaders.cat ? "active" : ""}" data-lead-cat="${c.key}" aria-pressed="${c.key === leaders.cat}">${c.label}</button>`
    ).join("");
}

async function loadLeaders() {
    const seq = ++leaders.seq;
    const body = document.getElementById("leadersBody");
    body.innerHTML = `<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading leaders…</div>`;
    const cat = LEADER_CATS[leaders.group].find(c => c.key === leaders.cat);
    try {
        const data = await getLeaders(leaders.cat, leaders.group, leaders.season, leaders.league);
        if (seq !== leaders.seq) return;
        const list = data.leagueLeaders?.[0]?.leaders || [];
        if (!list.length) {
            body.innerHTML = `<p class="empty-hint leaders-empty">No ${esc(cat.label.toLowerCase())} leaders for ${leaders.season}.</p>`;
            return;
        }
        body.innerHTML = `<ol class="leader-list">${list.map(x => `
            <li>
                <button class="leader-row" data-player-id="${x.person.id}">
                    <span class="leader-rank">${x.rank}</span>
                    <img src="${headshotUrl(x.person.id, 80)}" alt="" loading="lazy">
                    <span class="leader-name">
                        <strong>${esc(x.person.fullName)}</strong>
                        <small>${esc(x.team ? (state.teamAbbr[x.team.id] || x.team.name) : "")}</small>
                    </span>
                    <span class="leader-value">${esc(x.value)}</span>
                </button>
            </li>`).join("")}</ol>
            <p class="table-hint">${esc(cat.label)} · ${leaders.season} · ${leaders.league === "103" ? "American League" : leaders.league === "104" ? "National League" : "All of MLB"}. Click a player for details.</p>`;
    } catch (err) {
        if (seq !== leaders.seq) return;
        console.error("Leaders error:", err);
        body.innerHTML = `<p class="empty-hint leaders-empty">Leaders couldn't be loaded. Check your connection and try again.</p>`;
    }
}
