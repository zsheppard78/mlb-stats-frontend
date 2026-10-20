// Headless test of the baseball app with mocked MLB API data (shapes copied from real responses).
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');
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
const clinch = ['z','w',null,null,null];
const standings = { records: divs.map(([id, name, teams]) => ({
  division: { id, name, nameShort: name.replace('American League','AL').replace('National League','NL') },
  teamRecords: teams.map(([tid, tname, abbr], i) => ({
    team: { id: tid, name: tname, abbreviation: abbr, teamName: tname.split(' ').pop(), locationName: tname.split(' ')[0] },
    wins: 98 - i*6, losses: 64 + i*6, winningPercentage: (.605 - i*.037).toFixed(3).slice(1),
    gamesBack: i ? String(i*6) + '.0' : '-', divisionRank: String(i+1), clinchIndicator: clinch[i] || undefined,
    streak: { streakCode: i % 2 ? 'L1' : 'W3' },
    records: { splitRecords: [{ type: 'lastTen', wins: 6, losses: 4 }] }
  }))
}))};
// /api/teams response (as the user's backend might return it): same teams, division with name only
const apiTeams = { teams: divs.flatMap(([id, name, teams]) => teams.map(([tid, tname, abbr]) => ({ id: tid, name: tname, abbreviation: abbr, division: { id, name } }))) };

