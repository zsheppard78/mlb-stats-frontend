// =========================
// TEAM THEME SYSTEM
// =========================
function showLoading(message = "⏳ Loading MLB data..."){
    const loader = document.getElementById("loading");
    if(loader){
        loader.textContent = message;
        loader.classList.remove("hidden");
    }
}

function hideLoading(){
    const loader = document.getElementById("loading");
    if(loader) loader.classList.add("hidden");
}

async function fetchWithRetry(url, options = {}, retries = 4, delay = 4000) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return res;
            throw new Error("Fetch failed");
        } catch (err) {
            console.warn(`Attempt ${i + 1} failed... retrying in ${delay / 1000}s`);
            if (i < retries - 1) {
                showLoading("⚙️ Server waking up... please wait...");
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw err;
            }
        }
    }
}

function applyTeamTheme(teamName) {
    const theme = teamThemes[teamName];
    if (!theme) return;

    document.documentElement.style.setProperty('--accent', theme.accent);
    document.documentElement.style.setProperty('--highlight', theme.highlight);
    document.documentElement.style.setProperty('--bg', theme.bg);
}

const uiThemes = {
    classic: { accent: "#007BFF", highlight: "#000000", bg: "#ffffff" }, // white + blue
    dodger: { accent: "#005A9C", highlight: "#ffffff", bg: "#0A0C10" },
    cardinal: { accent: "#C41E3A", highlight: "#ffffff", bg: "#0A0C10" },
    green: { accent: "#003831", highlight: "#EFB21E", bg: "#0A0C10" },
    night: { accent: "#ffffff", highlight: "#888888", bg: "#000000" }
};



const teamThemes = {
    "New York Yankees": { accent: "#0C2340", highlight: "#C4CED4", bg: "#0A0C10" },
    "Boston Red Sox": { accent: "#BD3039", highlight: "#0D2B56", bg: "#0A0C10" },
    "Tampa Bay Rays": { accent: "#092C5C", highlight: "#8FBCE6", bg: "#00285D" },
    "Toronto Blue Jays": { accent: "#134A8E", highlight: "#1D2D5C", bg: "#0A0C10" },
    "Baltimore Orioles": { accent: "#DF4601", highlight: "#000000", bg: "#0A0C10" },
    "Minnesota Twins": { accent: "#002B5C", highlight: "#D31145", bg: "#0A0C10" },
    "Cleveland Guardians": { accent: "#0C2340", highlight: "#E31937", bg: "#0A0C10" },
    "Chicago White Sox": { accent: "#000000", highlight: "#C4CED4", bg: "#0A0C10" },
    "Detroit Tigers": { accent: "#0C2340", highlight: "#FA4616", bg: "#0A0C10" },
    "Kansas City Royals": { accent: "#004687", highlight: "#C09A5B", bg: "#0A0C10" },
    "Houston Astros": { accent: "#002D62", highlight: "#EB6E1F", bg: "#0A0C10" },
    "Texas Rangers": { accent: "#003278", highlight: "#C0111F", bg: "#0A0C10" },
    "Seattle Mariners": { accent: "#003278", highlight: "#0C2C56", bg: "#0A0C10" },
    "Los Angeles Angels": { accent: "#BA0021", highlight: "#003263", bg: "#0A0C10" },
    "Oakland Athletics": { accent: "#003831", highlight: "#EFB21E", bg: "#0A0C10" },
    "Atlanta Braves": { accent: "#0E2340", highlight: "#CE1141", bg: "#0A0C10" },
    "Philadelphia Phillies": { accent: "#E81828", highlight: "#002D72", bg: "#0A0C10" },
    "New York Mets": { accent: "#002D72", highlight: "#FF5910", bg: "#0A0C10" },
    "Miami Marlins": { accent: "#00A3E0", highlight: "#EF3340", bg: "#0A0C10" },
    "Washington Nationals": { accent: "#AB0003", highlight: "#14225A", bg: "#0A0C10" },
    "Chicago Cubs": { accent: "#0E3386", highlight: "#CC3433", bg: "#0A0C10" },
    "Milwaukee Brewers": { accent: "#12284B", highlight: "#FFC52F", bg: "#0A0C10" },
    "St. Louis Cardinals": { accent: "#C41E3A", highlight: "#FEDB00", bg: "#0A0C10" },
    "Pittsburgh Pirates": { accent: "#000000", highlight: "#FFB81C", bg: "#0A0C10" },
    "Cincinnati Reds": { accent: "#C6011F", highlight: "#000000", bg: "#0A0C10" },
    "Los Angeles Dodgers": { accent: "#005A9C", highlight: "#EF3E42", bg: "#0A0C10" },
    "San Diego Padres": { accent: "#2F241D", highlight: "#FFC425", bg: "#0A0C10" },
    "San Francisco Giants": { accent: "#FD5A1E", highlight: "#27251F", bg: "#0A0C10" },
    "Arizona Diamondbacks": { accent: "#A71930", highlight: "#E3D4AD", bg: "#0A0C10" },
    "Colorado Rockies": { accent: "#33006F", highlight: "#C4CED4", bg: "#0A0C10" }
};

