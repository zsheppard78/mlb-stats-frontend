// =========================================================
// extras.js — Today's games, League leaders, Find a player,
// game logs, splits, charts, team schedule, share links,
// refresh, and install-as-app.
// Loaded after script.js and uses its helpers (state, fetchJSON, esc, ...).
// =========================================================


// =========================
// DATE HELPERS
// =========================
function isoDate(d) {
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISODate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d, 12);
}

function addDays(iso, n) {
    const d = parseISODate(iso);
    d.setDate(d.getDate() + n);
    return isoDate(d);
}

function dayLabel(iso) {
    const today = isoDate(new Date());
    const d = parseISODate(iso);
    const long = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    if (iso === today) return `Today, ${long}`;
    if (iso === addDays(today, -1)) return `Yesterday, ${long}`;
    if (iso === addDays(today, 1)) return `Tomorrow, ${long}`;
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

const shortDate = iso => parseISODate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const gameTime = iso => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function abbrFor(team) {
    if (!team) return "";
    return team.abbreviation || state.teamAbbr[team.id] || team.teamName || team.name || "";
}


// =========================
// MENU WIRING
// =========================
document.addEventListener("DOMContentLoaded", () => {
    const fromMenu = (btnId, fn) => {
        document.getElementById(btnId).addEventListener("click", () => {
            document.getElementById("closeMenuBtn").click();
            fn(document.getElementById("menuBtn"));
        });
    };
    fromMenu("gamesBtn", openGames);
    fromMenu("leadersBtn", openLeaders);
    fromMenu("findPlayerBtn", openFindPlayer);

    setupGames();
    setupLeaders();
    setupFindPlayer();
    setupTeamView();
    setupShareButtons();
    setupRefresh();
    setupInstall();
    applyCompareParams();
});


// =========================
// TODAY'S GAMES
// =========================
const games = { date: isoDate(new Date()), timer: null, seq: 0 };

function openGames(opener) {
    games.date = isoDate(new Date());
    openModal("gamesModal", opener);
    loadGames();
}

function setupGames() {
    document.getElementById("closeGames").addEventListener("click", () => closeModal("gamesModal"));
    document.getElementById("gamesPrev").addEventListener("click", () => { games.date = addDays(games.date, -1); loadGames(); });
    document.getElementById("gamesNext").addEventListener("click", () => { games.date = addDays(games.date, 1); loadGames(); });
    document.getElementById("gamesToday").addEventListener("click", () => { games.date = isoDate(new Date()); loadGames(); });
    document.getElementById("gamesBody").addEventListener("click", e => {
        const jump = e.target.closest("[data-jump]");
        if (jump) { games.date = jump.dataset.jump; loadGames(); return; }
        const teamBtn = e.target.closest("[data-open-team]");
        if (teamBtn) {
            const team = teamById(teamBtn.dataset.openTeam);
            if (team) openRosterModal(team, teamBtn);
        }
    });
}

async function loadGames({ quiet = false } = {}) {
    clearTimeout(games.timer);
    const seq = ++games.seq;
    const date = games.date;
    document.getElementById("gamesDate").textContent = dayLabel(date);
    document.getElementById("gamesToday").hidden = date === isoDate(new Date());
    const body = document.getElementById("gamesBody");
    if (!quiet) body.innerHTML = `<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading games…</div>`;

    let list = [];
    try {
        const data = await fetchJSON(`${MLB_API}/schedule?sportId=1&date=${date}` +
            `&hydrate=probablePitcher,linescore,team,decisions,seriesStatus`);
        list = data.dates?.[0]?.games || [];
    } catch (err) {
        if (seq !== games.seq) return;
        console.error("Schedule error:", err);
        body.innerHTML = `<div class="loading-block error">Games couldn't be loaded. <button class="ghost-btn" data-jump="${date}">Try again</button></div>`;
        return;
    }
    if (seq !== games.seq || document.getElementById("gamesModal").hidden) return;

    if (!list.length) {
        body.innerHTML = `<div class="loading-block">No MLB games on ${esc(dayLabel(date))}.</div>`;
        findNearbyGameDay(date, seq);
        return;
    }

    body.innerHTML = `<div class="games-grid">${list.map(gameCardHTML).join("")}</div>`;

    // Live games refresh themselves every 30 seconds while the window is open
    if (list.some(g => g.status?.abstractGameState === "Live")) {
        games.timer = setTimeout(() => {
            if (!document.getElementById("gamesModal").hidden) loadGames({ quiet: true });
        }, 30000);
    }
}

async function findNearbyGameDay(date, seq) {
    try {
        const [next, prev] = await Promise.all([
            fetchJSON(`${MLB_API}/schedule?sportId=1&startDate=${addDays(date, 1)}&endDate=${addDays(date, 60)}`),
            fetchJSON(`${MLB_API}/schedule?sportId=1&startDate=${addDays(date, -60)}&endDate=${addDays(date, -1)}`)
        ]);
        if (seq !== games.seq) return;
        const nextDay = next.dates?.find(d => d.games?.length)?.date;
        const prevDates = (prev.dates || []).filter(d => d.games?.length);
        const prevDay = prevDates[prevDates.length - 1]?.date;
        const buttons = [
            prevDay && `<button class="ghost-btn" data-jump="${prevDay}">‹ Last games: ${esc(shortDate(prevDay))}</button>`,
            nextDay && `<button class="ghost-btn" data-jump="${nextDay}">Next games: ${esc(shortDate(nextDay))} ›</button>`
        ].filter(Boolean).join("");
        if (buttons) {
            document.getElementById("gamesBody").insertAdjacentHTML("beforeend", `<div class="jump-row">${buttons}</div>`);
        }
    } catch { /* the "no games" message is enough */ }
}

function gameStatus(g) {
    const s = g.status || {};
    const ls = g.linescore || {};
    if (s.abstractGameState === "Final") {
        const extra = ls.currentInning && ls.scheduledInnings && ls.currentInning !== ls.scheduledInnings ? `/${ls.currentInning}` : "";
        return { text: s.detailedState === "Final" ? `Final${extra}` : s.detailedState, live: false, final: true };
    }
    if (s.abstractGameState === "Live") {
        if (s.detailedState !== "In Progress") return { text: s.detailedState, live: true };
        const half = ls.inningHalf === "Top" ? "Top" : ls.inningHalf === "Bottom" ? "Bot" : (ls.inningState || "");
        return { text: `${half} ${ls.currentInningOrdinal || ""}`.trim(), live: true };
    }
    if (s.startTimeTBD) return { text: "Time TBD" };
    if (/Postponed|Suspended|Cancelled/i.test(s.detailedState)) return { text: s.detailedState };
    return { text: gameTime(g.gameDate) };
}

function gameCardHTML(g) {
    const st = gameStatus(g);
    const started = st.live || st.final;
    const side = key => {
        const t = g.teams[key];
        const team = t.team;
        const rec = t.leagueRecord;
        const winner = st.final && t.isWinner;
        const known = teamById(team.id);
        return `<div class="game-team ${winner ? "winner" : ""}">
            <img src="${logoUrl(team.id)}" alt="" class="game-logo" loading="lazy">
            ${known ? `<button class="team-link" data-open-team="${team.id}">${esc(team.name)}</button>` : `<span>${esc(team.name)}</span>`}
            <span class="game-rec">${rec && g.gameType === "R" ? `${rec.wins}-${rec.losses}` : ""}</span>
            <span class="game-score">${started ? (t.score ?? 0) : ""}</span>
        </div>`;
    };
    const series = g.gameType !== "R" && g.seriesStatus
        ? `<span class="game-series">${esc(g.seriesStatus.shortDescription || g.description || "")}${g.seriesStatus.result ? ` · ${esc(g.seriesStatus.result)}` : ""}</span>`
        : "";
    let foot = "";
    if (st.final && g.decisions) {
        const d = g.decisions;
        foot = [d.winner && `W: ${d.winner.fullName}`, d.loser && `L: ${d.loser.fullName}`, d.save && `SV: ${d.save.fullName}`]
            .filter(Boolean).map(esc).join(" · ");
    } else if (!started) {
        const pp = k => g.teams[k].probablePitcher?.fullName || "TBD";
        foot = `${esc(abbrFor(g.teams.away.team))}: ${esc(pp("away"))} · ${esc(abbrFor(g.teams.home.team))}: ${esc(pp("home"))}`;
    }
    return `<article class="game-card ${st.live ? "is-live" : ""}">
        <header class="game-head">
            <span class="game-status">${st.live ? '<span class="live-dot" aria-hidden="true"></span>' : ""}${esc(st.text)}</span>
            ${series}
        </header>
        ${side("away")}
        ${side("home")}
        ${foot ? `<footer class="game-foot">${foot}</footer>` : ""}
        ${g.venue?.name ? `<p class="game-venue">${esc(g.venue.name)}</p>` : ""}
    </article>`;
}


// =========================
// LEAGUE LEADERS
// =========================
const LEADER_CATS = {
    hitting: [
        { key: "homeRuns", label: "Home runs" },
        { key: "battingAverage", label: "Batting avg" },
        { key: "runsBattedIn", label: "RBI" },
        { key: "onBasePlusSlugging", label: "OPS" },
        { key: "hits", label: "Hits" },
        { key: "stolenBases", label: "Stolen bases" }
    ],
    pitching: [
        { key: "earnedRunAverage", label: "ERA" },
        { key: "strikeouts", label: "Strikeouts" },
        { key: "wins", label: "Wins" },
        { key: "saves", label: "Saves" },
        { key: "walksAndHitsPerInningPitched", label: "WHIP" },
        { key: "inningsPitched", label: "Innings" }
    ]
};

const leaders = { group: "hitting", cat: "homeRuns", league: "", season: null, seq: 0 };

function openLeaders(opener) {
    if (!leaders.season) leaders.season = state.season;
    openModal("leadersModal", opener);
    renderLeaderControls();
    loadLeaders();
}

function setupLeaders() {
    document.getElementById("closeLeaders").addEventListener("click", () => closeModal("leadersModal"));
    const seasonSel = document.getElementById("leadersSeason");
    let opts = "";
    for (let y = SEASON; y >= FIRST_SEASON; y--) opts += `<option value="${y}">${y}</option>`;
    seasonSel.innerHTML = opts;
    seasonSel.addEventListener("change", () => { leaders.season = Number(seasonSel.value); loadLeaders(); });
    document.getElementById("leadersLeague").addEventListener("change", e => { leaders.league = e.target.value; loadLeaders(); });

    document.getElementById("leadersControls").addEventListener("click", e => {
        const g = e.target.closest("[data-lead-group]");
        if (g && g.dataset.leadGroup !== leaders.group) {
            leaders.group = g.dataset.leadGroup;
            leaders.cat = LEADER_CATS[leaders.group][0].key;
            renderLeaderControls();
            loadLeaders();
            return;
        }
        const c = e.target.closest("[data-lead-cat]");
        if (c) { leaders.cat = c.dataset.leadCat; renderLeaderControls(); loadLeaders(); }
    });
    document.getElementById("leadersBody").addEventListener("click", e => {
        const row = e.target.closest("[data-player-id]");
        if (row) openPlayerById(Number(row.dataset.playerId), row, leaders.season);
    });
}

function renderLeaderControls() {
    document.getElementById("leadersSeason").value = String(leaders.season);
    document.querySelectorAll("[data-lead-group]").forEach(b => {
        b.classList.toggle("active", b.dataset.leadGroup === leaders.group);
        b.setAttribute("aria-pressed", b.dataset.leadGroup === leaders.group);
    });
    document.getElementById("leaderCats").innerHTML = LEADER_CATS[leaders.group].map(c =>
        `<button class="chip ${c.key === leaders.cat ? "active" : ""}" data-lead-cat="${c.key}" aria-pressed="${c.key === leaders.cat}">${c.label}</button>`
    ).join("");
}

async function loadLeaders() {
    const seq = ++leaders.seq;
    const body = document.getElementById("leadersBody");
    body.innerHTML = `<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading leaders…</div>`;
    const cat = LEADER_CATS[leaders.group].find(c => c.key === leaders.cat);
    try {
        const data = await fetchJSON(`${MLB_API}/stats/leaders?leaderCategories=${leaders.cat}&statGroup=${leaders.group}` +
            `&season=${leaders.season}&sportId=1&limit=10${leaders.league ? `&leagueId=${leaders.league}` : ""}`);
        if (seq !== leaders.seq) return;
        const list = data.leagueLeaders?.[0]?.leaders || [];
        if (!list.length) {
            body.innerHTML = `<p class="empty-hint leaders-empty">No ${esc(cat.label.toLowerCase())} leaders for ${leaders.season}.</p>`;
            return;
        }
        body.innerHTML = `<ol class="leader-list">${list.map(x => `
            <li>
                <button class="leader-row" data-player-id="${x.person.id}">
                    <span class="leader-rank">${x.rank}</span>
                    <img src="${headshotUrl(x.person.id, 80)}" alt="" loading="lazy">
                    <span class="leader-name">
                        <strong>${esc(x.person.fullName)}</strong>
                        <small>${esc(x.team ? (state.teamAbbr[x.team.id] || x.team.name) : "")}</small>
                    </span>
                    <span class="leader-value">${esc(x.value)}</span>
                </button>
            </li>`).join("")}</ol>
            <p class="table-hint">${esc(cat.label)} · ${leaders.season} · ${leaders.league === "103" ? "American League" : leaders.league === "104" ? "National League" : "All of MLB"}. Click a player for details.</p>`;
    } catch (err) {
        if (seq !== leaders.seq) return;
        console.error("Leaders error:", err);
        body.innerHTML = `<p class="empty-hint leaders-empty">Leaders couldn't be loaded. Check your connection and try again.</p>`;
    }
}


// =========================
// FIND A PLAYER
// =========================
const find = { timer: null, seq: 0, results: [] };

function openFindPlayer(opener) {
    openModal("findModal", opener);
    const input = document.getElementById("findSearch");
    input.focus();
    if (!input.value.trim()) renderRecentPlayers();
}

function setupFindPlayer() {
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
        const data = await fetchJSON(`${MLB_API}/people/search?names=${encodeURIComponent(q)}&sportIds=1&limit=25`);
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

function rememberPlayer(p) {
    const recent = readJSON("recentPlayers", []).filter(x => x.id !== p.id);
    recent.unshift({ id: p.id, name: p.name, note: [p.posName, p.teamName].filter(Boolean).join(" · ") });
    writeJSON("recentPlayers", recent.slice(0, 6));
}

function renderRecentPlayers() {
    find.seq++;
    const recent = readJSON("recentPlayers", []);
    document.getElementById("findResults").innerHTML = recent.length
        ? `<li class="result-note">Recently viewed</li>` + recent.map(x => playerResultHTML(x, x.note || "")).join("")
        : `<li class="result-note">Type at least 2 letters. Any MLB player, past or present.</li>`;
}

// Open the player window for anyone (leaders, search, shared links)
async function openPlayerById(id, opener, season = state.season) {
    if (opener) { opener.setAttribute("aria-busy", "true"); opener.classList.add("is-loading"); }
    try {
        const data = await fetchJSON(`${MLB_API}/people/${id}?hydrate=currentTeam,` +
            `stats(group=[hitting,pitching],type=[season,career,yearByYear],season=${season})`);
        const person = data.people?.[0];
        if (!person) throw new Error("Player not found");
        state.careerCache[id] = parseCareer(person);
        const seasonStat = group => {
            const splits = person.stats?.find(s => s.group?.displayName === group && s.type?.displayName === "season")?.splits || [];
            return (splits.find(sp => !sp.team) || splits[0])?.stat || null;
        };
        const groups = groupsFor(person);
        showPlayer({
            id,
            name: person.fullName,
            lastName: person.lastName,
            number: person.primaryNumber || "",
            pos: person.primaryPosition?.abbreviation || "",
            posName: person.primaryPosition?.name || "",
            person,
            teamName: person.currentTeam?.name || "",
            hitting: seasonStat("hitting"),
            pitching: seasonStat("pitching"),
            inHitters: groups.includes("hitting"),
            inPitchers: groups.includes("pitching"),
            fromRoster: false,
            season // the season tab, game log and splits use this year
        }, opener);
    } catch (err) {
        console.error("Player load error:", err);
        showToast("That player couldn't be loaded. Try again in a moment.");
    } finally {
        if (opener) { opener.removeAttribute("aria-busy"); opener.classList.remove("is-loading"); }
    }
}


// =========================
// PLAYER WINDOW: GAME LOG + SPLITS
// =========================
const statCache = {};

async function fetchPlayerStats(p, kind, group) {
    const season = p.season || state.season;
    const key = `${p.id}-${season}-${kind}-${group}`;
    if (!statCache[key]) {
        const url = kind === "gameLog"
            ? `${MLB_API}/people/${p.id}/stats?stats=gameLog&group=${group}&season=${season}`
            : `${MLB_API}/people/${p.id}/stats?stats=statSplits&group=${group}&season=${season}&sitCodes=h,a,d,n,vl,vr`;
        const data = await fetchJSON(url);
        statCache[key] = data.stats?.[0]?.splits || [];
    }
    return statCache[key];
}

async function renderStatTab(p, box, groups, kind, build) {
    box.innerHTML = `<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading…</div>`;
    const view = state.playerView;
    try {
        const parts = await Promise.all(groups.map(g => fetchPlayerStats(p, kind, g).then(rows => [g, rows])));
        if (currentPlayer !== p || state.playerView !== view) return;
        const html = parts.map(([g, rows]) => build(g, rows)).join("");
        box.innerHTML = html || `<p class="empty-hint">No ${p.season || state.season} ${kind === "gameLog" ? "games" : "splits"} for this player.</p>`;
    } catch (err) {
        console.error(err);
        if (currentPlayer === p) box.innerHTML = `<p class="empty-hint">These stats couldn't be loaded. Try again in a moment.</p>`;
    }
}

function renderGameLog(p, box, groups) {
    renderStatTab(p, box, groups, "gameLog", (group, rows) => {
        if (!rows.length) return "";
        const last = rows.slice(-15).reverse();
        const hit = group === "hitting";
        const cols = hit
            ? [["AB", "atBats"], ["H", "hits"], ["HR", "homeRuns"], ["RBI", "rbi"], ["BB", "baseOnBalls"], ["SO", "strikeOuts"], ["AVG", "avg"]]
            : [["IP", "inningsPitched"], ["H", "hits"], ["ER", "earnedRuns"], ["BB", "baseOnBalls"], ["SO", "strikeOuts"], ["ERA", "era"]];
        const head = `<tr><th class="name-col"><span class="th-text">Date</span></th><th><span class="th-text">Opp</span></th>
            <th><span class="th-text">${hit ? "Result" : "Dec"}</span></th>${cols.map(([l]) => `<th><span class="th-text">${l}</span></th>`).join("")}</tr>`;
        const body = last.map(r => {
            const opp = `${r.isHome ? "vs" : "@"} ${esc(abbrFor(r.opponent))}`;
            const res = hit
                ? (r.isWin === true ? "W" : r.isWin === false ? "L" : "—")
                : (r.stat.wins ? "W" : r.stat.losses ? "L" : r.stat.saves ? "SV" : r.stat.holds ? "HLD" : "—");
            return `<tr><td class="name-col">${esc(shortDate(r.date))}</td><td class="team-td">${opp}</td><td>${res}</td>${
                cols.map(([, k]) => `<td>${esc(r.stat[k] ?? "—")}</td>`).join("")}</tr>`;
        }).join("");
        return `<h3 class="stats-title">${hit ? "Hitting" : "Pitching"} · last ${last.length} games <small>${p.season || state.season}</small></h3>
            <div class="table-scroll"><table class="stats-table year-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>
            ${hit ? '<p class="table-hint">AVG is the season average after that game.</p>' : '<p class="table-hint">ERA is the season ERA after that game.</p>'}`;
    });
}

function renderSplits(p, box, groups) {
    renderStatTab(p, box, groups, "statSplits", (group, rows) => {
        if (!rows.length) return "";
        const hit = group === "hitting";
        const cols = hit
            ? [["PA", "plateAppearances"], ["AVG", "avg"], ["HR", "homeRuns"], ["RBI", "rbi"], ["OBP", "obp"], ["OPS", "ops"]]
            : [["IP", "inningsPitched"], ["ERA", "era"], ["Opp AVG", "avg"], ["SO", "strikeOuts"], ["BB", "baseOnBalls"], ["WHIP", "whip"]];
        const label = r => {
            const d = r.split?.description || r.split?.code || "";
            if (!hit && r.split?.code === "vl") return "vs Left-handed batters";
            if (!hit && r.split?.code === "vr") return "vs Right-handed batters";
            if (hit && r.split?.code === "vl") return "vs Left-handed pitchers";
            if (hit && r.split?.code === "vr") return "vs Right-handed pitchers";
            return d;
        };
        const head = `<tr><th class="name-col"><span class="th-text">Split</span></th>${cols.map(([l]) => `<th><span class="th-text">${l}</span></th>`).join("")}</tr>`;
        const body = rows.map(r => `<tr><td class="name-col">${esc(label(r))}</td>${
            cols.map(([, k]) => `<td>${esc(r.stat[k] ?? "—")}</td>`).join("")}</tr>`).join("");
        return `<h3 class="stats-title">${hit ? "Hitting" : "Pitching"} splits <small>${p.season || state.season}</small></h3>
            <div class="table-scroll"><table class="stats-table year-table splits-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
    });
}


// =========================
// LINE CHART (career + compare)
// =========================
const CHART_STATS = {
    hitting: [["homeRuns", "HR"], ["avg", "AVG"], ["ops", "OPS"], ["rbi", "RBI"], ["hits", "H"], ["stolenBases", "SB"]],
    pitching: [["era", "ERA"], ["strikeOuts", "SO"], ["wins", "W"], ["whip", "WHIP"], ["inningsPitched", "IP"], ["saves", "SV"]]
};

function formatStat(key, v) {
    if (v === null || v === undefined || Number.isNaN(v)) return "—";
    if (["avg", "obp", "slg", "ops"].includes(key)) return v >= 1 ? v.toFixed(3) : v.toFixed(3).replace(/^0/, "");
    if (["era", "whip"].includes(key)) return v.toFixed(2);
    if (key === "inningsPitched") return v.toFixed(1);
    return String(Math.round(v));
}

// Innings like "45.2" mean 45 and 2/3 innings
function statValue(key, raw) {
    if (raw === undefined || raw === null) return null;
    if (key === "inningsPitched") {
        const [whole, part] = String(raw).split(".");
        return Number(whole) + (Number(part || 0) / 3);
    }
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
}

function niceTicks(min, max, count = 4) {
    if (min === max) { min = min * 0.9; max = max * 1.1 || 1; }
    const span = max - min;
    const step0 = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= count) || 10 * mag;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
    return ticks;
}

// series: [{ id, name, color, points: [{ x: season, y: number }] }]
function drawLineChart(container, series, statKey, statLabel) {
    const all = series.flatMap(s => s.points);
    if (!all.length) { container.innerHTML = `<p class="empty-hint">No data to chart.</p>`; return; }
    const years = [...new Set(all.map(p => p.x))].sort((a, b) => a - b);
    const minX = years[0], maxX = years[years.length - 1];
    const ys = all.map(p => p.y);
    const ticks = niceTicks(Math.min(0, ...ys) === 0 && !["era", "whip", "avg", "ops"].includes(statKey) ? 0 : Math.min(...ys), Math.max(...ys));
    const minY = ticks[0], maxY = ticks[ticks.length - 1];

    const W = Math.max(320, container.clientWidth || 600);
    const multi = series.length > 1;
    const H = 230;
    const m = { top: 14, right: multi ? 110 : 18, bottom: 28, left: 44 };
    const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
    const sx = x => m.left + (maxX === minX ? iw / 2 : ((x - minX) / (maxX - minX)) * iw);
    const sy = y => m.top + ih - ((y - minY) / (maxY - minY || 1)) * ih;

    // x labels: thin out so they never collide
    const every = Math.max(1, Math.ceil(years.length / Math.max(2, Math.floor(iw / 48))));
    const xLabels = years.filter((y, i) => i % every === 0);
    // Always show the latest year, dropping the label before it if they'd overlap
    const lastYear = years[years.length - 1];
    if (xLabels[xLabels.length - 1] !== lastYear) {
        if (sx(lastYear) - sx(xLabels[xLabels.length - 1]) < 40) xLabels.pop();
        xLabels.push(lastYear);
    }

    const grid = ticks.map(t => `<line x1="${m.left}" x2="${m.left + iw}" y1="${sy(t)}" y2="${sy(t)}" class="grid"/>
        <text x="${m.left - 8}" y="${sy(t) + 4}" class="axis" text-anchor="end">${formatStat(statKey, t)}</text>`).join("");
    const xAxis = xLabels.map(y => `<text x="${sx(y)}" y="${H - 8}" class="axis" text-anchor="middle">${y}</text>`).join("");

    // Lines break across seasons a player missed
    const paths = series.map(s => {
        const pts = [...s.points].sort((a, b) => a.x - b.x);
        let d = "";
        pts.forEach((p, i) => {
            const gap = i > 0 && p.x - pts[i - 1].x > 1;
            d += `${i === 0 || gap ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`;
        });
        const dots = pts.map(p => `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="4" style="fill:${s.color}" class="dot"/>`).join("");
        const end = pts[pts.length - 1];
        const label = multi && end
            ? `<text x="${sx(end.x) + 8}" y="${sy(end.y) + 4}" class="end-label">${esc(s.name.split(" ").slice(-1)[0])}</text>`
            : "";
        return `<path d="${d}" style="fill:none;stroke:${s.color};stroke-width:2;stroke-linejoin:round;stroke-linecap:round"/>${dots}${label}`;
    }).join("");

    const legend = multi
        ? `<div class="chart-legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div>`
        : "";

    container.innerHTML = `${legend}
        <div class="chart-wrap">
            <svg class="line-chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"
                 aria-label="${esc(statLabel)} by season${multi ? " for " + series.map(s => s.name).join(", ") : ""}">
                ${grid}${xAxis}
                <line class="crosshair" x1="0" x2="0" y1="${m.top}" y2="${m.top + ih}" visibility="hidden"/>
                ${paths}
                <rect class="hit" x="${m.left}" y="${m.top}" width="${iw}" height="${ih}" fill="transparent"/>
            </svg>
            <div class="chart-tip" hidden></div>
        </div>`;

    // Hover: crosshair + tooltip with every series' value that season
    const svg = container.querySelector("svg");
    const tip = container.querySelector(".chart-tip");
    const cross = svg.querySelector(".crosshair");
    const hit = svg.querySelector(".hit");
    const showAt = clientX => {
        const box = svg.getBoundingClientRect();
        const x = (clientX - box.left) * (W / box.width);
        const year = years.reduce((best, y) => Math.abs(sx(y) - x) < Math.abs(sx(best) - x) ? y : best, years[0]);
        cross.setAttribute("x1", sx(year));
        cross.setAttribute("x2", sx(year));
        cross.setAttribute("visibility", "visible");
        const rows = series.map(s => {
            const pt = s.points.find(p => p.x === year);
            return `<div>${multi ? `<i style="background:${s.color}"></i>${esc(s.name)}: ` : ""}<strong>${pt ? formatStat(statKey, pt.y) : "—"}</strong></div>`;
        }).join("");
        tip.innerHTML = `<div class="tip-year">${year} ${esc(statLabel)}</div>${rows}`;
        tip.hidden = false;
        const left = (sx(year) / W) * box.width;
        tip.style.left = `${Math.min(Math.max(left, 70), box.width - 70)}px`;
    };
    hit.addEventListener("pointermove", e => showAt(e.clientX));
    hit.addEventListener("pointerdown", e => showAt(e.clientX));
    hit.addEventListener("pointerleave", () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); });
}

function chartChips(group, active) {
    return `<div class="chip-row" role="group" aria-label="Stat to chart">${CHART_STATS[group].map(([k, l]) =>
        `<button class="chip ${k === active ? "active" : ""}" data-chart-stat="${k}" aria-pressed="${k === active}">${l}</button>`).join("")}</div>`;
}

const chartChoice = { hitting: "homeRuns", pitching: "era" };

function renderCareerChart(slot, career, group) {
    const data = career?.[group];
    if (!data || data.years.length < 2) { slot.remove(); return; }
    const draw = () => {
        const key = chartChoice[group];
        const label = CHART_STATS[group].find(([k]) => k === key)[1];
        slot.innerHTML = `${chartChips(group, key)}<div class="chart-area"></div>`;
        const points = data.years.map(y => ({ x: y.season, y: statValue(key, y.stat?.[key]) })).filter(p => p.y !== null);
        drawLineChart(slot.querySelector(".chart-area"), [{ name: label, color: "var(--accent)", points }], key, label);
    };
    slot.onclick = e => {
        const chip = e.target.closest("[data-chart-stat]");
        if (chip) { chartChoice[group] = chip.dataset.chartStat; draw(); }
    };
    draw();
}

// Compare: each player keeps the same color while they're in the list
function compareSlot(id) {
    id = Number(id);
    const slots = readJSON("compareSlots", {});
    const others = compare.ids.filter(x => x !== id);
    const used = new Set(others.map(x => slots[x]).filter(Boolean));
    if (!slots[id] || used.has(slots[id])) {
        slots[id] = [1, 2, 3, 4].find(n => !used.has(n)) || 1;
        // forget players no longer in the list
        Object.keys(slots).forEach(k => { if (!compare.ids.includes(Number(k))) delete slots[k]; });
        writeJSON("compareSlots", slots);
    }
    return slots[id];
}

function renderCompareChart(body, careers, group) {
    const key = CHART_STATS[group].some(([k]) => k === chartChoice[group]) ? chartChoice[group] : CHART_STATS[group][0][0];
    const label = CHART_STATS[group].find(([k]) => k === key)[1];
    const series = careers.map(c => ({
        id: c.person.id,
        name: c.person.fullName,
        color: `var(--series-${compareSlot(c.person.id)})`,
        points: (c[group]?.years || []).map(y => ({ x: y.season, y: statValue(key, y.stat?.[key]) })).filter(p => p.y !== null)
    })).filter(s => s.points.length);

    body.innerHTML = `${chartChips(group, key)}<div class="chart-area"></div>
        <p class="table-hint">${label} for each season. Hover or tap the chart to see exact numbers; switch to Table for career totals.</p>`;
    body.onclick = e => {
        const chip = e.target.closest("[data-chart-stat]");
        if (chip) { chartChoice[group] = chip.dataset.chartStat; renderCompare(); }
    };
    if (!series.length) {
        body.querySelector(".chart-area").innerHTML = `<p class="empty-hint">None of these players have MLB ${group} stats.</p>`;
        return;
    }
    drawLineChart(body.querySelector(".chart-area"), series, key, label);
}


// =========================
// TEAM WINDOW: ROSTER | GAMES
// =========================
function resetTeamView() {
    state.teamView = "roster";
    updateTeamViewTabs();
}

function updateTeamViewTabs() {
    document.querySelectorAll("#teamViewTabs [data-team-view]").forEach(b => {
        b.classList.toggle("active", b.dataset.teamView === state.teamView);
        b.setAttribute("aria-pressed", b.dataset.teamView === state.teamView);
    });
    document.getElementById("rosterTabs").hidden = state.teamView === "games";
}

function setupTeamView() {
    document.getElementById("teamViewTabs").addEventListener("click", e => {
        const btn = e.target.closest("[data-team-view]");
        if (!btn || btn.dataset.teamView === state.teamView) return;
        state.teamView = btn.dataset.teamView;
        updateTeamViewTabs();
        if (state.teamView === "games") renderTeamGames(state.currentTeam);
        else if (state.rosterCache[rosterKey(state.currentTeam.id)]) renderRoster();
        else openRosterModal(state.currentTeam);
    });
    document.getElementById("rosterBody").addEventListener("click", e => {
        const t = e.target.closest("[data-open-team]");
        if (t && teamById(t.dataset.openTeam)) {
            openRosterModal(teamById(t.dataset.openTeam), t);
        }
    });
}

const teamGamesCache = {};

async function renderTeamGames(team) {
    const body = document.getElementById("rosterBody");
    const key = `${state.season}-${team.id}`;
    body.innerHTML = `<div class="loading-block"><span class="spinner" aria-hidden="true"></span> Loading games…</div>`;
    try {
        if (!teamGamesCache[key]) {
            const data = await fetchJSON(`${MLB_API}/schedule?sportId=1&teamId=${team.id}&season=${state.season}` +
                `&gameType=R,F,D,L,W&hydrate=team,linescore`);
            teamGamesCache[key] = (data.dates || []).flatMap(d => d.games || []);
        }
    } catch (err) {
        console.error("Team schedule error:", err);
        if (state.currentTeam === team && state.teamView === "games") {
            body.innerHTML = `<p class="empty-hint">The schedule couldn't be loaded. Try again in a moment.</p>`;
        }
        return;
    }
    if (state.currentTeam !== team || state.teamView !== "games") return;

    const all = teamGamesCache[key];
    const done = all.filter(g => g.status?.abstractGameState === "Final" && g.status?.detailedState !== "Postponed");
    const live = all.filter(g => g.status?.abstractGameState === "Live");
    const upcoming = all.filter(g => g.status?.abstractGameState === "Preview" && !/Postponed|Cancelled/.test(g.status?.detailedState));

    const row = g => {
        const home = g.teams.home.team.id === team.id;
        const us = home ? g.teams.home : g.teams.away;
        const them = home ? g.teams.away : g.teams.home;
        const opp = them.team;
        const oppKnown = teamById(opp.id);
        const st = gameStatus(g);
        let result;
        if (st.final) result = `<span class="result ${us.isWinner ? "win" : "loss"}">${us.isWinner ? "W" : "L"}</span> ${us.score}–${them.score}`;
        else if (st.live) result = `<span class="live-dot" aria-hidden="true"></span>${esc(st.text)} · ${us.score ?? 0}–${them.score ?? 0}`;
        else result = esc(st.text);
        const tag = g.gameType !== "R" ? `<small class="post-tag">${esc(g.seriesDescription || "Postseason")}${g.seriesGameNumber ? ` G${g.seriesGameNumber}` : ""}</small>` : "";
        return `<tr>
            <td class="name-col">${esc(shortDate(g.officialDate || g.gameDate.slice(0, 10)))}</td>
            <td class="opp-cell">${home ? "vs" : "@"}
                <img src="${logoUrl(opp.id)}" alt="" class="mini-logo" loading="lazy">
                ${oppKnown ? `<button class="team-link" data-open-team="${opp.id}">${esc(opp.name)}</button>` : esc(opp.name)} ${tag}</td>
            <td class="result-cell">${result}</td>
        </tr>`;
    };
    const table = (title, list) => list.length ? `
        <h3 class="stats-title">${title}</h3>
        <div class="table-scroll"><table class="stats-table games-table"><tbody>${list.map(row).join("")}</tbody></table></div>` : "";

    const recent = done.slice(-10).reverse();
    const last10 = recent.length ? (() => {
        const w = recent.filter(g => (g.teams.home.team.id === team.id ? g.teams.home : g.teams.away).isWinner).length;
        return ` <small>${w}–${recent.length - w}</small>`;
    })() : "";

    const html = table("Live now", live) + table(`Last ${recent.length} games${last10}`, recent) + table("Coming up", upcoming.slice(0, 5));
    body.innerHTML = html || `<p class="empty-hint">No ${state.season} games found for the ${esc(team.name)}.</p>`;
}


// =========================
// SHARE LINKS
// =========================
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

function setupShareButtons() {
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
function applyCompareParams() {
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

// Runs after standings load (see loadData in script.js)
let playerParamHandled = false;
function afterDataLoaded(ok) {
    if (ok) {
        state.lastUpdated = new Date();
        updateUpdatedLine();
    }
    if (!playerParamHandled) {
        playerParamHandled = true;
        const pid = Number(new URLSearchParams(location.search).get("player"));
        if (pid) openPlayerById(pid);
    }
}


// =========================
// LAST UPDATED + REFRESH
// =========================
function updateUpdatedLine() {
    const el = document.getElementById("updatedText");
    if (!state.lastUpdated) return;
    el.textContent = `Updated ${state.lastUpdated.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    document.getElementById("updatedLine").hidden = false;
}

function setupRefresh() {
    document.getElementById("refreshBtn").addEventListener("click", async () => {
        const btn = document.getElementById("refreshBtn");
        btn.disabled = true;
        // Fresh rosters and schedules for this season next time they're opened
        Object.keys(state.rosterCache).forEach(k => { if (k.startsWith(`${state.season}-`)) delete state.rosterCache[k]; });
        Object.keys(teamGamesCache).forEach(k => { if (k.startsWith(`${state.season}-`)) delete teamGamesCache[k]; });
        await loadData();
        btn.disabled = false;
        showToast("Standings refreshed");
    });
}


// =========================
// INSTALL AS AN APP (PWA)
// =========================
let installPrompt = null;

function setupInstall() {
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
        navigator.serviceWorker.register("sw.js").catch(err => console.warn("Service worker not registered:", err));
    }
    const btn = document.getElementById("installBtn");
    window.addEventListener("beforeinstallprompt", e => {
        e.preventDefault();
        installPrompt = e;
        btn.hidden = false;
    });
    btn.addEventListener("click", async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
        btn.hidden = true;
    });
    window.addEventListener("appinstalled", () => { btn.hidden = true; showToast("Installed. Look for MLB Stats on your home screen."); });
}
