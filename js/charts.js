// charts.js — Line charts (career and compare) with hover tooltips.

import { esc } from "./util.js";

export const CHART_STATS = {
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
export function statValue(key, raw) {
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
export function drawLineChart(container, series, statKey, statLabel) {
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

export function chartChips(group, active) {
    return `<div class="chip-row" role="group" aria-label="Stat to chart">${CHART_STATS[group].map(([k, l]) =>
        `<button class="chip ${k === active ? "active" : ""}" data-chart-stat="${k}" aria-pressed="${k === active}">${l}</button>`).join("")}</div>`;
}

export const chartChoice = { hitting: "homeRuns", pitching: "era" };

export function renderCareerChart(slot, career, group) {
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
