// share.js — Copy link buttons and opening shared comparison links.

import { MAX_COMPARE, compare, openCompare, saveCompare } from "./compare.js";
import { currentPlayer } from "./player.js";
import { state } from "./state.js";
import { showToast } from "./util.js";

function shareURL(params) {
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    if (url.pathname.endsWith("favorites.html")) url.pathname = url.pathname.replace(/favorites\.html$/, "");
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v); });
    return url.toString();
}

async function copyLink(url) {
    try {
        await navigator.clipboard.writeText(url);
        showToast("Link copied");
    } catch {
        window.prompt("Copy this link:", url);
    }
}

export function setupShareButtons() {
    document.getElementById("copyTeamLink").addEventListener("click", () => {
        if (state.currentTeam) copyLink(shareURL({ team: state.currentTeam.id, season: state.season }));
    });
    document.getElementById("copyPlayerLink").addEventListener("click", () => {
        if (currentPlayer) copyLink(shareURL({ player: currentPlayer.id, season: currentPlayer.season || state.season }));
    });
    document.getElementById("copyCompareLink").addEventListener("click", () => {
        if (!compare.ids.length) { showToast("Add a player first"); return; }
        copyLink(shareURL({
            compare: compare.ids.join(","),
            cmode: compare.mode,
            cview: compare.view === "chart" ? "chart" : "",
            cgroup: compare.group || "",
            cseason: compare.mode === "season" ? compare.season : ""
        }));
    });
}

// ?compare=1,2&cmode=season&cseason=2022 opens the compare window
export function applyCompareParams() {
    const params = new URLSearchParams(location.search);
    const ids = (params.get("compare") || "").split(",").map(Number).filter(Boolean).slice(0, MAX_COMPARE);
    if (!ids.length) return;
    compare.ids = ids;
    compare.mode = params.get("cmode") === "season" ? "season" : "career";
    compare.view = params.get("cview") === "chart" ? "chart" : "table";
    compare.group = ["hitting", "pitching"].includes(params.get("cgroup")) ? params.get("cgroup") : null;
    compare.season = Number(params.get("cseason")) || null;
    saveCompare();
    openCompare();
}
