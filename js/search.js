// search.js — Team search on the home page and opening/closing divisions.

import { anyModalOpen } from "./modals.js";
import { state, teamById } from "./state.js";
import { readJSON, writeJSON } from "./util.js";

export function setupSearch() {
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

export function applySearch(raw) {
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

export function restoreDivisionState() {
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

export function setupDivisionToggles() {
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
