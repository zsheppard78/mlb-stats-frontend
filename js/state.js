// state.js — The app's shared state (season, teams, standings, caches) and team lookups.

import { SEASON } from "./api.js";
import { readJSON } from "./util.js";

export const state = {
    teams: [],               // [{id, name, abbreviation, divKey, ...}]
    standings: {},           // teamId -> standings record
    favorites: readJSON("favorites", []).map(Number),
    season: SEASON,          // season being viewed (picker in the toolbar)
    rosterCache: {},         // "season-teamId" -> players[]
    careerCache: {},         // playerId -> { person, hitting, pitching } (career + year-by-year)
    playerView: "season",    // player window tab: season | career | years
    teamAbbr: {},            // teamId -> abbreviation (for year-by-year tables)
    teamParamHandled: false,
    currentTeam: null,
    currentTab: "hitters",
    sort: { hitters: { key: "pos", dir: 1 }, pitchers: { key: "role", dir: 1 } },
    searching: false
};

export const teamById = id => state.teams.find(t => t.id === Number(id));

export function abbrFor(team) {
    if (!team) return "";
    return team.abbreviation || state.teamAbbr[team.id] || team.teamName || team.name || "";
}