function applyUITheme(themeName){
    const theme = uiThemes[themeName];
    if(!theme) return;

    document.documentElement.style.setProperty('--accent', '#007BFF');
    document.documentElement.style.setProperty('--highlight', '#000000');
    document.documentElement.style.setProperty('--bg', '#ffffff');


    localStorage.setItem("selectedUITheme", themeName);
}

// =========================
// INIT PAGE
// =========================
document.addEventListener("DOMContentLoaded", () => {
    loadTeams();
    loadFavoriteTeamTheme();
    loadStandings();

    const menuBtn = document.getElementById("menuBtn");
    const sideMenu = document.getElementById("sideMenu");
    menuBtn.addEventListener("click", () => {
        const isOpen = sideMenu.classList.toggle("active");
        document.body.classList.toggle("menu-open", isOpen);
    });

    const themeSelector = document.getElementById("theme");
    themeSelector.addEventListener("change", (e) => {
        applyUITheme(e.target.value);
    });
    
    document.getElementById("resetThemeBtn").addEventListener("click", () => {
        localStorage.removeItem("favoriteTeamTheme");
        document.documentElement.style.setProperty('--accent', '#ffd700');
        document.documentElement.style.setProperty('--highlight', '#00b7ff');
        document.documentElement.style.setProperty('--bg', '#0b0d11');
        alert("Theme reset to default!");
    });

    document.addEventListener("click", (e) => {
        if (sideMenu.classList.contains("active") && !sideMenu.contains(e.target) && !menuBtn.contains(e.target)) {
            sideMenu.classList.remove("active");
            document.body.classList.remove("menu-open");
        }
    });

    document.getElementById("helpBtn").addEventListener("click", () => {
        alert("Welcome to MLB Explorer!\n\n" +
            "✅ Open a division to see teams & standings\n" +
            "✅ Click a team → roster & player stats\n" +
            "⭐ Favorite teams to save theme\n" +
            "🎨 Team themes auto-apply\n\n" +
            "More features coming soon!"
        );
    });
});

