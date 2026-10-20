// career.js — Career and year-by-year stats: stat definitions, parsing and loading.

import { getCareers } from "./api.js";
import { state } from "./state.js";

const HIT_STATS = [
    { key: "gamesPlayed", label: "G", title: "Games" },
    { key: "plateAppearances", label: "PA", title: "Plate appearances" },
    { key: "atBats", label: "AB", title: "At bats" },
    { key: "runs", label: "R", title: "Runs" },
    { key: "hits", label: "H", title: "Hits" },
    { key: "doubles", label: "2B", title: "Doubles" },
    { key: "triples", label: "3B", title: "Triples" },
    { key: "homeRuns", label: "HR", title: "Home runs" },
    { key: "rbi", label: "RBI", title: "Runs batted in" },
    { key: "stolenBases", label: "SB", title: "Stolen bases" },
    { key: "baseOnBalls", label: "BB", title: "Walks" },
    { key: "strikeOuts", label: "SO", title: "Strikeouts", lowerIsBetter: true },
    { key: "avg", label: "AVG", title: "Batting average" },
    { key: "obp", label: "OBP", title: "On-base percentage" },
    { key: "slg", label: "SLG", title: "Slugging percentage" },
    { key: "ops", label: "OPS", title: "On-base plus slugging" }
];

const PITCH_STATS = [
    { key: "wins", label: "W", title: "Wins" },
    { key: "losses", label: "L", title: "Losses", lowerIsBetter: true },
    { key: "era", label: "ERA", title: "Earned run average", lowerIsBetter: true },
    { key: "gamesPitched", label: "G", title: "Games pitched" },
    { key: "gamesStarted", label: "GS", title: "Games started" },
    { key: "saves", label: "SV", title: "Saves" },
    { key: "inningsPitched", label: "IP", title: "Innings pitched" },
    { key: "strikeOuts", label: "SO", title: "Strikeouts" },
    { key: "baseOnBalls", label: "BB", title: "Walks allowed", lowerIsBetter: true },
    { key: "homeRuns", label: "HR", title: "Home runs allowed", lowerIsBetter: true },
    { key: "whip", label: "WHIP", title: "Walks + hits per inning", lowerIsBetter: true },
    { key: "avg", label: "Opp AVG", title: "Opponents' batting average", lowerIsBetter: true }
];

// Short stat lists for the year-by-year tables
export const HIT_YEAR_KEYS = ["gamesPlayed", "atBats", "hits", "homeRuns", "rbi", "stolenBases", "avg", "obp", "ops"];

export const PITCH_YEAR_KEYS = ["wins", "losses", "era", "gamesPitched", "gamesStarted", "saves", "inningsPitched", "strikeOuts", "whip"];

export const statDefs = group => (group === "pitching" ? PITCH_STATS : HIT_STATS);

function teamShort(team) {
    if (!team) return "";
    return state.teamAbbr[team.id] || team.abbreviation || team.name || "";
}

// Turn an MLB "people" record (hydrated with career + yearByYear stats) into something easy to use
export function parseCareer(person) {
    const out = { person, hitting: null, pitching: null };
    ["hitting", "pitching"].forEach(group => {
        const entries = (person.stats || []).filter(s => s.group?.displayName === group);
        const isMLB = sp => !sp.sport || sp.sport.id === 1;
        const career = entries.find(s => s.type?.displayName === "career")?.splits?.find(isMLB)?.stat || null;
        const yearSplits = (entries.find(s => s.type?.displayName === "yearByYear")?.splits || []).filter(isMLB);

        // One row per season. Traded players have a row per team plus a combined row (no team).
        const bySeason = new Map();
        yearSplits.forEach(sp => {
            if (!bySeason.has(sp.season)) bySeason.set(sp.season, []);
            bySeason.get(sp.season).push(sp);
        });
        const years = [...bySeason.entries()]
            .map(([season, splits]) => {
                const teamSplits = splits.filter(sp => sp.team);
                const total = splits.find(sp => !sp.team) || splits[0];
                const teamLabel = teamSplits.length > 1
                    ? teamSplits.map(sp => teamShort(sp.team)).join(" / ")
                    : teamShort(total.team || teamSplits[0]?.team);
                return { season: Number(season), team: teamLabel, stat: total.stat };
            })
            .sort((a, b) => a.season - b.season);

        if (career || years.length) out[group] = { career, years };
    });
    return out;
}

export async function loadCareers(ids) {
    const missing = ids.filter(id => !state.careerCache[id]);
    if (missing.length) {
        const data = await getCareers(missing);
        (data.people || []).forEach(person => { state.careerCache[person.id] = parseCareer(person); });
    }
    return ids.map(id => state.careerCache[id]).filter(Boolean);
}

export function seasonSpan(career, group) {
    const years = career?.[group]?.years || [];
    if (!years.length) return "";
    const first = years[0].season;
    const last = years[years.length - 1].season;
    return first === last ? `${first}` : `${first}–${last}`;
}

// Which stat groups matter for a player (pitchers: pitching, two-way: both, everyone else: hitting)
export function groupsFor(person) {
    const type = person?.primaryPosition?.type || "";
    const abbr = person?.primaryPosition?.abbreviation || "";
    if (type === "Two-Way Player" || abbr === "TWP") return ["hitting", "pitching"];
    if (type === "Pitcher" || abbr === "P") return ["pitching"];
    return ["hitting"];
}
