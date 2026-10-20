// Tests for: season picker, career/year-by-year in player window, compare players.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('path');
const APP = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'screenshots');
require('fs').mkdirSync(OUT, { recursive: true });

const divs = [
  [201, 'American League East', [[139,'Tampa Bay Rays','TB'],[147,'New York Yankees','NYY'],[111,'Boston Red Sox','BOS'],[110,'Baltimore Orioles','BAL'],[141,'Toronto Blue Jays','TOR']]],
  [202, 'American League Central', [[114,'Cleveland Guardians','CLE'],[145,'Chicago White Sox','CWS'],[142,'Minnesota Twins','MIN'],[116,'Detroit Tigers','DET'],[118,'Kansas City Royals','KC']]],
  [200, 'American League West', [[117,'Houston Astros','HOU'],[140,'Texas Rangers','TEX'],[136,'Seattle Mariners','SEA'],[133,'Athletics','ATH'],[108,'Los Angeles Angels','LAA']]],
  [204, 'National League East', [[144,'Atlanta Braves','ATL'],[143,'Philadelphia Phillies','PHI'],[146,'Miami Marlins','MIA'],[120,'Washington Nationals','WSH'],[121,'New York Mets','NYM']]],
  [205, 'National League Central', [[158,'Milwaukee Brewers','MIL'],[112,'Chicago Cubs','CHC'],[134,'Pittsburgh Pirates','PIT'],[138,'St. Louis Cardinals','STL'],[113,'Cincinnati Reds','CIN']]],
  [203, 'National League West', [[119,'Los Angeles Dodgers','LAD'],[135,'San Diego Padres','SD'],[109,'Arizona Diamondbacks','AZ'],[137,'San Francisco Giants','SF'],[115,'Colorado Rockies','COL']]],
];
const standingsFor = season => ({ records: divs
  .filter(([id]) => season >= 1994 || (id !== 202 && id !== 205))
  .map(([id, name, teams]) => ({
    division: { id, name },
    teamRecords: teams.map(([tid, tname, abbr], i) => ({
      team: { id: tid, name: tname, abbreviation: abbr },
      wins: (season % 7) + 90 - i*5, losses: 72 - (season % 7) + i*5, winningPercentage: '.5' + (60 - i*5),
      gamesBack: i ? `${i*5}.0` : '-', divisionRank: String(i+1), streak: { streakCode: 'W1' },
      records: { splitRecords: [{ type: 'lastTen', wins: 5, losses: 5 }] }
    }))
  }))});
const apiTeams = { teams: divs.flatMap(([id, name, teams]) => teams.map(([tid, tname, abbr]) => ({ id: tid, name: tname, abbreviation: abbr, division: { id, name } }))) };

const H = (o) => ({ group: { displayName: 'hitting' }, type: { displayName: 'season' }, splits: [{ stat: o }] });
const P = (o) => ({ group: { displayName: 'pitching' }, type: { displayName: 'season' }, splits: [{ stat: o }] });
const pos = (abbreviation, type, name) => ({ abbreviation, type, name });
const rosterPerson = (id, fullName, p, stats) => ({ id, fullName, lastName: fullName.split(' ').pop(), currentAge: 30, height: `6' 2"`, weight: 210, batSide: {code:'R'}, pitchHand: {code:'R'}, mlbDebutDate: '2016-08-13', birthCity: 'Linden', birthStateProvince: 'CA', primaryPosition: p, stats });
const roster = { roster: [
  { jerseyNumber: '99', position: pos('RF','Outfielder','Outfielder'), person: rosterPerson(592450, 'Aaron Judge', pos('RF','Outfielder','Outfielder'), [H({gamesPlayed:150, atBats:550, avg:'.300', homeRuns:45, rbi:110, stolenBases:5, obp:'.420', ops:'1.050'})]) },
  { jerseyNumber: '45', position: pos('P','Pitcher','Pitcher'), person: rosterPerson(543037, 'Gerrit Cole', pos('P','Pitcher','Pitcher'), [P({wins:15,losses:6,era:'3.10',gamesPitched:32,gamesStarted:32,saves:0,inningsPitched:'200.0',strikeOuts:220,whip:'1.05'})]) },
]};