// =========================
// LOAD TEAMS
// =========================
async function loadTeams() {
    showLoading("⏳ Loading teams...");

    try {
        const res = await fetchWithRetry("https://mlb-stats-backend-1.onrender.com/api/teams");
        const data = await res.json();
        const teams = data.teams;
        hideLoading();

        const divisions = {
            "American League East": "AL-East",
            "American League Central": "AL-Central",
            "American League West": "AL-West",
            "National League East": "NL-East",
            "National League Central": "NL-Central",
            "National League West": "NL-West",
        };

        let favorites = JSON.parse(localStorage.getItem("favorites")) || [];

        teams.forEach(team => {
            const divId = divisions[team.division?.name];
            if (!divId) return;

            const container = document.getElementById(divId);
            const teamCard = document.createElement("div");
            teamCard.classList.add("team-card");
            teamCard.dataset.teamName = team.name.toLowerCase(); // 👈 for search filter

            teamCard.addEventListener("click", () => {
                applyTeamTheme(team.name);
                saveFavoriteTeamTheme(team.name);
                openRosterModal(team);
            });

            const logoUrl = `https://www.mlbstatic.com/team-logos/${team.id}.svg`;
            const isFav = favorites.includes(team.id);

            teamCard.innerHTML = `
                <img src="${logoUrl}" class="team-logo" alt="${team.name} logo">
                <p class="team-name">${team.name}</p>
                <div class="favorite-container">
                    <span class="favorite-star ${isFav ? "active" : ""}" 
                        data-id="${team.id}" 
                        data-name="${team.name}"
                    >★</span>
                    <span class="favorite-label">Favorite</span>
                </div>`;

            container.appendChild(teamCard);
        });

        // Favorite logic (keep your existing listener)
        document.querySelectorAll(".favorite-star").forEach(star => {
            star.addEventListener("click", e => {
                e.stopPropagation();
                const id = parseInt(star.dataset.id);
                const teamName = star.dataset.name;
                let favs = JSON.parse(localStorage.getItem("favorites")) || [];

                if (favs.includes(id)) {
                    favs = favs.filter(x => x !== id);
                    star.classList.remove("active");
                } else {
                    favs.push(id);
                    star.classList.add("active");
                    applyTeamTheme(teamName);
                    saveFavoriteTeamTheme(teamName);
                }

                localStorage.setItem("favorites", JSON.stringify(favs));
            });
        });
// 🔍 Working live search filter
        const searchBox = document.getElementById("searchTeams");
        if (searchBox) {
            searchBox.addEventListener("input", e => {
                const query = e.target.value.toLowerCase();
                document.querySelectorAll(".team-card").forEach(card => {
                    const teamName = card.dataset.teamName || "";
                    card.style.display = teamName.includes(query) ? "flex" : "none";
                });
            });
        }


    } catch (err) {
        console.error("Team Load Error:", err);
        showLoading("⚠️ Unable to load data. Please try refreshing.");
    }
}

// =========================
// LOAD STANDINGS TABLES
// =========================
async function loadStandings() {
    const divisions = {
        "AL East": "AL-East-standings",
        "AL Central": "AL-Central-standings",
        "AL West": "AL-West-standings",
        "NL East": "NL-East-standings",
        "NL Central": "NL-Central-standings",
        "NL West": "NL-West-standings"
    };

    try {
        const res = await fetch(
            "https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2024&standingsTypes=regularSeason&hydrate=division"
        );
        const data = await res.json();

        const records = data.records;

        records.forEach(div => {
            const divName = div.division?.name;
            if (!divName) return;

            const target = divisions[divName];
            if (!target) return;

            let html = `
                <table>
                    <tr>
                        <th>Team</th>
                        <th>W</th>
                        <th>L</th>
                        <th>PCT</th>
                    </tr>
            `;

            div.teamRecords.forEach(team => {
                html += `
                    <tr>
                        <td>${team.team.name}</td>
                        <td>${team.wins}</td>
                        <td>${team.losses}</td>
                        <td>${team.winningPercentage}</td>
                    </tr>
                `;
            });

            html += `</table>`;
            document.getElementById(target).innerHTML = html;
        });
    } catch (err) {
        console.error("Standings Load Error:", err);
    }
}

// =========================
// SAVE THEME
// =========================
function saveFavoriteTeamTheme(teamName) {
    localStorage.setItem("favoriteTeamTheme", teamName);
}

function loadFavoriteTeamTheme() {
    const name = localStorage.getItem("favoriteTeamTheme");
    if (name && teamThemes[name]) applyTeamTheme(name);
}

