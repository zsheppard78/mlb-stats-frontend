// find-player.js — Find a player: search any MLB player and recently viewed players.

import { headshotUrl, searchPeople } from "./api.js";
import { closeModal, openModal } from "./modals.js";
import { openPlayerById } from "./player.js";
import { esc, readJSON } from "./util.js";

const find = { timer: null, seq: 0, results: [] };

export function openFindPlayer(opener) {
    openModal("findModal", opener);
    const input = document.getElementById("findSearch");
    input.focus();
    if (!input.value.trim()) renderRecentPlayers();
}

export function setupFindPlayer() {
    const input = document.getElementById("findSearch");
    const list = document.getElementById("findResults");
    document.getElementById("closeFind").addEventListener("click", () => closeModal("findModal"));

    input.addEventListener("input", () => {
        clearTimeout(find.timer);
        const q = input.value.trim();
        if (q.length < 2) { renderRecentPlayers(); return; }
        find.timer = setTimeout(() => runFindSearch(q), 250);
    });
    input.addEventListener("keydown", e => {
        if (e.key === "ArrowDown") {
            const first = list.querySelector("button");
            if (first) { e.preventDefault(); first.focus(); }
        }
        if (e.key === "Enter") {
            const first = list.querySelector("button[data-player-id]");
            if (first) { e.preventDefault(); first.click(); }
        }
    });
    list.addEventListener("keydown", e => {
        const items = [...list.querySelectorAll("button")];
        const i = items.indexOf(document.activeElement);
        if (e.key === "ArrowDown" && i < items.length - 1) { e.preventDefault(); items[i + 1].focus(); }
        if (e.key === "ArrowUp") { e.preventDefault(); (i > 0 ? items[i - 1] : input).focus(); }
    });
    list.addEventListener("click", e => {
        const btn = e.target.closest("[data-player-id]");
        if (btn) openPlayerById(Number(btn.dataset.playerId), btn);
    });
}

function playerResultHTML(x, note) {
    return `<li><button type="button" data-player-id="${x.id}">
        <img src="${headshotUrl(x.id, 60)}" alt="" loading="lazy">
        <span><strong>${esc(x.fullName || x.name)}</strong><small>${esc(note)}</small></span>
    </button></li>`;
}

async function runFindSearch(q) {
    const list = document.getElementById("findResults");
    const seq = ++find.seq;
    list.innerHTML = `<li class="result-note">Searching…</li>`;
    try {
        const data = await searchPeople(q);
        if (seq !== find.seq) return;
        const people = (data.people || []).filter(x => x.mlbDebutDate).slice(0, 10);
        list.innerHTML = people.length
            ? people.map(x => playerResultHTML(x,
                `${x.primaryPosition?.abbreviation || ""} · debut ${x.mlbDebutDate.slice(0, 4)}${x.active ? " · active" : ""}`)).join("")
            : `<li class="result-note">No MLB players match "${esc(q)}".</li>`;
    } catch (err) {
        if (seq !== find.seq) return;
        console.error("Player search error:", err);
        list.innerHTML = `<li class="result-note">Search isn't available right now. Try again in a moment.</li>`;
    }
}

function renderRecentPlayers() {
    find.seq++;
    const recent = readJSON("recentPlayers", []);
    document.getElementById("findResults").innerHTML = recent.length
        ? `<li class="result-note">Recently viewed</li>` + recent.map(x => playerResultHTML(x, x.note || "")).join("")
        : `<li class="result-note">Type at least 2 letters. Any MLB player, past or present.</li>`;
}
