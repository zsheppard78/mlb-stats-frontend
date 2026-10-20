// modals.js — Shared window behavior: open/close, Esc, focus, plus roster tabs and sorting clicks.

import { openPlayerModal } from "./player.js";
import { state } from "./state.js";
import { columnsFor, openRosterModal, renderRoster, rosterKey } from "./team.js";

const modalStack = []; // [{id, returnFocus}]

export function anyModalOpen() {
    return modalStack.length > 0;
}

export function openModal(id, opener) {
    const modal = document.getElementById(id);
    if (!modal.hidden) return;
    modal.hidden = false;
    modalStack.push({ id, returnFocus: opener || document.activeElement });
    document.documentElement.classList.add("no-scroll");
    modal.querySelector(".close-btn")?.focus();
}

export function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal.hidden) return;
    modal.hidden = true;
    const idx = modalStack.findIndex(m => m.id === id);
    const entry = idx >= 0 ? modalStack.splice(idx, 1)[0] : null;
    if (!modalStack.length) document.documentElement.classList.remove("no-scroll");
    if (entry?.returnFocus && document.contains(entry.returnFocus)) entry.returnFocus.focus();
}

export function setupModals() {
    document.getElementById("closeModal").addEventListener("click", () => closeModal("rosterModal"));
    document.getElementById("closeHelp").addEventListener("click", () => closeModal("helpModal"));
    document.getElementById("backToRoster").addEventListener("click", () => closeModal("playerModal"));
    document.getElementById("closePlayerModal").addEventListener("click", () => {
        closeModal("playerModal");
        closeModal("rosterModal");
    });

    // Click on the dark backdrop closes that modal
    document.querySelectorAll(".modal").forEach(modal => {
        modal.addEventListener("click", e => {
            if (e.target === modal) closeModal(modal.id);
        });
    });

    // Esc closes the top-most modal
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && modalStack.length) {
            closeModal(modalStack[modalStack.length - 1].id);
        }
    });

    // Roster tabs
    document.getElementById("rosterTabs").addEventListener("click", e => {
        const btn = e.target.closest(".tab-btn");
        if (!btn) return;
        state.currentTab = btn.dataset.tab;
        renderRoster();
    });

    // Sorting + player click inside the roster
    document.getElementById("rosterBody").addEventListener("click", e => {
        const sortBtn = e.target.closest("[data-sort]");
        if (sortBtn) {
            const tab = state.currentTab;
            const key = sortBtn.dataset.sort;
            const col = columnsFor(tab).find(c => c.key === key);
            const cur = state.sort[tab];
            state.sort[tab] = cur.key === key ? { key, dir: -cur.dir } : { key, dir: col.firstDir || -1 };
            renderRoster();
            document.querySelector(`#rosterBody [data-sort="${key}"]`)?.focus();
            return;
        }
        if (e.target.closest("#rosterRetry")) {
            delete state.rosterCache[rosterKey(state.currentTeam.id)];
            openRosterModal(state.currentTeam);
            return;
        }
        const row = e.target.closest(".player-row");
        if (row) openPlayerModal(Number(row.dataset.id), row);
    });

    document.getElementById("rosterBody").addEventListener("keydown", e => {
        if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("player-row")) {
            e.preventDefault();
            openPlayerModal(Number(e.target.dataset.id), e.target);
        }
    });
}
