// Tests for: Today's games, League leaders, Find a player, game log, splits, charts,
// team Games tab, share links / deep links, refresh, menu.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('path');
const APP = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'screenshots');
require('fs').mkdirSync(OUT, { recursive: true });

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = iso(new Date());
const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

const divs = [
  [201, 'American League East', [[139,'Tampa Bay Rays','TB'],[147,'New York Yankees','NYY'],[111,'Boston Red Sox','BOS'],[110,'Baltimore Orioles','BAL'],[141,'Toronto Blue Jays','TOR']]],
  [202, 'American League Central', [[114,'Cleveland Guardians','CLE'],[145,'Chicago White Sox','CWS'],[142,'Minnesota Twins','MIN'],[116,'Detroit Tigers','DET'],[118,'Kansas City Royals','KC']]],
  [200, 'American League West', [[117,'Houston Astros','HOU'],[140,'Texas Rangers','TEX'],[136,'Seattle Mariners','SEA'],[133,'Athletics','ATH'],[108,'Los Angeles Angels','LAA']]],
  [204, 'National League East', [[144,'Atlanta Braves','ATL'],[143,'Philadelphia Phillies','PHI'],[146,'Miami Marlins','MIA'],[120,'Washington Nationals','WSH'],[121,'New York Mets','NYM']]],
  [205, 'National League Central', [[158,'Milwaukee Brewers','MIL'],[112,'Chicago Cubs','CHC'],[134,'Pittsburgh Pirates','PIT'],[138,'St. Louis Cardinals','STL'],[113,'Cincinnati Reds','CIN']]],
  [203, 'National League West', [[119,'Los Angeles Dodgers','LAD'],[135,'San Diego Padres','SD'],[109,'Arizona Diamondbacks','AZ'],[137,'San Francisco Giants','SF'],[115,'Colorado Rockies','COL']]],
];
const T = {}; divs.forEach(([, , ts]) => ts.forEach(([id, name, abbr]) => { T[id] = { id, name, abbreviation: abbr }; }));
const standings = { records: divs.map(([id, name, teams]) => ({ division: { id, name }, teamRecords: teams.map(([tid], i) => ({
  team: T[tid], wins: 95 - i*5, losses: 67 + i*5, winningPercentage: '.5' + (80 - i*5), gamesBack: i ? `${i*5}.0` : '-', divisionRank: String(i+1),
  streak: { streakCode: 'W2' }, records: { splitRecords: [{ type: 'lastTen', wins: 6, losses: 4 }] } })) })) };
const apiTeams = { teams: divs.flatMap(([id, name, teams]) => teams.map(([tid]) => ({ ...T[tid], division: { id, name } }))) };

const game = (pk, away, home, opts = {}) => ({
  gamePk: pk, gameDate: opts.gameDate || `${TODAY}T23:05:00Z`, officialDate: opts.date || TODAY, gameType: opts.gameType || 'R',
  status: opts.status || { abstractGameState: 'Preview', detailedState: 'Scheduled' },
  seriesStatus: opts.series, description: opts.series?.shortDescription, seriesDescription: opts.seriesDescription, seriesGameNumber: opts.gameNumber,
  teams: {
    away: { team: T[away], score: opts.as, isWinner: opts.as > opts.hs, leagueRecord: { wins: 90, losses: 70 }, probablePitcher: opts.app && { fullName: opts.app } },
    home: { team: T[home], score: opts.hs, isWinner: opts.hs > opts.as, leagueRecord: { wins: 88, losses: 72 }, probablePitcher: opts.hpp && { fullName: opts.hpp } }
  },
  linescore: opts.ls || {}, decisions: opts.dec, venue: { name: opts.venue || 'Some Park' }
});
const todayGames = [
  game(1, 139, 158, { gameType: 'W', series: { shortDescription: 'World Series Game 3', result: 'MIL leads 2-0' }, status: { abstractGameState: 'Live', detailedState: 'In Progress' }, as: 2, hs: 3, ls: { currentInning: 5, currentInningOrdinal: '5th', inningHalf: 'Bottom' }, venue: 'American Family Field' }),
  game(2, 147, 111, { status: { abstractGameState: 'Final', detailedState: 'Final' }, as: 7, hs: 4, ls: { currentInning: 10, scheduledInnings: 9 }, dec: { winner: { fullName: 'Gerrit Cole' }, loser: { fullName: 'Brayan Bello' }, save: { fullName: 'Luke Weaver' } } }),
  game(3, 112, 138, { app: 'Shota Imanaga', hpp: 'Sonny Gray' }),
];
const teamSchedule = Array.from({ length: 16 }, (_, i) => {
  const d = plus(i - 12);
  const final = i < 12;
  return game(100 + i, i % 2 ? 158 : 112, i % 2 ? 112 : 158, { date: d, gameDate: `${d}T23:05:00Z`,
    status: final ? { abstractGameState: 'Final', detailedState: 'Final' } : { abstractGameState: 'Preview', detailedState: 'Scheduled' },
    as: final ? (i % 3) + 2 : undefined, hs: final ? (i % 4) + 1 : undefined,
    gameType: i >= 10 ? 'W' : 'R', seriesDescription: i >= 10 ? 'World Series' : undefined, gameNumber: i >= 10 ? i - 9 : undefined });
});