// =========================
// ROSTER MODAL + PLAYER STATS
// =========================
async function openRosterModal(team) {
    document.getElementById("teamNameModal").textContent = team.name;
    document.getElementById("rosterModal").style.display = "flex";

    document.getElementById("batters").innerHTML = "";
    document.getElementById("pitchers").innerHTML = "";
    document.getElementById("catchers").innerHTML = "";

    const rosterRes = await fetch(`https://statsapi.mlb.com/api/v1/teams/${team.id}/roster`);
    const rosterData = await rosterRes.json();
    const players = rosterData.roster;

    const groups = {
        "Starting Pitchers": [], "Relief Pitchers": [], "Pitchers/DH": [],
        "Catchers": [], "Infielders": [], "Outfielders": []
    };

    const map = {
        SP: "Starting Pitchers", RP: "Relief Pitchers", CP: "Relief Pitchers", LRP: "Relief Pitchers", MRP: "Relief Pitchers",
        C: "Catchers",
        "1B": "Infielders", "2B": "Infielders", "3B": "Infielders", SS: "Infielders", IF: "Infielders",
        LF: "Outfielders", CF: "Outfielders", RF: "Outfielders", OF: "Outfielders",
        DH: "Pitchers/DH", PH: "Pitchers/DH", PR: "Pitchers/DH"
    };

    for (let p of players) {
        const pos = p.position.abbreviation;
        const group = map[pos] || "Pitchers/DH";

        const statsUrl = `https://statsapi.mlb.com/api/v1/people/${p.person.id}/stats?stats=season&season=2024`;
        const statsRes = await fetch(statsUrl);
        const statsJson = await statsRes.json();
        const stats = statsJson.stats?.[0]?.splits?.[0]?.stat || {};

        const headshot = `https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_auto:best/v1/people/${p.person.id}/headshot/silo/current`;

        groups[group].push({
            name: p.person.fullName, position: pos, stats, headshot, id: p.person.id
        });
    }

    for (let [title, people] of Object.entries(groups)) {
        if (!people.length) continue;

        let tab = "batters";
        if (title.includes("Pitcher") || title.includes("DH")) tab = "pitchers";
        if (title.includes("Catch")) tab = "catchers";

        const div = document.getElementById(tab);
        div.innerHTML += `<h3>${title}</h3>`;

        people.forEach(p => {
            div.innerHTML += `
                <div class="player-row" data-id="${p.id}">
                    <img src="${p.headshot}" class="player-headshot" alt="${p.name} headshot" />
                    <div class="player-info">
                        <strong>${p.name}</strong> (${p.position})<br>
                        AVG: ${p.stats.avg || "—"} | 
                        HR: ${p.stats.homeRuns || "—"} | 
                        RBI: ${p.stats.rbi || "—"} | 
                        ERA: ${p.stats.era || "—"}
                    </div>
                </div>`;
        });
    }
}

document.getElementById("closeModal").addEventListener("click", () => {
    document.getElementById("rosterModal").style.display = "none";
});
window.addEventListener("click", e => {
    if (e.target === document.getElementById("rosterModal"))
        document.getElementById("rosterModal").style.display = "none";
});

document.addEventListener("click", e => {
    if (!e.target.classList.contains("tab-btn")) return;

    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");

    const tab = e.target.dataset.tab;
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    document.getElementById(tab).classList.add("active");
});

document.addEventListener("click", async e => {
    const row = e.target.closest(".player-row");
    if (!row) return;

    const id = row.dataset.id;
    const modal = document.getElementById("playerModal");

    const res = await fetch(`https://statsapi.mlb.com/api/v1/people/${id}`);
    const data = await res.json();
    const person = data.people[0];

    document.getElementById("playerHeadshot").src =
        `https://img.mlbstatic.com/mlb-photos/image/upload/w_300,q_auto:best/v1/people/${id}/headshot/silo/current`;
    document.getElementById("playerName").textContent = person.fullName;
    document.getElementById("playerTeam").textContent = person.currentTeam?.name ?? "Unknown";

    document.getElementById("playerInfo").innerHTML = `
        Age: ${person.currentAge || "—"}<br>
        Height: ${person.height || "—"}<br>
        Weight: ${person.weight ? person.weight + " lbs" : "—"}<br>
        Birthplace: ${person.birthCity || "—"}
    `;

    modal.style.display = "flex";
});

document.getElementById("closePlayerModal").addEventListener("click", () => {
    document.getElementById("playerModal").style.display = "none";
});
window.addEventListener("click", e => {
    if (e.target === document.getElementById("playerModal"))
        document.getElementById("playerModal").style.display = "none";
});
