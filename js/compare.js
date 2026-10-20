// compare.js — Compare players: search, table with best values, single season or career, and chart view.

import { headshotUrl, searchPeople } from "./api.js";
import { groupsFor, loadCareers, seasonSpan, statDefs } from "./career.js";
import { CHART_STATS, chartChips, chartChoice, drawLineChart, statValue } from "./charts.js";
import { closeModal, openModal } from "./modals.js";
import { state } from "./state.js";
import { num } from "./team.js";
import { esc, readJSON, showToast, writeJSON } from "./util.js";

export const MAX_COMPARE = 4;

export const compare = {
    ids: readJSON("compareIds", []).map(Number).filter(Boolean).slice(0, MAX_COMPARE),
    mode: "career",       // career | season
    group: null,          // hitting | pitching (null = pick automatically)
    season: null,         // chosen season in "season" mode
    searchTimer: null,
    searchSeq: 0
};

export function saveCompare() {
    writeJSON("compareIds", compare.ids);
}

export function addToCompare(id, person) {
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

export function openCompare(opener) {
    openModal("compareModal", opener);
    document.getElementById("compareSearch").focus();
    renderCompare();
}

export function setupCompare() {
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
        const data = await searchPeople(q);
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

// Compare: each player keeps the same color while they're in the list
function compareSlot(id) {
    id = Number(id);
    const slots = readJSON("compareSlots", {});
    const others = compare.ids.filter(x => x !== id);
    const used = new Set(others.map(x => slots[x]).filter(Boolean));
    if (!slots[id] || used.has(slots[id])) {
        slots[id] = [1, 2, 3, 4].find(n => !used.has(n)) || 1;
        // forget players no longer in the list
        Object.keys(slots).forEach(k => { if (!compare.ids.includes(Number(k))) delete slots[k]; });
        writeJSON("compareSlots", slots);
    }
    return slots[id];
}

function renderCompareChart(body, careers, group) {
    const key = CHART_STATS[group].some(([k]) => k === chartChoice[group]) ? chartChoice[group] : CHART_STATS[group][0][0];
    const label = CHART_STATS[group].find(([k]) => k === key)[1];
    const series = careers.map(c => ({
        id: c.person.id,
        name: c.person.fullName,
        color: `var(--series-${compareSlot(c.person.id)})`,
        points: (c[group]?.years || []).map(y => ({ x: y.season, y: statValue(key, y.stat?.[key]) })).filter(p => p.y !== null)
    })).filter(s => s.points.length);

    body.innerHTML = `${chartChips(group, key)}<div class="chart-area"></div>
        <p class="table-hint">${label} for each season. Hover or tap the chart to see exact numbers; switch to Table for career totals.</p>`;
    body.onclick = e => {
        const chip = e.target.closest("[data-chart-stat]");
        if (chip) { chartChoice[group] = chip.dataset.chartStat; renderCompare(); }
    };
    if (!series.length) {
        body.querySelector(".chart-area").innerHTML = `<p class="empty-hint">None of these players have MLB ${group} stats.</p>`;
        return;
    }
    drawLineChart(body.querySelector(".chart-area"), series, key, label);
}
