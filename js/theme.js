// theme.js — Color themes: site presets, team colors, and the contrast check that keeps text readable.

// Team color set tuned for white/very-light backgrounds
const teamThemes = {
    "New York Yankees":      { accent: "#0C2340", highlight: "#0C2340", bg: "#ffffff" },
    "Boston Red Sox":        { accent: "#BD3039", highlight: "#BD3039", bg: "#ffffff" },
    "Tampa Bay Rays":        { accent: "#092C5C", highlight: "#092C5C", bg: "#ffffff" },
    "Toronto Blue Jays":     { accent: "#134A8E", highlight: "#134A8E", bg: "#ffffff" },
    "Baltimore Orioles":     { accent: "#DF4601", highlight: "#DF4601", bg: "#ffffff" },

    "Minnesota Twins":       { accent: "#002B5C", highlight: "#002B5C", bg: "#ffffff" },
    "Cleveland Guardians":   { accent: "#0C2340", highlight: "#E31937", bg: "#ffffff" },
    "Chicago White Sox":     { accent: "#000000", highlight: "#000000", bg: "#ffffff" },
    "Detroit Tigers":        { accent: "#0C2340", highlight: "#FA4616", bg: "#ffffff" },
    "Kansas City Royals":    { accent: "#004687", highlight: "#7A6A4F", bg: "#ffffff" },

    "Houston Astros":        { accent: "#002D62", highlight: "#EB6E1F", bg: "#ffffff" },
    "Texas Rangers":         { accent: "#003278", highlight: "#C0111F", bg: "#ffffff" },
    "Seattle Mariners":      { accent: "#003278", highlight: "#0C2C56", bg: "#ffffff" },
    "Los Angeles Angels":    { accent: "#BA0021", highlight: "#003263", bg: "#ffffff" },
    "Oakland Athletics":     { accent: "#003831", highlight: "#EFB21E", bg: "#ffffff" },

    "Atlanta Braves":        { accent: "#0E2340", highlight: "#CE1141", bg: "#ffffff" },
    "Philadelphia Phillies": { accent: "#E81828", highlight: "#002D72", bg: "#ffffff" },
    "New York Mets":         { accent: "#002D72", highlight: "#FF5910", bg: "#ffffff" },
    "Miami Marlins":         { accent: "#00A3E0", highlight: "#EF3340", bg: "#ffffff" },
    "Washington Nationals":  { accent: "#AB0003", highlight: "#14225A", bg: "#ffffff" },

    "Chicago Cubs":          { accent: "#0E3386", highlight: "#CC3433", bg: "#ffffff" },
    "Milwaukee Brewers":     { accent: "#12284B", highlight: "#FFC52F", bg: "#ffffff" },
    "St. Louis Cardinals":   { accent: "#C41E3A", highlight: "#FEDB00", bg: "#ffffff" },
    "Pittsburgh Pirates":    { accent: "#000000", highlight: "#FFB81C", bg: "#ffffff" },
    "Cincinnati Reds":       { accent: "#C6011F", highlight: "#333333", bg: "#ffffff" },

    "Los Angeles Dodgers":   { accent: "#005A9C", highlight: "#EF3E42", bg: "#ffffff" },
    "San Diego Padres":      { accent: "#2F241D", highlight: "#FFC425", bg: "#ffffff" },
    "San Francisco Giants":  { accent: "#FD5A1E", highlight: "#27251F", bg: "#ffffff" },
    "Arizona Diamondbacks":  { accent: "#A71930", highlight: "#5F574F", bg: "#ffffff" },
    "Colorado Rockies":      { accent: "#33006F", highlight: "#4F5B66", bg: "#ffffff" }
};

// The A's are listed as just "Athletics" by MLB since their move
teamThemes["Athletics"] = teamThemes["Oakland Athletics"];

// Site-wide themes (picked in the ☰ Settings menu)
const presetThemes = {
    classic:   { accent: "#1F6B45", highlight: "#2C4A3A", bg: "#F5F7F4" },  // ballpark grass
    cleanblue: { accent: "#0051A8", highlight: "#1A1A1A", bg: "#F7F9FC" },
    graysoft:  { accent: "#444444", highlight: "#222222", bg: "#F7F7F6" },
    night:     { accent: "#4FBF85", highlight: "#C9D6CF", bg: "#0F1714" }   // night game
};

// --- color contrast helpers: some team colors (yellow on white, navy on black)
// are hard to read, so nudge them darker/lighter until text is readable (WCAG 4.5:1).
function hexToRgb(hex) {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

function rgbToHex(rgb) {
    return "#" + rgb.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function luminance(rgb) {
    const [r, g, b] = rgb.map(c => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

function readableOn(hex, bgHex, minRatio = 4.5) {
    const base = hexToRgb(hex);
    const bg = hexToRgb(bgHex);
    const target = luminance(bg) > 0.4 ? 0 : 255; // darken on light backgrounds, lighten on dark
    let t = 0;
    let rgb = base;
    while (contrastRatio(rgb, bg) < minRatio && t < 1) {
        t += 0.05;
        rgb = base.map(c => c + (target - c) * t);
    }
    return rgbToHex(rgb);
}

function applyColors({ accent, highlight, bg }) {
    // If the main team color is hard to read but the second color isn't, lead with the readable one.
    const bgRgb = hexToRgb(bg);
    if (contrastRatio(hexToRgb(accent), bgRgb) < 3 && contrastRatio(hexToRgb(highlight), bgRgb) >= 3) {
        [accent, highlight] = [highlight, accent];
    }
    const accentHex = readableOn(accent, bg);
    const root = document.documentElement;
    root.dataset.mode = luminance(bgRgb) > 0.4 ? "light" : "dark";
    root.style.setProperty("--bg", bg);
    root.style.setProperty("--accent", accentHex);
    root.style.setProperty("--highlight", readableOn(highlight, bg));
    // Text color used on top of the accent color (header, active tabs, buttons)
    const acc = hexToRgb(accentHex);
    root.style.setProperty("--on-accent",
        contrastRatio(acc, [255, 255, 255]) >= contrastRatio(acc, [17, 17, 17]) ? "#ffffff" : "#111111");
}

export function getThemeChoice() {
    const saved = localStorage.getItem("themeChoice");
    if (saved && (saved === "team" || presetThemes[saved])) return saved;
    // Visitors from the older version: keep their team colors or site theme
    const autoTeam = (localStorage.getItem("autoTeamTheme") || "on").toLowerCase() !== "off";
    if (autoTeam && teamThemes[localStorage.getItem("favoriteTeamTheme")]) return "team";
    const oldUI = localStorage.getItem("selectedUITheme");
    return presetThemes[oldUI] ? oldUI : "classic";
}

export function applyThemeChoice(choice) {
    const hint = document.getElementById("themeHint");
    hint.textContent = "";

    if (choice === "team") {
        const teamName = localStorage.getItem("favoriteTeamTheme");
        if (teamName && teamThemes[teamName]) {
            applyColors(teamThemes[teamName]);
            hint.textContent = `Using ${teamName} colors.`;
        } else {
            applyColors(presetThemes.classic);
            hint.textContent = "Star a team (☆) to use its colors.";
        }
    } else {
        applyColors(presetThemes[choice] || presetThemes.classic);
    }
    document.getElementById("theme").value = choice;
}

export function setThemeChoice(choice) {
    localStorage.setItem("themeChoice", choice);
    applyThemeChoice(choice);
}
