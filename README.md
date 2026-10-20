# ⚾ MLB Stats Explorer

A fast, mobile-friendly web app for following Major League Baseball: standings, rosters, live scores, league leaders, player careers and side-by-side player comparisons, for any season back to 1969.

**Live site:** _add your Render URL here_

![Standings](docs/standings.png)

## Features

- **Standings for any season:** American and National League side by side, with W-L, PCT, games back, last 10 and streak. Pick any year from 1969 to today. Older seasons show the divisions that existed then.
- **Team pages:** the full roster with sortable hitting and pitching stats, plus a Games tab with recent results and upcoming games, including the postseason.
- **Player pages:** bio, season stats, career totals, a year-by-year table with an interactive chart, the last 15 games and splits (home/away, day/night, vs. lefties/righties).
- **Today's games:** live scores that refresh themselves, final scores with winning and losing pitchers, and probable pitchers for upcoming games. On days with no games it jumps you to the nearest game day.
- **League leaders:** the top 10 in HR, AVG, RBI, OPS, ERA, strikeouts, WHIP and more, for MLB, the AL or the NL, in any season.
- **Find a player:** search every MLB player, past or present.
- **Compare players:** up to four players by career or a single season, as a table (best value highlighted) or a year-by-year chart.
- **Shareable links:** every team, player and comparison has a Copy link button (for example `?player=592450&season=2024`).
- **Favorites and themes:** star teams to pin them to the top. Pick a theme, including your favorite team's colors, which are automatically adjusted to stay readable.
- **Installable:** works as an app on your phone or desktop, and shows the last data you loaded when you're offline.
- **Accessible:** keyboard navigation (`/` to search, `Esc` to close), screen-reader labels, readable contrast in every theme, and it respects reduced-motion settings.

| Today's games | Player career chart | Compare players |
|---|---|---|
| ![Today's games](docs/todays-games.png) | ![Career chart](docs/player-career-chart.png) | ![Compare players](docs/compare-players.png) |

_Screenshots use sample data from the test suite._

## How it works

```
Browser (this repo: HTML + CSS + vanilla JS)
   │
   ├── Team list ───────────► Java backend on Render  (/api/teams)
   │                             └─ falls back to the MLB API if the backend is asleep
   │
   └── Everything else ─────► MLB Stats API (statsapi.mlb.com)
                                 standings · rosters · schedule · leaders · people · stats
```

- **No framework, no build step.** Plain HTML, CSS and JavaScript, served as static files.
- **Few requests.** A whole roster with every player's stats loads in one request using the API's `hydrate` option, instead of one request per player.
- **Handles a sleeping backend.** Free Render services sleep when idle. The app shows a "waking up" message and switches to the MLB API directly if the backend doesn't answer.
- **Readable team colors.** Team themes run through a WCAG contrast check (4.5:1) and are lightened or darkened until text is readable.
- **Offline-friendly.** A service worker (`sw.js`) uses network-first caching, so you get fresh data when online and the last data you saw when offline.

### Files

| File | What's in it |
|---|---|
| `index.html` | Page structure and all windows (team, player, compare, games, leaders, find) |
| `style.css` | "Ballpark" design: color tokens, light/dark themes, layout, responsive rules |
| `script.js` | Standings, search, favorites, themes, team rosters, player window, season picker, compare |
| `extras.js` | Today's games, league leaders, find a player, game logs, splits, charts, share links, refresh, install |
| `favorites.html` / `favorites.js` | Standalone favorite-teams page |
| `sw.js`, `manifest.webmanifest`, `icons/` | Install-as-an-app support |
| `tests/` | Browser tests (Playwright) |

## Running it locally

It's a static site, so any local web server works:

```bash
# from the project folder
python -m http.server 8000
# then open http://localhost:8000
```

## Tests

The `tests/` folder has browser tests that drive the real page in headless Chromium. Every MLB API call is mocked with realistic data, so the tests are fast, run offline and never fail because of real-world data. They cover standings, search, favorites, themes, sorting, keyboard use, season switching, career stats, traded players, compare, today's games, leaders, player search, game logs, splits, charts, share links, the backend-down fallback and phone layouts.

```bash
cd tests
npm install
npx playwright install chromium
npm test
```

GitHub Actions runs the same tests on every push and pull request (`.github/workflows/tests.yml`) and saves screenshots of each screen as a build artifact.

## Data

All baseball data comes from the public [MLB Stats API](https://statsapi.mlb.com). Team logos and player photos are served by MLB. This is a personal project and isn't affiliated with Major League Baseball.

---

Built by Zachary Sheppard.
