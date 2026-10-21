// Tests for: accounts (username + password, Google), and favorite teams saved to the account.
// The Java backend and Google's sign-in script are replaced by small fakes, so nothing real is called.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('path');
const APP = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'screenshots');
require('fs').mkdirSync(OUT, { recursive: true });

const divs = [
  [201, 'American League East', [[147, 'New York Yankees', 'NYY'], [111, 'Boston Red Sox', 'BOS']]],
  [202, 'American League Central', [[114, 'Cleveland Guardians', 'CLE'], [116, 'Detroit Tigers', 'DET']]],
  [200, 'American League West', [[117, 'Houston Astros', 'HOU'], [136, 'Seattle Mariners', 'SEA']]],
  [204, 'National League East', [[144, 'Atlanta Braves', 'ATL'], [143, 'Philadelphia Phillies', 'PHI']]],
  [205, 'National League Central', [[158, 'Milwaukee Brewers', 'MIL'], [112, 'Chicago Cubs', 'CHC']]],
  [203, 'National League West', [[119, 'Los Angeles Dodgers', 'LAD'], [135, 'San Diego Padres', 'SD']]],
];
const T = {}; divs.forEach(([, , ts]) => ts.forEach(([id, name, abbr]) => { T[id] = { id, name, abbreviation: abbr }; }));
const standings = { records: divs.map(([id, name, teams]) => ({ division: { id, name }, teamRecords: teams.map(([tid], i) => ({
  team: T[tid], wins: 95 - i * 5, losses: 67 + i * 5, winningPercentage: '.550', gamesBack: i ? '5.0' : '-', divisionRank: String(i + 1),
  streak: { streakCode: 'W2' }, records: { splitRecords: [{ type: 'lastTen', wins: 6, losses: 4 }] } })) })) };
const apiTeams = { teams: divs.flatMap(([id, name, teams]) => teams.map(([tid]) => ({ ...T[tid], division: { id, name } }))) };

// ---------------------------------------------------------------- fake backend (same rules as the Java one)
const db = { users: [], sessions: new Map(), favorites: new Map(), slowLogin: false, asleep: false };
const userBody = u => ({ id: u.id, username: u.username || null, displayName: u.displayName, google: !!u.google });
function signedIn(u) {
  const token = 'tok-' + Math.random().toString(36).slice(2);
  db.sessions.set(token, u.id);
  return { user: userBody(u), favorites: db.favorites.get(u.id) || [], token };
}
function backend(method, pathname, body, auth) {
  const me = db.users.find(u => u.id === db.sessions.get((auth || '').replace('Bearer ', '')));
  const need = () => me ? null : [401, { error: 'Please sign in again.' }];
  if (pathname === '/api/teams') return [200, apiTeams];
  if (pathname === '/api/ping') { db.pings = (db.pings || 0) + 1; return [200, { status: 'ok' }]; }
  if (pathname === '/api/auth/config') return [200, { passwordSignIn: true, googleClientId: 'test-client.apps.googleusercontent.com' }];
  if (pathname === '/api/auth/register') {
    const username = body.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return [400, { error: 'Usernames are 3–20 characters: letters, numbers and underscores.' }];
    if (db.users.some(u => u.username === username)) return [409, { error: 'That username is taken. Try another one.' }];
    const u = { id: db.users.length + 1, username, password: body.password, displayName: username };
    db.users.push(u);
    return [200, signedIn(u)];
  }
  if (pathname === '/api/auth/login') {
    const u = db.users.find(x => x.username === body.username.trim().toLowerCase() && x.password === body.password);
    return u ? [200, signedIn(u)] : [401, { error: 'Wrong username or password.' }];
  }
  if (pathname === '/api/auth/google') {
    if (body.credential !== 'fake-google-credential') return [401, { error: "Google sign-in didn't work. Please try again." }];
    let u = db.users.find(x => x.google);
    if (!u) { u = { id: db.users.length + 1, google: true, displayName: 'Google Fan' }; db.users.push(u); }
    return [200, signedIn(u)];
  }
  if (pathname === '/api/auth/logout') { db.sessions.delete((auth || '').replace('Bearer ', '')); return [200, { signedOut: true }]; }
  if (need()) return need();
  const favs = db.favorites.get(me.id) || [];
  if (pathname === '/api/me') return [200, { user: userBody(me), favorites: favs }];
  if (pathname === '/api/favorites' && method === 'PUT') { db.favorites.set(me.id, [...new Set(body.teamIds)]); return [200, { favorites: db.favorites.get(me.id) }]; }
  const m = pathname.match(/^\/api\/favorites\/(\d+)$/);
  if (m && method === 'PUT') { if (!favs.includes(+m[1])) db.favorites.set(me.id, [...favs, +m[1]]); return [200, { favorites: db.favorites.get(me.id) }]; }
  if (m && method === 'DELETE') { db.favorites.set(me.id, favs.filter(id => id !== +m[1])); return [200, { favorites: db.favorites.get(me.id) }]; }
  return [404, { error: 'Not found' }];
}

