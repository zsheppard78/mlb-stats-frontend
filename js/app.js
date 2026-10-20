// app.js — Starts the app: sets up every feature in order, then loads the data.
// This is the only script the page loads; everything else is imported from here.
import { account, openAccount, setupAccount } from "./account.js";
import { SEASON } from "./api.js";
import { compare, setupCompare } from "./compare.js";
import { openFindPlayer, setupFindPlayer } from "./find-player.js";
import { games, openGames, setupGames } from "./games.js";
import { openLeaders, setupLeaders } from "./leaders.js";
import { setupMenu } from "./menu.js";
import { setupModals } from "./modals.js";
import { openPlayerById, setupPlayerWindow } from "./player.js";
import { setupInstall } from "./pwa.js";
import { restoreDivisionState, setupDivisionToggles, setupSearch } from "./search.js";
import { applyCompareParams, setupShareButtons } from "./share.js";
import { loadData, setupRefresh, setupSeasonPicker, setupTeamInteractions, updateUpdatedLine } from "./standings.js";
import { state } from "./state.js";
import { setupTeamView } from "./team.js";
import { applyThemeChoice, getThemeChoice } from "./theme.js";
import { loadUpcoming, setupUpcoming } from "./upcoming.js";
import { renderWorldSeries, setupWorldSeries } from "./world-series.js";

// Shared links: ?season=YYYY opens that season
const seasonParam = Number(new URLSearchParams(location.search).get("season"));
if (seasonParam >= 1969 && seasonParam <= SEASON) state.season = seasonParam;
document.getElementById("seasonLabel").textContent = state.season;

// Home page, windows and menu
setupSeasonPicker();
setupPlayerWindow();
setupCompare();
applyThemeChoice(getThemeChoice());
restoreDivisionState();
setupMenu();
setupModals();
setupSearch();
setupDivisionToggles();
setupTeamInteractions();

// Menu items that open a window (the menu closes first)
const fromMenu = (btnId, open) => {
    document.getElementById(btnId).addEventListener("click", () => {
        document.getElementById("closeMenuBtn").click();
        open(document.getElementById("menuBtn"));
    });
};
fromMenu("gamesBtn", openGames);
fromMenu("leadersBtn", openLeaders);
fromMenu("accountMenuBtn", openAccount);
fromMenu("findPlayerBtn", openFindPlayer);
fromMenu("favoritesBtn", () => {
    const section = document.getElementById("favorites-section");
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    section.querySelector(".team-card")?.focus({ preventScroll: true });
});

setupGames();
setupLeaders();
setupFindPlayer();
setupTeamView();
setupShareButtons();
setupRefresh();
setupInstall();
setupUpcoming();
setupWorldSeries();
setupAccount();

// Every time standings load (first visit, season change, Refresh)
let playerParamHandled = false;
document.addEventListener("mlb:data-loaded", event => {
    if (event.detail.ok) {
        state.lastUpdated = new Date();
        updateUpdatedLine();
    }
    loadUpcoming();
    renderWorldSeries();

    // Shared links: ?player=ID opens that player once
    if (!playerParamHandled) {
        playerParamHandled = true;
        const playerId = Number(new URLSearchParams(location.search).get("player"));
        if (playerId) openPlayerById(playerId);
    }
});

loadData();
applyCompareParams(); // shared links: ?compare=ID,ID opens the comparison

// Handy for poking around in the browser console (the tests use it too)
window.mlbApp = { state, games, compare, account };