const leadersFor = (cat, group, league) => ({ leagueLeaders: [{ leaderCategory: cat, statGroup: group, leaders: Array.from({ length: 10 }, (_, i) => ({
  rank: i + 1, value: cat === 'earnedRunAverage' ? (1.8 + i * 0.12).toFixed(2) : String(45 - i), person: { id: 592450 + i, fullName: `${league === '103' ? 'AL' : 'MLB'} Player ${i + 1}` }, team: T[i % 2 ? 147 : 158] })) }] });

const H = (type, o, season) => ({ type: { displayName: type }, group: { displayName: 'hitting' }, splits: Array.isArray(o) ? o : [{ season, sport: { id: 1 }, team: T[147], stat: o }] });
const person = id => ({ id, fullName: id === 592450 ? 'Aaron Judge' : `Player ${id}`, lastName: 'Judge', primaryNumber: '99', currentAge: 34, height: `6' 7"`, weight: 282,
  batSide: { code: 'R' }, pitchHand: { code: 'R' }, birthCity: 'Linden', birthStateProvince: 'CA', mlbDebutDate: '2016-08-13',
  primaryPosition: { abbreviation: 'RF', name: 'Outfielder', type: 'Outfielder' }, currentTeam: T[147],
  stats: [
    H('season', { gamesPlayed: 140, avg: '.301', homeRuns: 44, rbi: 109, runs: 110, hits: 160, stolenBases: 9, baseOnBalls: 110, strikeOuts: 160, obp: '.430', slg: '.620', ops: '1.050' }, '2026'),
    H('career', { gamesPlayed: 1200, avg: '.290', homeRuns: 380, rbi: 900, hits: 1300, ops: '.990' }),
    H('yearByYear', Array.from({ length: 11 }, (_, i) => ({ season: String(2016 + i), sport: { id: 1 }, team: T[147],
      stat: { gamesPlayed: i === 4 ? 28 : 140, atBats: 500, hits: 140, homeRuns: [4, 52, 27, 27, 9, 39, 62, 37, 58, 53, 44][i], rbi: 100, stolenBases: 5, avg: '.2' + (70 + i * 3), obp: '.380', ops: '.9' + (i * 7 % 90) } })))
  ] });
const gameLog = { stats: [{ splits: Array.from({ length: 20 }, (_, i) => ({ date: plus(i - 25), isHome: i % 2 === 0, isWin: i % 3 !== 0, opponent: T[i % 2 ? 142 : 111],
  stat: { atBats: 4, hits: i % 3, homeRuns: i % 5 === 0 ? 1 : 0, rbi: i % 4, baseOnBalls: 1, strikeOuts: 1, avg: '.29' + (i % 10) } })) }] };
const splits = { stats: [{ splits: [['h', 'Home Games'], ['a', 'Away Games'], ['d', 'Day Games'], ['n', 'Night Games'], ['vl', 'vs Left'], ['vr', 'vs Right']].map(([code, d], i) => ({
  split: { code, description: d }, stat: { plateAppearances: 300 - i * 20, avg: '.2' + (50 + i * 5), homeRuns: 10 + i, rbi: 30, obp: '.400', ops: '.9' + i * 10 } })) }] };