// Career data generator (shape matches /people?personIds=..&hydrate=stats(type=[career,yearByYear]))
function careerPerson(id) {
  const db = {
    592450: { name: 'Aaron Judge', pos: pos('RF','Outfielder','Outfielder'), hit: [2016, 2026] },
    660271: { name: 'Shohei Ohtani', pos: pos('TWP','Two-Way Player','Two-Way Player'), hit: [2018, 2026], pit: [2018, 2026] },
    665742: { name: 'Juan Soto', pos: pos('RF','Outfielder','Outfielder'), hit: [2018, 2026], traded: 2022 },
    543037: { name: 'Gerrit Cole', pos: pos('P','Pitcher','Pitcher'), pit: [2013, 2026] },
    121578: { name: 'Babe Ruth', pos: pos('RF','Outfielder','Outfielder'), hit: [1914, 1935] },
  }[id];
  if (!db) return null;
  const stats = [];
  if (db.hit) {
    const years = [];
    for (let y = db.hit[0]; y <= db.hit[1]; y++) {
      const st = { gamesPlayed: 140, plateAppearances: 600, atBats: 520, runs: 90 + id % 20, hits: 150 + (y % 9), doubles: 30, triples: 2, homeRuns: 20 + ((id + y) % 30), rbi: 90 + (y % 15), stolenBases: id % 15, baseOnBalls: 80, strikeOuts: 130 + (id % 40), avg: '.2' + (70 + (id + y) % 30), obp: '.3' + (60 + y % 30), slg: '.5' + (10 + y % 40), ops: '.9' + (10 + y % 60) };
      if (db.traded === y) {
        years.push({ season: String(y), team: { id: 120, name: 'Washington Nationals' }, sport: { id: 1 }, stat: { ...st, gamesPlayed: 101 } });
        years.push({ season: String(y), team: { id: 135, name: 'San Diego Padres' }, sport: { id: 1 }, stat: { ...st, gamesPlayed: 52 } });
        years.push({ season: String(y), numTeams: 2, sport: { id: 1 }, stat: { ...st, gamesPlayed: 153 } });
      } else {
        years.push({ season: String(y), team: { id: 147, name: 'New York Yankees' }, sport: { id: 1 }, stat: st });
      }
    }
    stats.push({ type: { displayName: 'career' }, group: { displayName: 'hitting' }, splits: [{ sport: { id: 1 }, stat: { gamesPlayed: 1100, plateAppearances: 4800, atBats: 4100, runs: 800, hits: 1200, doubles: 200, triples: 10, homeRuns: 300 + id % 100, rbi: 800, stolenBases: 60, baseOnBalls: 700, strikeOuts: 1200 + id % 300, avg: '.2' + (80 + id % 20), obp: '.4' + (id % 20), slg: '.5' + (50 + id % 40), ops: '.9' + (60 + id % 40) } }] });
    stats.push({ type: { displayName: 'yearByYear' }, group: { displayName: 'hitting' }, splits: years });
  }
  if (db.pit) {
    const years = [];
    for (let y = db.pit[0]; y <= db.pit[1]; y++) years.push({ season: String(y), team: { id: 108, name: 'Los Angeles Angels' }, sport: { id: 1 }, stat: { wins: 10 + y % 6, losses: 6, era: '3.' + (10 + y % 80), gamesPitched: 28, gamesStarted: 28, saves: 0, inningsPitched: '160.1', strikeOuts: 180 + y % 50, baseOnBalls: 50, homeRuns: 18, whip: '1.1' + (y % 9), avg: '.21' + (y % 9) } });
    stats.push({ type: { displayName: 'career' }, group: { displayName: 'pitching' }, splits: [{ sport: { id: 1 }, stat: { wins: 100 + id % 50, losses: 60, era: '3.' + (id % 90), gamesPitched: 300, gamesStarted: 290, saves: 0, inningsPitched: '1800.2', strikeOuts: 2000 + id % 500, baseOnBalls: 500, homeRuns: 200, whip: '1.1' + (id % 9), avg: '.22' + (id % 9) } }] });
    stats.push({ type: { displayName: 'yearByYear' }, group: { displayName: 'pitching' }, splits: years });
  }
  return { id, fullName: db.name, primaryPosition: db.pos, mlbDebutDate: '2016-01-01', stats };
}
const searchDb = [
  { id: 592450, fullName: 'Aaron Judge', primaryPosition: pos('RF'), mlbDebutDate: '2016-08-13', active: true },
  { id: 9999, fullName: 'Judge Minorleaguer', primaryPosition: pos('C') },
  { id: 660271, fullName: 'Shohei Ohtani', primaryPosition: pos('TWP'), mlbDebutDate: '2018-03-29', active: true },
  { id: 665742, fullName: 'Juan Soto', primaryPosition: pos('RF'), mlbDebutDate: '2018-05-15', active: true },
  { id: 543037, fullName: 'Gerrit Cole', primaryPosition: pos('P'), mlbDebutDate: '2013-06-11', active: true },
  { id: 121578, fullName: 'Babe Ruth', primaryPosition: pos('RF'), mlbDebutDate: '1914-07-11', active: false },
];

