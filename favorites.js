document.addEventListener("DOMContentLoaded", () => {
    loadFavoriteTeams();
});

async function loadFavoriteTeams(){
    const favContainer = document.getElementById("favoriteTeams");
    favContainer.innerHTML = "<p class='loading'>⏳ Loading favorites...</p>";

    let favorites = JSON.parse(localStorage.getItem("favorites")) || [];

    if(favorites.length === 0){
        favContainer.innerHTML = `
            <p style="text-align:center; font-size:1.2rem; color:#777;">
                You haven’t added any favorites yet ⭐<br>
                Go back and click a star on a team card!
            </p>
        `;
        return;
    }

    try{
        const res = await fetch("https://mlb-stats-backend-1.onrender.com/api/teams");
        const data = await res.json();
        const teams = data.teams;

        favContainer.innerHTML = "";

        teams
            .filter(team => favorites.includes(team.id))
            .forEach(team => {
                const card = document.createElement("div");
                card.classList.add("team-card");
                card.innerHTML = `
                    <img src="https://www.mlbstatic.com/team-logos/${team.id}.svg" class="team-logo">
                    <p class="team-name">${team.name}</p>
                `;

                // Clicking the favorite team opens roster + theme
                card.addEventListener("click", () => {
                    localStorage.setItem("favoriteTeamTheme", team.name);
                    window.location.href = "index.html?team=" + encodeURIComponent(team.id);
                });

                favContainer.appendChild(card);
            });
    }catch(err){
        favContainer.innerHTML = "<p style='color:red; text-align:center;'>Failed to load teams.</p>";
        console.error(err);
    }
}