const H = (o) => ({ group: { displayName: 'hitting' }, type: { displayName: 'season' }, splits: [{ stat: o }] });
const P = (o) => ({ group: { displayName: 'pitching' }, type: { displayName: 'season' }, splits: [{ stat: o }] });
const person = (id, fullName, pos, extra = {}) => ({ id, fullName, lastName: fullName.split(' ').pop(), currentAge: 27, birthCity: 'Kansas City', birthStateProvince: 'MO', birthCountry: 'USA', height: `6' 1"`, weight: 200, mlbDebutDate: '2021-06-30', batSide: { code: 'R' }, pitchHand: { code: 'L' }, primaryPosition: pos, ...extra });
const pos = (abbreviation, type, name) => ({ abbreviation, type, name });
const roster = { roster: [
  { jerseyNumber: '26', position: pos('P','Pitcher','Pitcher'), person: person(1, 'Aaron Ashby', pos('P','Pitcher','Pitcher'), { stats: [H({gamesPlayed:75, avg:'.000'}), P({wins:13,losses:3,era:'3.12',gamesPitched:75,gamesStarted:1,saves:4,inningsPitched:'89.1',strikeOuts:116,whip:'1.31'})] }) },
  { jerseyNumber: '32', position: pos('P','Pitcher','Pitcher'), person: person(2, 'Jacob Misiorowski', pos('P','Pitcher','Pitcher'), { stats: [P({wins:16,losses:5,era:'1.80',gamesPitched:30,gamesStarted:30,saves:0,inningsPitched:'174.2',strikeOuts:252,whip:'0.80'})] }) },
  { jerseyNumber: '60', position: pos('P','Pitcher','Pitcher'), person: person(3, 'No Stats Guy', pos('P','Pitcher','Pitcher')) },
  { jerseyNumber: '61', position: pos('P','Pitcher','Pitcher'), person: person(4, 'Bad Era', pos('P','Pitcher','Pitcher'), { stats: [P({wins:0,losses:0,era:'-.--',gamesPitched:1,gamesStarted:0,inningsPitched:'0.0',strikeOuts:0,whip:'-.--'})] }) },
  { jerseyNumber: '17', position: pos('TWP','Two-Way Player','Two-Way Player'), person: person(5, 'Two Way Star', pos('TWP','Two-Way Player','Two-Way Player'), { stats: [H({gamesPlayed:150,atBats:600,avg:'.310',homeRuns:50,rbi:120,stolenBases:20,obp:'.400',ops:'1.050'}), P({wins:10,losses:5,era:'2.90',gamesPitched:22,gamesStarted:22,inningsPitched:'130.0',strikeOuts:170,whip:'1.00',saves:0})] }) },
  { jerseyNumber: '28', position: pos('1B','Infielder','First Base'), person: person(6, 'Andrew Vaughn', pos('1B','Infielder','First Base'), { stats: [H({gamesPlayed:104,atBats:288,avg:'.306',homeRuns:6,rbi:43,stolenBases:0,obp:'.390',ops:'.834'}), P({wins:0,losses:0,era:'30.00',gamesPitched:2,gamesStarted:0,inningsPitched:'3.0'})] }) },
  { jerseyNumber: '22', position: pos('DH','Hitter','Designated Hitter'), person: person(7, 'Christian Yelich', pos('DH','Hitter','Designated Hitter'), { stats: [H({gamesPlayed:118,atBats:442,avg:'.235',homeRuns:12,rbi:59,stolenBases:11,obp:'.315',ops:'.693'})] }) },
  { jerseyNumber: '11', position: pos('LF','Outfielder','Outfielder'), person: person(8, 'Jackson Chourio', pos('LF','Outfielder','Outfielder'), { stats: [H({gamesPlayed:127,atBats:522,avg:'.291',homeRuns:25,rbi:75,stolenBases:23,obp:'.351',ops:'.838'})] }) },
  { jerseyNumber: '24', position: pos('C','Catcher','Catcher'), person: person(9, 'William Contreras', pos('C','Catcher','Catcher'), { stats: [H({gamesPlayed:147,atBats:566,avg:'.270',homeRuns:18,rbi:94,stolenBases:1,obp:'.341',ops:'.758'})] }) },
]};

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const results = {};

  async function run(name, { backend = 'ok', viewport = { width: 1280, height: 900 }, storage = {}, path: opts_path = '' } = {}) {
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`[${name}] ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`); });

    await page.route('**/*', async route => {
      const url = route.request().url();
      if (url.includes('mlb-stats-backend-1.onrender.com/api/teams')) {
        if (backend === 'ok') return route.fulfill({ json: apiTeams, headers: { 'access-control-allow-origin': '*' } });
        return route.fulfill({ status: 404, body: '<html>not found</html>', contentType: 'text/html' });
      }
      if (url.startsWith('http://app.test/')) {
        const f = path.join(APP, new URL(url).pathname.replace(/^\/$/, '/index.html'));
        return route.fulfill({ path: f });
      }
      if (url.includes('statsapi.mlb.com/api/v1/standings')) return route.fulfill({ json: standings, headers: { 'access-control-allow-origin': '*' } });
      if (url.includes('statsapi.mlb.com/api/v1/teams?')) return route.fulfill({ json: apiTeams, headers: { 'access-control-allow-origin': '*' } });
      if (url.includes('/roster')) return route.fulfill({ json: roster, headers: { 'access-control-allow-origin': '*' } });
      // images / fonts: return a 1x1 transparent gif to keep offline
      if (/team-logos/.test(url)) { const id = (url.match(/(\d+)\.svg/)||[])[1]||'0'; const hue = (Number(id)*47)%360; return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="hsl(${hue},55%,38%)"/><text x="20" y="25" font-size="13" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="700">${id.slice(-2)}</text></svg>` }); }
      if (/mlb-photos/.test(url)) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#c9d3cc"/><circle cx="20" cy="16" r="7" fill="#8a988f"/><rect x="9" y="26" width="22" height="14" rx="7" fill="#8a988f"/></svg>' });
      if (/fonts\.(googleapis|gstatic)/.test(url)) return route.fulfill({ status: 204, body: '' });
      return route.fulfill({ status: 204, body: '' });
    });

    await page.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
    await page.goto('http://app.test/' + (opts_path || ''));
    await page.waitForSelector('.standings table', { timeout: 5000 });
    return { ctx, page };
  }

  // ---- Desktop, normal
  {
    const { ctx, page } = await run('desktop');
    results.cards = await page.$$eval('#AL-East-standings .standings-row', els => els.map(e => e.querySelector('.full-name').textContent + ' ' + e.children[1].textContent + '-' + e.children[2].textContent));
    results.standingsTables = await page.$$eval('.standings table', t => t.length);
    results.bannerHidden = await page.$eval('#statusBanner', e => e.hidden);
    await page.screenshot({ path: `${OUT}/desktop-home.png`, fullPage: false });

    // Search
    await page.fill('#teamSearch', 'cubs');
    results.searchVisibleCards = await page.$$eval('.league .standings-row:not([hidden])', els => els.map(e => e.dataset.teamId));
    results.searchVisibleDivisions = await page.$$eval('details:not([hidden])', els => els.map(e => e.dataset.division));
    await page.fill('#teamSearch', 'zzzz');
    results.noResultsShown = await page.$eval('#noResults', e => !e.hidden);
    await page.fill('#teamSearch', '');
    results.afterClearDivisions = await page.$$eval('details:not([hidden])', els => els.length);

    // Favorite: star the Brewers
    await page.click('#NL-Central-standings .favorite-star[data-team-id="158"]');
    results.favCount = await page.$$eval('#favoritesGrid .team-card', e => e.length);
    results.favStorage = await page.evaluate(() => localStorage.getItem('favorites'));
    results.toast = await page.$eval('#toast', e => e.textContent);
    results.modalOpenAfterStar = await page.$eval('#rosterModal', e => !e.hidden);

    // Theme: choose team colors
    await page.click('#menuBtn');
    await page.selectOption('#theme', 'team');
    results.accentTeam = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent'));
    results.themeHint = await page.$eval('#themeHint', e => e.textContent);
    await page.selectOption('#theme', 'night');
    results.nightMode = await page.evaluate(() => document.documentElement.dataset.mode);
    results.accentCardinal = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent'));
    await page.keyboard.press('Escape');
    results.menuClosed = await page.$eval('#sideMenu', e => !e.classList.contains('active'));

    // Roster
    await page.click('#NL-Central-standings .standings-row[data-team-id="158"]');
    await page.waitForSelector('.stats-table');
    results.rosterTabs = await page.$$eval('.tab-btn', b => b.map(x => x.textContent));
    results.hitterOrder = await page.$$eval('.stats-table tbody tr', r => r.map(x => x.querySelector('strong').textContent));
    await page.screenshot({ path: `${OUT}/desktop-roster.png` });
    // sort by HR (desc first)
    await page.click('[data-sort="hr"]');
    results.hrSorted = await page.$$eval('.stats-table tbody tr', r => r.map(x => x.querySelector('strong').textContent));
    // pitchers tab
    await page.click('.tab-btn[data-tab="pitchers"]');
    results.pitcherOrder = await page.$$eval('.stats-table tbody tr', r => r.map(x => x.querySelector('strong').textContent + ':' + x.children[1].textContent));
    await page.click('[data-sort="era"]');
    results.eraSorted = await page.$$eval('.stats-table tbody tr', r => r.map(x => x.querySelector('strong').textContent + ':' + x.children[3].textContent));
    await page.screenshot({ path: `${OUT}/desktop-pitchers.png` });

    // Player modal
    await page.click('.player-row[data-id="5"]');
    results.playerName = await page.$eval('#playerName', e => e.textContent);
    results.playerTeam = await page.$eval('#playerTeam', e => e.textContent);
    results.playerStatTitles = await page.$$eval('.stats-title', e => e.map(x => x.textContent));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/desktop-player.png` });
    await page.keyboard.press('Escape');
    results.afterEscPlayerHidden = await page.$eval('#playerModal', e => e.hidden);
    results.afterEscRosterStillOpen = await page.$eval('#rosterModal', e => !e.hidden);
    await page.keyboard.press('Escape');
    results.afterEsc2RosterHidden = await page.$eval('#rosterModal', e => e.hidden);
    results.bodyScrollRestored = await page.evaluate(() => !document.documentElement.classList.contains('no-scroll'));

    // Help
    await page.click('#helpBtnHeader');
    results.helpOpen = await page.$eval('#helpModal', e => !e.hidden);
    await page.keyboard.press('Escape');

    // Keyboard open roster from standings row
    await page.focus('.standings-row[data-team-id="147"]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.stats-table');
    results.kbdRosterTitle = await page.$eval('#teamNameModal', e => e.textContent);
    await ctx.close();
  }

  // ---- Backend down -> falls back to MLB API; old saved theme migrates; Athletics theme
  {
    const { ctx, page } = await run('fallback', { backend: 'down', storage: { favoriteTeamTheme: 'Athletics', favorites: '[133]' } });
    results.fallbackCards = await page.$$eval('.league .standings-row', e => e.length);
    results.migratedTheme = await page.$eval('#theme', e => e.value);
    results.athAccent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent'));
    await ctx.close();
  }

  // ---- ?team= deep link + old selectedUITheme migration
  {
    const { ctx, page } = await run('deeplink', { path: 'index.html?team=158', storage: { selectedUITheme: 'graysoft', autoTeamTheme: 'off', favoriteTeamTheme: 'Chicago Cubs' } });
    await page.waitForSelector('.stats-table');
    results.deepLinkTeam = await page.$eval('#teamNameModal', e => e.textContent);
    results.migratedUI = await page.$eval('#theme', e => e.value);
    await page.screenshot({ path: `${OUT}/deeplink.png` });
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1000, height: 700 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`[favpage] ${e.message}`));
    await page.route('**/*', async route => {
      const url = route.request().url();
      if (url.includes('onrender.com/api/teams')) return route.fulfill({ json: apiTeams, headers: { 'access-control-allow-origin': '*' } });
      if (url.startsWith('http://app.test/')) return route.fulfill({ path: path.join(APP, new URL(url).pathname) });
      return route.fulfill({ status: 204, body: '' });
    });
    await page.addInitScript(() => localStorage.setItem('favorites', '[158,112]'));
    await page.goto('http://app.test/favorites.html');
    await page.waitForSelector('#favoriteTeams .team-card');
    results.favPageCards = await page.$$eval('#favoriteTeams .team-card', e => e.length);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/favpage.png` });
    await ctx.close();
  }

  // ---- Mobile
  {
    const { ctx, page } = await run('mobile', { viewport: { width: 375, height: 812 }, storage: { favorites: '[158,112]' } });
    results.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.screenshot({ path: `${OUT}/mobile-home.png` });
    await page.click('#favoritesGrid .team-card[data-team-id="158"]');
    await page.waitForSelector('.stats-table');
    await page.screenshot({ path: `${OUT}/mobile-roster.png` });
    await page.click('.player-row[data-id="8"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/mobile-player.png` });
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await page.click('#menuBtn');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/mobile-menu.png` });
    await ctx.close();
  }


  // ---- checks ----
  assert.equal(results.standingsTables, 6, 'six standings tables');
  assert.deepEqual(results.searchVisibleCards, ['112'], 'search finds the Cubs');
  assert.equal(results.noResultsShown, true, 'no-results message');
  assert.equal(results.favCount, 1, 'starred team appears in My teams');
  assert.equal(results.themeHint, 'Using Milwaukee Brewers colors.');
  assert.equal(results.nightMode, 'dark');
  assert.deepEqual(results.hrSorted[0], 'Two Way Star', 'sorting by HR');
  assert.equal(results.eraSorted[0], 'Jacob Misiorowski:1.80', 'ERA sorts lowest first');
  assert.equal(results.eraSorted.at(-1), 'No Stats Guy:—', 'players without stats sort last');
  assert.deepEqual(results.playerStatTitles, [`${new Date().getMonth() < 3 ? new Date().getFullYear() - 1 : new Date().getFullYear()} hitting`, `${new Date().getMonth() < 3 ? new Date().getFullYear() - 1 : new Date().getFullYear()} pitching`]);
  assert.equal(results.afterEscRosterStillOpen, true, 'Esc closes only the top window');
  assert.equal(results.afterEsc2RosterHidden, true);
  assert.equal(results.kbdRosterTitle, 'New York Yankees', 'Enter on a standings row opens the team');
  assert.equal(results.fallbackCards, 30, 'falls back to the MLB API when the backend is down');
  assert.equal(results.migratedTheme, 'team', 'old saved team theme still applies');
  assert.equal(results.deepLinkTeam, 'Milwaukee Brewers', '?team= opens that team');
  assert.equal(results.migratedUI, 'graysoft');
  assert.equal(results.favPageCards, 2, 'favorites page lists starred teams');
  assert.equal(results.mobileOverflow, 0, 'no sideways scrolling on phones');
  await browser.close();
  console.log(JSON.stringify(results, null, 1));
  const unexpected = errors.filter(e => !/status of 404/.test(e));
  assert.deepEqual(unexpected, [], 'no JavaScript errors');
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
})().catch(e => { console.error('TEST CRASH', e.message); process.exit(1); });
