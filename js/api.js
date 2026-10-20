// api.js — Where the data comes from: config, the fetch helper, image URLs and every API request the app makes.

const BACKEND = "https://mlb-stats-backend-1.onrender.com";

const MLB_API = "https://statsapi.mlb.com/api/v1";

// The MLB regular season runs roughly April–October. Before April, show last season.
export const SEASON = (() => {
    const now = new Date();
    return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
})();

// Division IDs used by the MLB Stats API -> the element IDs in index.html
export const DIVISION_IDS = {
    201: "AL-East", 202: "AL-Central", 200: "AL-West",
    204: "NL-East", 205: "NL-Central", 203: "NL-West"
};

const DIVISION_NAMES = {
    "American League East": "AL-East", "American League Central": "AL-Central", "American League West": "AL-West",
    "National League East": "NL-East", "National League Central": "NL-Central", "National League West": "NL-West",
    "AL East": "AL-East", "AL Central": "AL-Central", "AL West": "AL-West",
    "NL East": "NL-East", "NL Central": "NL-Central", "NL West": "NL-West"
};

export function divisionKey(division) {
    if (!division) return null;
    return DIVISION_IDS[division.id] || DIVISION_NAMES[division.name] || DIVISION_NAMES[division.nameShort] || null;
}

export const logoUrl = id => `https://www.mlbstatic.com/team-logos/${id}.svg`;

export const logoFallbackUrl = id => `https://www.mlbstatic.com/team-logos/${id}.svg`;

export const headshotUrl = (id, w = 120) =>
    `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_${w},q_auto:best/v1/people/${id}/headshot/67/current`;

async function fetchJSON(url, timeoutMs = 20000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

// Every request the app makes lives below, so the data source can change in one place
// (for example, routing more calls through the Java backend later).
export async function getTeamsFromBackend() {
    return fetchJSON(`${BACKEND}/api/teams`, 60000); // free Render apps can take a while to wake up
}

export async function getTeams(season) {
    return fetchJSON(`${MLB_API}/teams?sportId=1&season=${season}`);
}

export async function getStandings(season) {
    return fetchJSON(`${MLB_API}/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=division,team`);
}

// One request gets the whole roster *with* each player's season stats.
// Current season: today's active roster. Past seasons: everyone who played that year.
export async function getRoster(teamId, season) {
    return fetchJSON(`${MLB_API}/teams/${teamId}/roster?rosterType=${season === SEASON ? "active" : "fullSeason"}&season=${season}` +
        `&hydrate=person(stats(type=season,season=${season},group=[hitting,pitching]))`);
}

export async function getCareers(ids) {
    return fetchJSON(`${MLB_API}/people?personIds=${ids.join(",")}` +
        `&hydrate=currentTeam,stats(group=[hitting,pitching],type=[career,yearByYear])`);
}

export async function getPlayer(id, season) {
    return fetchJSON(`${MLB_API}/people/${id}?hydrate=currentTeam,` +
        `stats(group=[hitting,pitching],type=[season,career,yearByYear],season=${season})`);
}

// kind: "gameLog" or "statSplits"
export async function getPlayerStats(id, kind, group, season) {
    return fetchJSON(kind === "gameLog"
        ? `${MLB_API}/people/${id}/stats?stats=gameLog&group=${group}&season=${season}`
        : `${MLB_API}/people/${id}/stats?stats=statSplits&group=${group}&season=${season}&sitCodes=h,a,d,n,vl,vr`);
}

export async function searchPeople(query) {
    return fetchJSON(`${MLB_API}/people/search?names=${encodeURIComponent(query)}&sportIds=1&limit=25`);
}

export async function getGamesOn(date) {
    return fetchJSON(`${MLB_API}/schedule?sportId=1&date=${date}` +
        `&hydrate=probablePitcher,linescore,team,decisions,seriesStatus`);
}

export async function getScheduleRange(startDate, endDate, hydrate = "") {
    return fetchJSON(`${MLB_API}/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}${hydrate ? `&hydrate=${hydrate}` : ""}`);
}

export async function getTeamSchedule(teamId, season) {
    return fetchJSON(`${MLB_API}/schedule?sportId=1&teamId=${teamId}&season=${season}` +
        `&gameType=R,F,D,L,W&hydrate=team,linescore`);
}

export async function getTeamPostseason(teamId, season) {
    return fetchJSON(`${MLB_API}/schedule?sportId=1&teamId=${teamId}&season=${season}&gameType=F,D,L,W`);
}

export async function getLeaders(category, group, season, leagueId = "") {
    return fetchJSON(`${MLB_API}/stats/leaders?leaderCategories=${category}&statGroup=${group}` +
        `&season=${season}&sportId=1&limit=10${leagueId ? `&leagueId=${leagueId}` : ""}`);
}

export async function getWorldSeriesGames(season) {
    return fetchJSON(`${MLB_API}/schedule?sportId=1&season=${season}&gameType=W&hydrate=team,seriesStatus`);
}

export async function getWorldSeriesMVP(season) {
    return fetchJSON(`${MLB_API}/awards/WSMVP/recipients?season=${season}`);
}
