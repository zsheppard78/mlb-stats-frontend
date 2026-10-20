// upcoming.js — Upcoming games section on the home page.

import { SEASON, getScheduleRange, logoUrl } from "./api.js";
import { games, loadGames } from "./games.js";
import { openModal } from "./modals.js";
import { abbrFor, state } from "./state.js";
import { addDays, dayLabel, esc, gameTime, isoDate, parseISODate } from "./util.js";

const UPCOMING_MAX = 8;

let upcomingSeq = 0;

export function setupUpcoming() {
    document.getElementById("upcomingAll").addEventListener("click", e => {
        games.date = isoDate(new Date());
        openModal("gamesModal", e.currentTarget);
        loadGames();
    });
    document.getElementById("upcomingList").addEventListener("click", e => {
        const card = e.target.closest("[data-game-date]");
        if (!card) return;
        games.date = card.dataset.gameDate;
        openModal("gamesModal", card);
        loadGames();
    });
}

export async function loadUpcoming() {
    const section = document.getElementById("upcomingSection") || document.getElementById("upcoming-section");
    const list = document.getElementById("upcomingList");
    const seq = ++upcomingSeq;

    // Only the current season has upcoming games
    if (state.season !== SEASON && state.season !== new Date().getFullYear()) {
        section.hidden = true;
        return;
    }

    const today = isoDate(new Date());
    const fetchRange = days => getScheduleRange(today, addDays(today, days), "team,probablePitcher,seriesStatus");
    const pickUpcoming = data => (data.dates || [])
        .flatMap(d => (d.games || []).map(g => ({ ...g, day: d.date })))
        .filter(g => g.status?.abstractGameState === "Preview" && !/Postponed|Cancelled/.test(g.status?.detailedState || ""))
        .filter(g => new Date(g.gameDate) > new Date(Date.now() - 15 * 60000) || g.status?.startTimeTBD);

    let upcoming = [];
    try {
        upcoming = pickUpcoming(await fetchRange(14));
        // Offseason: look further ahead for the next scheduled games (e.g. Opening Day)
        if (!upcoming.length) upcoming = pickUpcoming(await fetchRange(180));
    } catch (err) {
        console.warn("Upcoming games unavailable:", err);
        if (seq === upcomingSeq) section.hidden = true;
        return;
    }
    if (seq !== upcomingSeq) return;

    if (!upcoming.length) {
        section.hidden = false;
        list.innerHTML = `<p class="empty-hint">No games on the schedule yet. Check back closer to spring training.</p>`;
        return;
    }

    const favs = new Set(state.favorites);
    const shown = upcoming.slice(0, UPCOMING_MAX);
    list.innerHTML = shown.map(g => {
        const away = g.teams.away, home = g.teams.home;
        const isFav = favs.has(away.team.id) || favs.has(home.team.id);
        const when = g.status?.startTimeTBD ? "Time TBD" : gameTime(g.gameDate);
        const series = g.gameType !== "R" && g.seriesStatus
            ? (g.seriesStatus.shortDescription || g.description || "") : "";
        const pp = side => side.probablePitcher?.fullName;
        const pitchers = pp(away) || pp(home)
            ? `${esc(pp(away) || "TBD")} vs ${esc(pp(home) || "TBD")}` : "";
        const row = side => `<span class="up-team">
                <img src="${logoUrl(side.team.id)}" alt="" class="mini-logo" loading="lazy">
                <span>${esc(abbrFor(side.team))}</span>
                ${side.leagueRecord && g.gameType === "R" ? `<small>${side.leagueRecord.wins}-${side.leagueRecord.losses}</small>` : ""}
            </span>`;
        return `<button class="up-card ${isFav ? "is-fav" : ""}" data-game-date="${g.day}"
                aria-label="${esc(away.team.name)} at ${esc(home.team.name)}, ${esc(dayLabel(g.day))} ${esc(when)}${isFav ? ", one of your teams" : ""}">
            <span class="up-when"><strong>${esc(shortDayLabel(g.day))}</strong> ${esc(when)}${isFav ? '<span class="up-star" aria-hidden="true">★</span>' : ""}</span>
            ${series ? `<span class="up-series">${esc(series)}</span>` : ""}
            ${row(away)}
            <span class="up-at" aria-hidden="true">@</span>
            ${row(home)}
            ${pitchers ? `<span class="up-pitchers">${pitchers}</span>` : ""}
        </button>`;
    }).join("") + (upcoming.length > UPCOMING_MAX
        ? `<button class="up-card up-more" data-game-date="${shown[shown.length - 1].day}">See ${upcoming.length - UPCOMING_MAX} more in the full schedule</button>`
        : "");
    section.hidden = false;
}

export function shortDayLabel(iso) {
    const today = isoDate(new Date());
    if (iso === today) return "Today";
    if (iso === addDays(today, 1)) return "Tomorrow";
    return parseISODate(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
