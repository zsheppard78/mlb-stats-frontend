// menu.js — The ☰ side menu: opening/closing, theme picker, reset and help.

import { openModal } from "./modals.js";
import { setThemeChoice } from "./theme.js";
import { showToast } from "./util.js";

export function setupMenu() {
    const menuBtn = document.getElementById("menuBtn");
    const sideMenu = document.getElementById("sideMenu");
    const backdrop = document.getElementById("menuBackdrop");

    const openMenu = () => {
        sideMenu.classList.add("active");
        sideMenu.setAttribute("aria-hidden", "false");
        menuBtn.setAttribute("aria-expanded", "true");
        backdrop.hidden = false;
        setTimeout(() => document.getElementById("gamesBtn").focus(), 60);
    };
    const closeMenu = (returnFocus = true) => {
        if (!sideMenu.classList.contains("active")) return;
        sideMenu.classList.remove("active");
        sideMenu.setAttribute("aria-hidden", "true");
        menuBtn.setAttribute("aria-expanded", "false");
        backdrop.hidden = true;
        if (returnFocus) menuBtn.focus();
    };

    menuBtn.addEventListener("click", () =>
        sideMenu.classList.contains("active") ? closeMenu() : openMenu());
    document.getElementById("closeMenuBtn").addEventListener("click", () => closeMenu());
    backdrop.addEventListener("click", () => closeMenu(false));
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && sideMenu.classList.contains("active")) closeMenu();
    });

    // Theme picker
    document.getElementById("theme").addEventListener("change", e => {
        setThemeChoice(e.target.value);
        const label = e.target.options[e.target.selectedIndex].text;
        showToast(`Theme: ${label}`);
    });

    // Reset theme
    document.getElementById("resetThemeBtn").addEventListener("click", () => {
        localStorage.removeItem("favoriteTeamTheme");
        setThemeChoice("classic");
        showToast("Theme reset to Ballpark");
    });

    // Help
    const openHelp = () => { closeMenu(false); openModal("helpModal"); };
    document.getElementById("helpBtn").addEventListener("click", openHelp);
    document.getElementById("helpBtnHeader").addEventListener("click", openHelp);
}