const roster = { roster: [{ jerseyNumber: '99', position: { abbreviation: 'RF', type: 'Outfielder', name: 'Outfielder' }, person: { ...person(592450), stats: [H('season', { gamesPlayed: 140, atBats: 520, avg: '.301', homeRuns: 44, rbi: 109 }, '2026')] } }] };

const json = (route, body) => route.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } });
const svgLogo = id => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="hsl(${(Number(id) * 47) % 360},55%,38%)"/></svg>`;

const errors = [], results = {}, requests = [];
(async () => {
  const browser = await chromium.launch();

  async function newPage({ viewport = { width: 1280, height: 900 }, url = 'index.html', storage = {} } = {}) {
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.route('**/*', route => {
      const u = new URL(route.request().url());
      requests.push(u.href);
      const q = u.searchParams;
      if (/team-logos/.test(u.href)) return route.fulfill({ contentType: 'image/svg+xml', body: svgLogo((u.pathname.match(/(\d+)\.svg/) || [])[1] || 0) });
      if (/mlb-photos/.test(u.href)) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#c9d3cc"/><circle cx="20" cy="16" r="7" fill="#8a988f"/><rect x="9" y="26" width="22" height="14" rx="7" fill="#8a988f"/></svg>' });
      if (u.hostname.endsWith('onrender.com')) return json(route, apiTeams);
      if (u.hostname === 'app.test') return route.fulfill({ path: path.join(APP, u.pathname) });
      if (u.pathname.endsWith('/standings')) return json(route, standings);
      if (u.pathname.endsWith('/roster')) return json(route, roster);
      if (u.pathname.endsWith('/schedule')) {
        if (q.get('teamId')) return json(route, { dates: teamSchedule.map(g => ({ date: g.officialDate, games: [g] })) });
        if (q.get('startDate')) {
          const forward = q.get('startDate') > TODAY;
          return json(route, { dates: forward ? [{ date: plus(9), games: [todayGames[2]] }] : [{ date: plus(-3), games: [todayGames[1]] }] });
        }
        if (q.get('date') === TODAY) return json(route, { dates: [{ date: TODAY, games: todayGames }] });
        if (q.get('date') === plus(9)) return json(route, { dates: [{ date: plus(9), games: [todayGames[2]] }] });
        return json(route, { dates: [] });
      }
      if (u.pathname.endsWith('/stats/leaders')) return json(route, leadersFor(q.get('leaderCategories'), q.get('statGroup'), q.get('leagueId')));
      if (u.pathname.endsWith('/people/search')) return json(route, { people: [
        { id: 592450, fullName: 'Aaron Judge', primaryPosition: { abbreviation: 'RF' }, mlbDebutDate: '2016-08-13', active: true },
        { id: 1, fullName: 'Never Debuted', primaryPosition: { abbreviation: 'P' } }] });
      if (/\/people\/\d+\/stats/.test(u.pathname)) return json(route, q.get('stats') === 'gameLog' ? gameLog : splits);
      if (/\/people\/\d+$/.test(u.pathname)) return json(route, { people: [person(Number(u.pathname.split('/').pop()))] });
      if (u.pathname.includes('/people')) return json(route, { people: (q.get('personIds') || '592450').split(',').map(Number).map(id => {
        const p = person(id); if (id !== 592450) { p.fullName = 'Juan Soto'; p.stats[2].splits = p.stats[2].splits.slice(2).map(s => ({ ...s, stat: { ...s.stat, homeRuns: s.stat.homeRuns - 8 } })); } return p; }) });
      return route.fulfill({ status: 204, body: '' });
    });
    await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__copied = t; }, readText: async () => window.__copied }, configurable: true }); });
    await page.addInitScript(st => { if (!sessionStorage.getItem('i')) { localStorage.clear(); Object.entries(st).forEach(([k, v]) => localStorage.setItem(k, v)); sessionStorage.setItem('i', 1); } }, storage);
    await page.goto('http://app.test/' + url);
    await page.waitForSelector('.standings table');
    return { ctx, page };
  }
  const openFromMenu = async (page, id) => { await page.click('#menuBtn'); await page.waitForTimeout(150); await page.click('#' + id); };

  // ---------- Menu + Today's games ----------
  {
    const { ctx, page } = await newPage();
    await page.click('#menuBtn');
    await page.waitForTimeout(150);
    results.menuItems = await page.$$eval('#sideMenu .help-link', l => l.map(x => x.textContent.trim()));
    results.menuFocus = await page.evaluate(() => document.activeElement.id);
    await page.screenshot({ path: `${OUT}/menu.png` });
    await page.click('#gamesBtn');
    await page.waitForSelector('.game-card');
    results.gamesDate = await page.$eval('#gamesDate', e => e.textContent);
    results.gameCards = await page.$$eval('.game-card', cs => cs.map(c => [c.querySelector('.game-status').textContent.trim(), c.querySelector('.game-series')?.textContent || '', [...c.querySelectorAll('.game-score')].map(s => s.textContent).join('-'), c.querySelector('.game-foot')?.textContent.trim() || '']));
    results.liveRefreshScheduled = await page.evaluate(() => !!games.timer);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/games.png` });
    await page.click('#gamesNext');
    await page.waitForSelector('.jump-row button');
    results.emptyDay = await page.$eval('#gamesBody', e => e.textContent.replace(/\s+/g, ' ').trim());
    await page.click('.jump-row button:last-child');
    await page.waitForSelector('.game-card');
    results.jumpedTo = await page.$eval('#gamesDate', e => e.textContent);
    await page.click('#gamesToday');
    await page.waitForSelector('.game-card.is-live');
    // team in a game card opens that team, on top of the games window
    await page.click('.game-card [data-open-team="147"]');
    await page.waitForSelector('#rosterModal:not([hidden]) .stats-table');
    results.teamOverGames = await page.evaluate(() => [getComputedStyle(document.getElementById('rosterModal')).zIndex, getComputedStyle(document.getElementById('gamesModal')).zIndex]);
    await ctx.close();
  }

  // ---------- League leaders ----------
  {
    const { ctx, page } = await newPage();
    await openFromMenu(page, 'leadersBtn');
    await page.waitForSelector('.leader-row');
    results.leadersFirst = await page.$$eval('.leader-row', r => r.slice(0, 2).map(x => x.textContent.replace(/\s+/g, ' ').trim()));
    results.leaderChips = await page.$$eval('#leaderCats .chip', c => c.map(x => x.textContent));
    await page.click('[data-lead-group="pitching"]');
    await page.waitForFunction(() => document.querySelector('#leaderCats .chip.active')?.textContent === 'ERA' && document.querySelector('.leader-row'));
    await page.selectOption('#leadersLeague', '103');
    await page.waitForFunction(() => document.querySelector('.leader-row strong')?.textContent.startsWith('AL'));
    results.leadersReq = requests.filter(u => u.includes('/stats/leaders')).pop().replace('https://statsapi.mlb.com/api/v1', '');
    await page.selectOption('#leadersSeason', '1998');
    await page.waitForFunction(() => /1998/.test(document.querySelector('#leadersBody .table-hint')?.textContent || ''));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/leaders.png` });
    // click a leader -> player window for that season
    await page.click('.leader-row');
    await page.waitForSelector('#playerModal:not([hidden])');
    results.leaderPlayerTabs = await page.$$eval('#playerViewTabs .tab-btn', b => b.map(x => x.textContent));
    results.leaderPlayerBackHidden = await page.$eval('#backToRoster', b => b.hidden);
    await ctx.close();
  }

  // ---------- Find a player, game log, splits, chart ----------
  {
    const { ctx, page } = await newPage();
    await openFromMenu(page, 'findPlayerBtn');
    results.findEmpty = await page.$eval('#findResults', e => e.textContent.trim());
    await page.fill('#findSearch', 'judge');
    await page.waitForSelector('#findResults button[data-player-id]');
    results.findResults = await page.$$eval('#findResults button', b => b.map(x => x.querySelector('strong').textContent));
    await page.keyboard.press('Enter');
    await page.waitForSelector('#playerModal:not([hidden])');
    results.playerHeader = [await page.$eval('#playerName', e => e.textContent), await page.$eval('#playerTeam', e => e.textContent)];
    results.seasonTiles = await page.$$eval('#playerStats .stat-tile', t => t.length);
    // By year + chart
    await page.click('[data-view="years"]');
    await page.waitForSelector('.line-chart');
    results.chartPoints = await page.$$eval('.line-chart circle.dot', c => c.length);
    const box = await page.$eval('.line-chart', s => { const r = s.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
    await page.mouse.move(box[0] + box[2] * 0.62, box[1] + box[3] / 2);
    results.chartTip = await page.$eval('.chart-tip', t => t.hidden ? 'hidden' : t.textContent.replace(/\s+/g, ' ').trim());
    await page.screenshot({ path: `${OUT}/player-chart.png` });
    await page.click('[data-chart-stat="avg"]');
    results.chartAfterSwitch = await page.$eval('.line-chart', s => s.getAttribute('aria-label'));
    // Game log
    await page.click('[data-view="games"]');
    await page.waitForSelector('#playerStats .stats-table');
    results.gameLog = await page.$$eval('#playerStats tbody tr', r => [r.length, r[0].textContent.replace(/\s+/g, ' ').trim()]);
    await page.screenshot({ path: `${OUT}/player-gamelog.png` });
    // Splits
    await page.click('[data-view="splits"]');
    await page.waitForSelector('.splits-table');
    results.splits = await page.$$eval('.splits-table tbody tr td:first-child', t => t.map(x => x.textContent));
    // Copy link
    await page.click('#copyPlayerLink');
    results.playerLink = await page.evaluate(() => navigator.clipboard.readText());
    await page.keyboard.press('Escape');
    results.findStillOpenUnderneath = await page.$eval('#findModal', e => !e.hidden);
    await page.keyboard.press('Escape');
    // recently viewed shows up
    await openFromMenu(page, 'findPlayerBtn');
    results.recent = await page.$eval('#findResults', e => e.textContent.replace(/\s+/g, ' ').trim());
    await ctx.close();
  }

  // ---------- Team Games tab + team link ----------
  {
    const { ctx, page } = await newPage();
    await page.click('.standings-row[data-team-id="158"]');
    await page.waitForSelector('.stats-table');
    await page.click('[data-team-view="games"]');
    await page.waitForSelector('.games-table');
    results.teamGamesTitles = await page.$$eval('#rosterBody .stats-title', t => t.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
    results.teamGamesFirst = await page.$eval('.games-table tbody tr', r => r.textContent.replace(/\s+/g, ' ').trim());
    results.rosterTabsHidden = await page.$eval('#rosterTabs', e => e.hidden);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/team-games.png` });
    await page.click('#copyTeamLink');
    results.teamLink = await page.evaluate(() => navigator.clipboard.readText());
    await page.click('[data-team-view="roster"]');
    await page.waitForSelector('.stats-table .player-row');
    results.backToRoster = await page.$eval('#rosterTabs', e => !e.hidden);
    // refresh
    await page.keyboard.press('Escape');
    results.updatedLine = await page.$eval('#updatedText', e => e.textContent);
    const before = requests.filter(u => u.includes('/standings')).length;
    await page.click('#refreshBtn');
    await page.waitForFunction(() => document.getElementById('toast').textContent === 'Standings refreshed');
    results.refreshRefetched = requests.filter(u => u.includes('/standings')).length - before;
    await ctx.close();
  }

  // ---------- Deep links ----------
  {
    const { ctx, page } = await newPage({ url: 'index.html?player=592450&season=2024' });
    await page.waitForSelector('#playerModal:not([hidden])');
    results.deepPlayer = [await page.$eval('#playerName', e => e.textContent), await page.$eval('#seasonSelect', s => s.value), await page.$eval('#playerViewTabs .tab-btn', b => b.textContent)];
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage({ url: 'index.html?compare=592450,592451&cview=chart&cgroup=hitting' });
    await page.waitForSelector('#compareModal:not([hidden]) .line-chart');
    results.deepCompare = [await page.$$eval('.compare-chip', c => c.length), await page.$$eval('.line-chart path', p => p.length), await page.$$eval('.chart-legend span', s => s.length), await page.$eval('#cmpModeTabs', e => e.hidden)];
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/compare-chart.png` });
    await page.click('#copyCompareLink');
    results.compareLink = await page.evaluate(() => navigator.clipboard.readText());
    // chart colors stay with players when one is removed
    const colorsBefore = await page.$$eval('.compare-chip .series-dot', d => d.map(x => x.getAttribute('style')));
    await page.click('.compare-chip button[data-remove="592450"]');
    const colorsAfter = await page.$$eval('.compare-chip .series-dot', d => d.map(x => x.getAttribute('style')));
    results.colorStable = colorsBefore[1] === colorsAfter[0];
    await ctx.close();
  }

  // ---------- Mobile ----------
  {
    const { ctx, page } = await newPage({ viewport: { width: 375, height: 812 } });
    results.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await openFromMenu(page, 'gamesBtn');
    await page.waitForSelector('.game-card');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/m-games.png` });
    await page.keyboard.press('Escape');
    await openFromMenu(page, 'leadersBtn');
    await page.waitForSelector('.leader-row');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/m-leaders.png` });
    await page.keyboard.press('Escape');
    await openFromMenu(page, 'findPlayerBtn');
    await page.fill('#findSearch', 'judge');
    await page.waitForSelector('#findResults button[data-player-id]');
    await page.click('#findResults button[data-player-id]');
    await page.waitForSelector('#playerModal:not([hidden])');
    await page.click('[data-view="years"]');
    await page.waitForSelector('.line-chart');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/m-player-chart.png` });
    await ctx.close();
  }


  // ---- checks ----
  assert.deepEqual(results.menuItems.map(x => x.replace(/^\S+\s/, '')), ["Today's games", 'League leaders', 'Find a player', 'Compare players', 'Favorite teams', 'Help & info']);
  assert.equal(results.gameCards[0][0], 'Bot 5th', 'live inning shown');
  assert.equal(results.gameCards[1][0], 'Final/10', 'extra innings shown');
  assert.match(results.gameCards[1][3], /W: Gerrit Cole/);
  assert.match(results.gameCards[2][3], /Shota Imanaga/, 'probable pitchers for upcoming games');
  assert.equal(results.liveRefreshScheduled, true, 'live games auto-refresh');
  assert.match(results.emptyDay, /Next games/);
  assert.match(results.leadersReq, /leaderCategories=earnedRunAverage&statGroup=pitching.*leagueId=103/);
  assert.equal(results.leaderPlayerTabs[0], '1998', 'player opened from 1998 leaders shows 1998');
  assert.equal(results.leaderPlayerBackHidden, true);
  assert.deepEqual(results.findResults, ['Aaron Judge']);
  assert.equal(results.chartPoints, 11);
  assert.match(results.chartTip, /^\d{4} HR\d+/);
  assert.equal(results.gameLog[0], 15, 'game log shows last 15 games');
  assert.equal(results.splits.length, 6);
  assert.match(results.playerLink, /\?player=592450&season=\d{4}$/);
  assert.match(results.teamLink, /\?team=158&season=\d{4}$/);
  assert.equal(results.rosterTabsHidden, true);
  assert.equal(results.refreshRefetched, 1, 'Refresh reloads standings');
  assert.deepEqual(results.deepPlayer, ['Aaron Judge', '2024', '2024'], '?player=&season= deep link');
  assert.deepEqual(results.deepCompare, [2, 2, 2, true], '?compare= deep link opens chart');
  assert.equal(results.colorStable, true, 'chart colors stay with each player');
  assert.equal(results.mobileOverflow, 0);
  await browser.close();
  console.log(JSON.stringify(results, null, 1));
  const unexpected = errors.filter(e => !/status of 404/.test(e));
  assert.deepEqual(unexpected, [], 'no JavaScript errors');
  console.log('ERRORS:', errors.length ? [...new Set(errors)].join('\n') : 'none');
})().catch(e => { console.error('TEST CRASH', e.message.split('\n').slice(0, 8).join(' | ')); console.error('PAGE ERRORS:', [...new Set(errors)].join('\n')); process.exit(1); });