// Stand-in for https://accounts.google.com/gsi/client: draws a button that "signs in" when clicked
const fakeGoogle = `window.google = { accounts: { id: {
  initialize(cfg) { window.__googleConfig = cfg; },
  renderButton(el) {
    el.innerHTML = '<button type="button" id="fakeGoogleBtn">Continue with Google</button>';
    el.firstChild.onclick = () => window.__googleConfig.callback({ credential: 'fake-google-credential' });
  } } } };`;

const errors = [];
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();

  async function newContext(viewport = { width: 1280, height: 900 }) {
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport });
    await ctx.route('**/*', async route => {
      const req = route.request();
      const u = new URL(req.url());
      if (u.hostname === 'accounts.google.com') return route.fulfill({ contentType: 'text/javascript', body: fakeGoogle });
      if (/team-logos/.test(u.href)) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#5a7"/></svg>' });
      if (u.hostname.endsWith('onrender.com')) {
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        if (db.slowLogin && u.pathname === '/api/auth/login') await sleep(3600);
        if (db.asleep) return; // a sleeping Render backend: the request just hangs
        const [status, body] = backend(req.method(), u.pathname, req.postDataJSON?.() || {}, req.headers().authorization);
        return route.fulfill({ status, json: body, headers: cors });
      }
      if (u.hostname === 'app.test') return route.fulfill({ path: path.join(APP, u.pathname) });
      if (u.pathname.endsWith('/standings')) return route.fulfill({ json: standings });
      if (u.pathname.endsWith('/api/v1/teams')) return route.fulfill({ json: apiTeams });
      if (u.pathname.includes('/awards/')) return route.fulfill({ json: { awards: [] } });
      if (u.hostname === 'statsapi.mlb.com') return route.fulfill({ json: { dates: [], teams: [] } });
      if (/fonts\.(googleapis|gstatic)\.com/.test(u.hostname)) return route.fulfill({ contentType: 'text/css', body: '' });
      return route.fulfill({ status: 404, body: '' });
    });
    return ctx;
  }
  async function open(ctx) {
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/status of 40[019]/.test(m.text())) errors.push('console: ' + m.text()); });
    await page.goto('http://app.test/index.html');
    await page.waitForSelector('.standings-row[data-team-id="158"]');
    return page;
  }
  // Waits for a toast that matches (an earlier one may still be showing)
  const toast = (page, re) => page.waitForFunction(src => {
    const t = document.getElementById('toast');
    return !t.hidden && new RegExp(src).test(t.textContent);
  }, re.source, { timeout: 8000 }).then(() => page.textContent('#toast'));
  const myTeams = page => page.$$eval('#favoritesGrid .team-card', cards => cards.map(c => Number(c.dataset.teamId)));
  const star = (page, id) => page.click(`.standings-row[data-team-id="${id}"] .favorite-star`);
  const serverFavs = username => db.favorites.get(db.users.find(u => u.username === username || (username === 'google' && u.google)).id);

  // 0) A sleeping backend doesn't hold up the page, and the page pings it awake
  db.asleep = true;
  const sleepy = await newContext();
  const started = Date.now();
  await open(sleepy);
  const waited = Date.now() - started;
  assert.ok(waited < 3000, `standings took ${waited} ms while the backend was asleep`);
  await sleepy.close();
  db.asleep = false;
  const pingsBefore = db.pings || 0;

  // 1) Phone: a favorite picked before signing up carries over into the new account
  const phone = await newContext();
  let page = await open(phone);
  assert.equal(await page.textContent('#accountLabel'), 'Sign in');
  await star(page, 158);
  await page.click('#accountBtn');
  await page.waitForSelector('#fakeGoogleBtn'); // the Google button shows because the backend has a client id
  assert.equal(await page.textContent('#accountTitle'), 'Sign in');
  await sleep(400); // let the window finish fading in
  await page.screenshot({ path: path.join(OUT, 'account-sign-in.png') });

  await page.click('#tabRegister');
  assert.equal(await page.textContent('#accountTitle'), 'Create an account');
  assert.equal(await page.isVisible('#usernameHint'), true);
  await page.fill('#acctUsername', 'zs');
  await page.fill('#acctPassword', 'password123');
  await page.click('#accountSubmit');
  assert.match(await page.textContent('#accountError'), /3–20 characters/);
  await page.fill('#acctUsername', 'Zach_S');
  await page.fill('#acctPassword', 'short');
  await page.click('#accountSubmit');
  assert.match(await page.textContent('#accountError'), /at least 8/);
  await page.click('#showPassword');
  assert.equal(await page.getAttribute('#acctPassword', 'type'), 'text');
  await page.fill('#acctPassword', 'password123');
  await page.click('#accountSubmit');
  assert.match(await toast(page, /Account created\. Signed in as zach_s · 1 team saved/), /Account created\. Signed in as zach_s · 1 team saved/);
  assert.equal(await page.isHidden('#accountModal'), true);
  assert.equal(await page.textContent('#accountLabel'), 'zach_s');
  assert.equal(await page.textContent('#accountAvatar'), 'Z');
  assert.equal(await page.textContent('#accountMenuLabel'), 'My account');
  assert.deepEqual(serverFavs('zach_s'), [158]);
  assert.ok((db.pings || 0) > pingsBefore, 'page pings the backend awake');

  // 2) Star changes save to the account, in order
  await star(page, 112);
  await star(page, 158);
  await page.waitForFunction(() => true);
  await sleep(300);
  assert.deepEqual(serverFavs('zach_s'), [112]);
  await star(page, 144);
  await sleep(300);
  assert.deepEqual(serverFavs('zach_s'), [112, 144]);

  // A taken username is reported clearly (from another browser)
  const other = await newContext();
  let otherPage = await open(other);
  await otherPage.click('#accountBtn');
  await otherPage.click('#tabRegister');
  await otherPage.fill('#acctUsername', 'ZACH_S');
  await otherPage.fill('#acctPassword', 'password123');
  await otherPage.click('#accountSubmit');
  await otherPage.waitForSelector('#accountError:not([hidden])');
  assert.equal(await otherPage.textContent('#accountError'), 'That username is taken. Try another one.');
  await other.close();

  // 3) Reload: still signed in, teams come from the account
  await page.reload();
  await page.waitForSelector('#favoritesGrid .team-card');
  await page.waitForFunction(() => document.getElementById('accountLabel').textContent === 'zach_s');
  assert.deepEqual(await myTeams(page), [112, 144]);
  await page.click('#accountBtn');
  assert.equal(await page.textContent('#accountTitle'), 'My account');
  assert.match(await page.textContent('#accountSummary'), /Your 2 favorite teams are saved/);
  assert.equal(await page.textContent('#accountMethod'), 'Username: zach_s');
  await sleep(400); // let the window finish fading in
  await page.screenshot({ path: path.join(OUT, 'account-signed-in.png') });

  // 4) Sign out: this device forgets the teams; the account keeps them
  await page.click('#signOutBtn');
  assert.match(await toast(page, /Signed out/), /Signed out/);
  assert.equal(await page.textContent('#accountLabel'), 'Sign in');
  assert.deepEqual(await myTeams(page), []);
  assert.equal(db.sessions.size, 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('authToken')), null);
  assert.deepEqual(serverFavs('zach_s'), [112, 144]);

  // 5) Laptop: wrong password, then the right one (slowly: the server is "waking up")
  const laptop = await newContext({ width: 1440, height: 900 });
  page = await open(laptop);
  await page.click('#accountBtn');
  await page.fill('#acctUsername', 'zach_s');
  await page.fill('#acctPassword', 'wrong-password');
  assert.equal(await page.inputValue('#acctUsername'), 'zach_s');
  await page.press('#acctPassword', 'Enter'); // Enter submits the form
  await page.waitForSelector('#accountError:not([hidden])');
  assert.equal(await page.textContent('#accountError'), 'Wrong username or password.');
  db.slowLogin = true;
  await page.fill('#acctPassword', 'password123');
  await page.click('#accountSubmit');
  await page.waitForSelector('#accountWait:not([hidden])', { timeout: 5000 });
  assert.equal(await page.isDisabled('#accountSubmit'), true);
  await page.waitForSelector('#accountModal', { state: 'hidden', timeout: 8000 });
  db.slowLogin = false;
  assert.deepEqual(await myTeams(page), [112, 144]);
  assert.equal(await page.getAttribute('.standings-row[data-team-id="112"] .favorite-star', 'aria-pressed'), 'true');

  // 6) Google sign-in
  const tablet = await newContext();
  page = await open(tablet);
  await page.click('#accountBtn');
  await page.click('#fakeGoogleBtn');
  assert.match(await toast(page, /Signed in as Google Fan/), /Signed in as Google Fan/);
  await star(page, 119);
  await sleep(300);
  assert.deepEqual(serverFavs('google'), [119]);
  await page.click('#accountBtn');
  assert.equal(await page.textContent('#accountMethod'), 'Signed in with Google');

  // 7) An expired session signs you out politely
  const stale = await newContext();
  await stale.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('authToken', 'expired-token');
      localStorage.setItem('authUser', JSON.stringify({ id: 9, username: 'old', displayName: 'old', google: false }));
      sessionStorage.setItem('seeded', '1');
    }
  });
  page = await open(stale);
  assert.match(await toast(page, /You were signed out/), /You were signed out/);
  assert.equal(await page.textContent('#accountLabel'), 'Sign in');

  // 8) Phone layout: avatar-only button, window fits the screen
  const small = await newContext({ width: 375, height: 760 });
  page = await open(small);
  assert.equal(await page.isVisible('.account-label'), false);
  await page.click('#accountBtn');
  await page.waitForSelector('#fakeGoogleBtn');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(overflow <= 0, `page scrolls sideways by ${overflow}px`);
  await sleep(400); // let the window finish fading in
  await page.screenshot({ path: path.join(OUT, 'account-mobile.png') });

  assert.deepEqual(errors, []);
  await browser.close();
  console.log('account tests passed');
})().catch(err => { console.error(err); process.exit(1); });