const json = (route, body) => route.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } });

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const results = {};
  const requests = [];

  async function newPage(viewport = { width: 1280, height: 900 }, storage = {}) {
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.route('**/*', async route => {
      const url = route.request().url();
      requests.push(url);
      if (url.includes('onrender.com/api/teams')) return json(route, apiTeams);
      if (url.startsWith('http://app.test/')) return route.fulfill({ path: path.join(APP, new URL(url).pathname) });
      if (url.includes('/api/v1/standings')) return json(route, standingsFor(Number(new URL(url).searchParams.get('season'))));
      if (url.includes('/roster')) return json(route, roster);
      if (url.includes('/people/search')) {
        const q = new URL(url).searchParams.get('names').toLowerCase();
        return json(route, { people: searchDb.filter(p => p.fullName.toLowerCase().includes(q)) });
      }
      if (url.includes('/api/v1/people?personIds=')) {
        const ids = new URL(url).searchParams.get('personIds').split(',').map(Number);
        return json(route, { people: ids.map(careerPerson).filter(Boolean) });
      }
      if (/team-logos/.test(url)) { const id = (url.match(/(\d+)\.svg/)||[])[1]||'0'; const hue=(Number(id)*47)%360; return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="hsl(${hue},55%,38%)"/></svg>` }); }
      if (/mlb-photos/.test(url)) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#c9d3cc"/><circle cx="20" cy="16" r="7" fill="#8a988f"/><rect x="9" y="26" width="22" height="14" rx="7" fill="#8a988f"/></svg>' });
      return route.fulfill({ status: 204, body: '' });
    });
    await page.addInitScript(st => { if (!sessionStorage.getItem('init')) { localStorage.clear(); for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v); sessionStorage.setItem('init', '1'); } }, storage);
    await page.goto('http://app.test/index.html');
    await page.waitForSelector('.standings table');
    return { ctx, page };
  }

  // ---------- Season picker ----------
  {
    const { ctx, page } = await newPage();
    results.seasonOptions = await page.$$eval('#seasonSelect option', o => [o[0].value, o[o.length - 1].value, o.length]);
    await page.selectOption('#seasonSelect', '1990');
    await page.waitForFunction(() => document.getElementById('seasonLabel').textContent === '1990' && document.querySelectorAll('.standings-row').length === 20);
    await page.waitForTimeout(100);
    results.season1990 = {
      tile: await page.$eval('#seasonLabel', e => e.textContent),
      rows: await page.$$eval('.standings-row', r => r.length),
      visibleDivisions: await page.$$eval('details[data-division]:not([hidden])', d => d.map(x => x.dataset.division)),
      usedBackend: requests.filter(u => u.includes('onrender')).length,
    };
    // roster for 1990 uses fullSeason + season=1990
    await page.click('.standings-row[data-team-id="147"]');
    await page.waitForSelector('.stats-table');
    results.rosterUrl1990 = requests.filter(u => u.includes('/roster')).pop().replace(/hydrate=.*/, 'hydrate=…');
    results.rosterSub = await page.$eval('#rosterSub', e => e.textContent);
    await page.keyboard.press('Escape');
    // back to current; search still works
    await page.selectOption('#seasonSelect', String(new Date().getFullYear()));
    await page.waitForFunction(() => document.querySelectorAll('.standings-row').length === 30);
    await page.fill('#teamSearch', 'guardians');
    results.searchAfterSwitch = await page.$$eval('.standings-row:not([hidden])', r => r.map(x => x.dataset.teamId));
    await page.fill('#teamSearch', '');
    await page.screenshot({ path: `${OUT}/season-current.png` });
    await page.selectOption('#seasonSelect', '1990');
    await page.waitForFunction(() => document.querySelectorAll('.standings-row').length === 20);
    await page.screenshot({ path: `${OUT}/season-1990.png` });
    await ctx.close();
  }

  // ---------- Player window: career + by year ----------
  {
    const { ctx, page } = await newPage();
    await page.click('.standings-row[data-team-id="147"]');
    await page.waitForSelector('.stats-table');
    await page.click('.player-row[data-id="592450"]');
    results.playerTabs = await page.$$eval('#playerViewTabs .tab-btn', b => b.map(x => x.textContent));
    await page.click('#playerViewTabs [data-view="career"]');
    await page.waitForSelector('#playerStats .stat-tiles');
    results.careerTitle = await page.$eval('#playerStats .stats-title', e => e.textContent.replace(/\s+/g, ' ').trim());
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/player-career.png` });
    await page.click('#playerViewTabs [data-view="years"]');
    await page.waitForSelector('.year-table');
    results.yearRows = await page.$$eval('.year-table tbody tr', r => [r.length, r[0].children[0].textContent, r[r.length-1].children[0].textContent]);
    await page.screenshot({ path: `${OUT}/player-years.png` });
    // compare from player
    await page.click('#compareFromPlayer');
    await page.waitForSelector('.compare-table');
    results.compareFromPlayer = await page.$$eval('.compare-chip strong', c => c.map(x => x.textContent));
    await ctx.close();
  }

  // ---------- Compare from the menu ----------
  {
    const { ctx, page } = await newPage();
    await page.click('#menuBtn');
    await page.click('#compareBtn');
    results.compareEmpty = await page.$eval('#compareBody', e => e.textContent.trim());
    await page.fill('#compareSearch', 'judg');
    await page.waitForSelector('#compareResults button');
    results.searchResults = await page.$$eval('#compareResults button', b => b.map(x => x.querySelector('strong').textContent)); // minor leaguer filtered out
    await page.click('#compareResults button[data-person-id="592450"]');
    await page.waitForSelector('.compare-table');
    await page.fill('#compareSearch', 'soto');
    await page.waitForSelector('#compareResults button[data-person-id="665742"]');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.cmp-player').length === 2);
    results.careerHeaders = await page.$$eval('.compare-table thead .cmp-player span', s => s.map(x => x.textContent));
    results.careerBestCells = await page.$$eval('.compare-table td.best', c => c.length);
    results.hrRow = await page.$$eval('.compare-table tbody tr', rows => { const r = rows.find(x => x.querySelector('th').textContent === 'HR'); return [...r.querySelectorAll('td')].map(td => td.textContent + (td.classList.contains('best') ? '*' : '')); });
    results.soRow = await page.$$eval('.compare-table tbody tr', rows => { const r = rows.find(x => x.querySelector('th').textContent === 'SO'); return [...r.querySelectorAll('td')].map(td => td.textContent + (td.classList.contains('best') ? '*' : '')); });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/compare-career.png` });

    // Single season mode; 2022 shows Soto's combined line with both teams
    await page.click('[data-cmp-mode="season"]');
    results.seasonDefault = await page.$eval('#compareSeason', s => s.value);
    await page.selectOption('#compareSeason', '2022');
    await page.waitForFunction(() => document.querySelector('.info-row'));
    results.season2022Team = await page.$$eval('.compare-table .info-row td', t => t.map(x => x.textContent));
    results.season2022Games = await page.$$eval('.compare-table tbody tr', rows => [...rows.find(x => x.querySelector('th').textContent === 'G').querySelectorAll('td')].map(t => t.textContent));
    await page.selectOption('#compareSeason', '2016');
    results.season2016Team = await page.$$eval('.compare-table .info-row td', t => t.map(x => x.textContent.trim()));
    await page.screenshot({ path: `${OUT}/compare-season.png` });

    // Add a pitcher + two-way; switch to pitching
    for (const [q, id] of [['ohtani', 660271], ['cole', 543037]]) {
      await page.fill('#compareSearch', q);
      await page.waitForSelector(`#compareResults button[data-person-id="${id}"]`);
      await page.click(`#compareResults button[data-person-id="${id}"]`);
      await page.waitForFunction(n => document.querySelectorAll('.compare-chip').length === n, id === 660271 ? 3 : 4);
    }
    await page.waitForFunction(() => document.querySelectorAll('.cmp-player').length === 4);
    // fifth is refused
    await page.fill('#compareSearch', 'ruth');
    await page.waitForSelector('#compareResults button[data-person-id="121578"]');
    await page.click('#compareResults button[data-person-id="121578"]');
    results.fifthToast = await page.$eval('#toast', e => e.textContent);
    await page.click('[data-cmp-group="pitching"]');
    await page.click('[data-cmp-mode="career"]');
    await page.waitForFunction(() => document.querySelector('.info-row'));
    results.pitchingInfo = await page.$$eval('.compare-table .info-row td', t => t.map(x => x.textContent.trim()));
    results.eraRow = await page.$$eval('.compare-table tbody tr', rows => [...rows.find(x => x.querySelector('th').textContent === 'ERA').querySelectorAll('td')].map(td => td.textContent + (td.classList.contains('best') ? '*' : '')));
    await page.screenshot({ path: `${OUT}/compare-pitching.png` });

    // Remove a player; list persists after reload
    await page.click('.compare-chip button[data-remove="665742"]');
    results.afterRemove = await page.$$eval('.compare-chip strong', c => c.map(x => x.textContent));
    results.storedIds = await page.evaluate(() => localStorage.getItem('compareIds'));
    await page.keyboard.press('Escape');
    results.compareClosed = await page.$eval('#compareModal', e => e.hidden);
    await ctx.close();
  }

  // ---------- Mobile compare ----------
  {
    const { ctx, page } = await newPage({ width: 375, height: 812 }, { compareIds: '[592450,665742,660271]' });
    results.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.screenshot({ path: `${OUT}/m-home.png` });
    await page.click('#menuBtn');
    await page.click('#compareBtn');
    await page.waitForFunction(() => document.querySelectorAll('.cmp-player').length === 3);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/m-compare.png` });
    await ctx.close();
  }


  // ---- checks ----
  assert.equal(results.seasonOptions[1], '1969');
  assert.equal(results.season1990.rows, 20, '1990 had 20 teams in standings (mock)');
  assert.deepEqual(results.season1990.visibleDivisions, ['AL-East', 'AL-West', 'NL-East', 'NL-West'], 'no Central division before 1994');
  assert.match(results.rosterUrl1990, /rosterType=fullSeason&season=1990/);
  assert.deepEqual(results.searchAfterSwitch, ['114']);
  assert.equal(results.careerTitle.startsWith('Career hitting 2016–2026'), true);
  assert.deepEqual(results.yearRows, [12, '2016', 'Career']);
  assert.deepEqual(results.compareFromPlayer, ['Aaron Judge']);
  assert.deepEqual(results.searchResults, ['Aaron Judge'], 'players who never reached MLB are filtered out');
  assert.deepEqual(results.season2022Team, ['NYY', 'WSH / SD'], 'traded season shows both teams');
  assert.equal(results.season2022Games[1].startsWith('153'), true, 'traded season uses combined totals');
  assert.deepEqual(results.season2016Team, ['NYY', "Didn't play"]);
  assert.equal(results.fifthToast, 'You can compare up to 4 players. Remove one first.');
  assert.equal(results.eraRow[2].endsWith('*'), true, 'lowest ERA highlighted');
  assert.equal(results.storedIds, '[592450,660271,543037]', 'compare list is saved');
  assert.equal(results.mobileOverflow, 0);
  await browser.close();
  console.log(JSON.stringify(results, null, 1));
  const unexpected = errors.filter(e => !/status of 404/.test(e));
  assert.deepEqual(unexpected, [], 'no JavaScript errors');
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
})().catch(e => { console.error('TEST CRASH', e); process.exit(1); });
