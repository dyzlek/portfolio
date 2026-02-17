// Fonction utilitaire pour convertir les millisecondes en minutes:secondes
function millisToMinutesAndSeconds(millis) {
  const minutes = Math.floor(millis / 60000);
  const seconds = ((millis % 60000) / 1000).toFixed(0);
  return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
}

fetch("data/data.json")
// Il permet de récupérer un fichier distant

.then(response => response.json())
// https://reqbin.com/code/javascript/wc3qbk0b/javascript-fetch-json-example

.then(tracks =>{

    const sortedTracks = [...tracks].sort((a, b) => b.popularity - a.popularity).slice(0, 50);
    let currentTracks = [...sortedTracks]; // Variable globale dans le .then
    let currentSort = { column: null, order: null };
    
    function renderTable(tracksToRender) {
        const tbody = document.querySelector('#trackTable tbody');
        tbody.innerHTML = "";
    
        tracksToRender.forEach(track => {
            const row = document.createElement('tr');
    
            const titre = `<td data-label="Titre :">${track.name}</td>`;
            const artiste = `<td data-label="Artiste :">${track.artists.map(a => a.name).join(', ')}</td>`;
            const album = `<td data-label="Album :">${track.album.name}</td>`;
            row.innerHTML = titre + artiste + album;
    
            const button = document.createElement("button");
            button.className = "btn btn-primary d-flex align-items-center justify-content-center";
            button.style.width = "78px";
            button.style.height = "31px";
            button.innerHTML = `<i class="bi bi-info-circle me-1" style="font-size: 14px;"></i><span>Détails</span>`;
            button.addEventListener("click", () => openPopup(track));
    
            const td = document.createElement("td");
            td.appendChild(button);
            row.appendChild(td);
    
            tbody.appendChild(row);
        });
    
        document.getElementById("noResults").classList.toggle("d-none", tracksToRender.length > 0);
    }

    
    
    // Affichage initial
    renderTable(currentTracks);
    
    // Recherche
    const searchInput = document.getElementById("searchInput");
    const clearSearch = document.getElementById("clearSearch");
    
    searchInput.addEventListener("input", () => {
        const query = searchInput.value.toLowerCase();
        const filtered = currentTracks.filter(track =>
            track.name.toLowerCase().includes(query) ||
            track.album.name.toLowerCase().includes(query) ||
            track.artists.some(a => a.name.toLowerCase().includes(query))
        );
        renderTable(filtered);
        clearSearch.style.display = query ? "inline-block" : "none";
    });
    
    clearSearch.addEventListener("click", () => {
        searchInput.value = "";
        renderTable(currentTracks);
        clearSearch.style.display = "none";
    });
    
    // Tri
    document.querySelectorAll('#trackTable thead th.sortable').forEach(th => {
        th.addEventListener("click", () => {
          const column = th.dataset.column;
          let order;
      
          if (currentSort.column === column) {
            order = currentSort.order === "asc" ? "desc" : currentSort.order === "desc" ? null : "asc";
          } else {
            order = "asc";
          }
      
          currentSort = { column, order };
      
          // Réinitialiser tous les icônes
          document.querySelectorAll('#trackTable thead th.sortable').forEach(otherTh => {
            otherTh.classList.remove("sorted-column");
            const icon = otherTh.querySelector("i");
            if (icon) icon.className = "bi ms-1";
          });
      
          const icon = th.querySelector("i");
          if (order === "asc") {
            icon.classList.add("bi-caret-up-fill");
          } else if (order === "desc") {
            icon.classList.add("bi-caret-down-fill");
          }
      
          if (order) {
            th.classList.add("sorted-column");
          }
      
          if (!order) {
            currentTracks = [...sortedTracks];
          } else {
            currentTracks.sort((a, b) => {
              let aVal = column === "artist" ? a.artists[0]?.name || "" : column === "album" ? a.album.name : a.name;
              let bVal = column === "artist" ? b.artists[0]?.name || "" : column === "album" ? b.album.name : b.name;
              return order === "asc"
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
            });
          }
      
          renderTable(currentTracks);
      
          // Toast d'information
          const toastBody = document.getElementById('sortToastBody');
          const toast = new bootstrap.Toast(document.getElementById('sortToast'));
      
          if (!order) {
            toastBody.textContent = "Tri par défaut (popularité)";
          } else {
            const label = column === "name" ? "Titre" : column === "artist" ? "Artiste" : "Album";
            const direction = order === "asc" ? "croissant" : "décroissant";
            toastBody.textContent = `Tri par ${label} ${direction}`;
          }
          toast.show();
        });
      });      
    

// Tableau d'objets

    const artistCount = {};
    // Objet pour stocker le nombre de morceau de chaque artiste

    tracks.forEach(track =>{
        track.artists.forEach(artist => {
            const name = artist.name;
            artistCount[name] = (artistCount[name] || 0) + 1;
        });
    });
    // Chaque morceau peut avoir plusieurs artistes (feat par exemple), il ne faut pas les oublier
    // https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach

    const sortedArtists = Object.entries(artistCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    // On trie les artistes (de celui qui a le plus de morceaux en premier...) puis on garde les dix premiers
    // https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Array/sort

    const labels = sortedArtists.map(entry => entry[0]);
    const values = sortedArtists.map(entry => entry[1]);
    const maxValue = Math.max(...values);

    new Chart(document.getElementById('artistChart'),{
        type: 'bar',
        // Créer un graphique en barre

        data:{
            labels: labels,
            datasets: [{
                label: "Nombre de morceaux",
                data: values,
                backgroundColor: "#0D6EFD"
            }]
        },
        // Données du graphique

        options:{
            indexAxis: 'y',

            scales:{
                x:{
                    max: maxValue,
                    beginAtZero: true,
                    title:{
                        display: true,
                        text: "Nombre de morceaux",
                        font:{
                            size: 14
                        }
                    }
                }
            },

            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: "Top 10 des artistes (nombre de morceaux)",
                    font: {
                        size: 12,
                        lineHeight: 1.1
                    }, 
                    padding: {
                        top: 10,
                        bottom: 10
                    }
                },

                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    autoPadding: true
                }
            },

            responsive: true,
            maintainAspectRatio: false
        }
    });


    const genreCount = {};

    tracks.forEach(track => {
        track.artists.forEach(artist => {
            if (Array.isArray(artist.genres)) {
                artist.genres.forEach(genre => {
                    genreCount[genre] = (genreCount[genre] || 0) + 1;
                });
            }
        });
    });

    const sortedGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]);
    const topGenres = sortedGenres.slice(0, 7); // Top 7 (doc seven)
    const autresGenres = sortedGenres.slice(7); // Les autres seront groupés (rip)

    const genreLabels = topGenres.map(([genre]) => genre);
    const genreValues = topGenres.map(([, count]) => count);

    if (autresGenres.length > 0) {
        const autresCount = autresGenres.reduce((acc, [, count]) => acc + count, 0);
        genreLabels.push("Autres");
        genreValues.push(autresCount);
    }

    const backgroundColors = [
        "#ff91a9", "#72bef1", "#ffdd88", "#81d3d3",
        "#b794ff", "#ffbc79", "#6cdb9b", "#b5c0c1"
    ];
    // Couleurs du camembert (en mode rbg)

    new Chart(document.getElementById('genreChart'), {
        type: 'pie',

        data: {
            labels: genreLabels,
            datasets: [{
                data: genreValues,
                backgroundColor: backgroundColors
            }]
        },

        options: {
            plugins: {
                title: {
                    display: true,
                    text: "Distribution des genres musicaux",
                    font: {
                        size: 12,
                        lineHeight: 1.1
                    },
                    padding: {
                        top: 10,
                        bottom: 10
                    }
                },
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 15,
                        font: {
                            size: 11
                        }
                    }
                },
                responsive: true,
                layout: {
                    autoPadding: true
                }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });

    const topAlbums = [];
const seenAlbumIds = new Set();

tracks.forEach(track => {
  const album = track.album;
  if (!seenAlbumIds.has(album.id)) {
    seenAlbumIds.add(album.id);

    const mainArtist = album.artists[0]?.name || "Artiste inconnu";

    topAlbums.push({
      id: album.id,
      name: album.name,
      image: album.images[0]?.url || "fallback.jpg",
      release_date: album.release_date,
      total_tracks: album.total_tracks,
      popularity: track.popularity,
      artist: mainArtist 
    });
  }
});

const top12 = topAlbums.sort((a, b) => b.popularity - a.popularity).slice(0, 12);
const albumGrid = document.getElementById("popularAlbums");

top12.forEach(album => {
    const col = document.createElement("div");
    col.className = "col";
    col.innerHTML = `
  <a href="https://open.spotify.com/album/${album.id}" target="_blank" class="text-decoration-none text-dark">
    <div class="card h-100 border-0 shadow-sm">
      <div class="overflow-hidden">
        <img src="${album.image}" class="card-img-top rounded-top img-fluid transition transform-hover" alt="Pochette de l'album ${album.name}">
      </div>
      <div class="card-body d-flex flex-column">
        <p class="fs-6 fw-semibold mb-1 text-truncate" title="Cliquez pour en savoir plus sur l'album ${album.name}">${album.name}</p>
        <p class="fs-7 mb-1">${album.artist}</p> 
        <p class="mb-4 small text-muted">${album.release_date}</p>
        <div class="d-flex justify-content-between align-items-center mb-1">
          <span class="badge bg-primary rounded-pill">${album.total_tracks} titres</span>
          <small class="badge text-bg-success">${album.popularity}/100</small>
        </div>
      </div>
    </div>
  </a>
`;
    albumGrid.appendChild(col);
  });  

})
.catch(error => {
    console.error('Erreur lors du chargement des données:', error);
});

let currentTracks = [...sortedTracks]; // sera modifié dynamiquement
let currentSort = { column: null, order: null };

function renderTable(tracksToRender) {
    const tbody = document.querySelector('#trackTable tbody');
    tbody.innerHTML = "";

    tracksToRender.forEach(track => {
        const row = document.createElement('tr');

        const titre = `<td data-label="Titre :">${track.name}</td>`;
        const artiste = `<td data-label="Artiste :">${track.artists.map(a => a.name).join(', ')}</td>`;
        const album = `<td data-label="Album :">${track.album.name}</td>`;
        row.innerHTML = titre + artiste + album;

        const button = document.createElement("button");
        button.className = "btn btn-primary d-flex align-items-center justify-content-center";
        button.style.width = "78px";
        button.style.height = "31px";
        button.innerHTML = `<i class="bi bi-info-circle me-1" style="font-size: 14px;"></i><span>Détails</span>`;
        button.addEventListener("click", () => openPopup(track));

        const td = document.createElement("td");
        td.appendChild(button);
        row.appendChild(td);

        tbody.appendChild(row);
    });

    document.getElementById("noResults").classList.toggle("d-none", tracksToRender.length > 0);
}

// Initial display
renderTable(currentTracks);

// Barre de recherche
const searchInput = document.getElementById("searchInput");
const clearSearch = document.getElementById("clearSearch");

searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase();
    const filtered = currentTracks.filter(track =>
        track.name.toLowerCase().includes(query) ||
        track.album.name.toLowerCase().includes(query) ||
        track.artists.some(a => a.name.toLowerCase().includes(query))
    );
    renderTable(filtered);
    clearSearch.style.display = query ? "inline-block" : "none";
});

clearSearch.addEventListener("click", () => {
    searchInput.value = "";
    renderTable(currentTracks);
    clearSearch.style.display = "none";
});

// Tri
document.querySelectorAll('#trackTable thead th.sortable').forEach(th => {
    th.addEventListener("click", () => {
        const column = th.dataset.column;
        let order;

        if (currentSort.column === column) {
            order = currentSort.order === "asc" ? "desc" : currentSort.order === "desc" ? null : "asc";
        } else {
            order = "asc";
        }

        currentSort = { column, order };

        document.querySelectorAll('#trackTable thead th.sortable').forEach(otherTh => {
            otherTh.classList.remove("sort-asc", "sort-desc", "sorted-column");
        });        

        if (order) {
            th.classList.add("sorted-column");
            th.classList.add("animate-sort"); // animation visuelle
        }        

        if (!order) {
            currentTracks = [...sortedTracks];
        } else {
            currentTracks.sort((a, b) => {
                let aVal = column === "artist" ? a.artists[0]?.name || "" : column === "album" ? a.album.name : a.name;
                let bVal = column === "artist" ? b.artists[0]?.name || "" : column === "album" ? b.album.name : b.name;
                return order === "asc"
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            });
        }

        renderTable(currentTracks);

        // Toast d'information
const toastBody = document.getElementById('sortToastBody');
const toast = new bootstrap.Toast(document.getElementById('sortToast'));

if (!order) {
    toastBody.textContent = "Tri par défaut (popularité)";
} else {
    const label = column === "name" ? "Titre" : column === "artist" ? "Artiste" : "Album";
    const direction = order === "asc" ? "croissant" : "décroissant";
    toastBody.textContent = `Tri par ${label} ${direction}`;
}
toast.show();

    });
});


function openPopup(track) {
    try {
        console.log('Ouverture du popup pour:', track); // Debug
        
        const modal = new bootstrap.Modal(document.getElementById('trackModal'));
        
        const album = track.album;
        const artists = track.artists;
        const albumArtists = album.artists.map(a => a.name).join(", ");
        
        const albumImg = album.images[0]?.url || "fallback.jpg";
        const altText = `Pochette de l'album "${album.name}" fait par ${albumArtists}`;
        
        // Vérification et assignation sécurisées
        const elements = {
            'popup-album-name': { prop: 'textContent', value: album.name },
            'popup-release-date': { prop: 'textContent', value: album.release_date },
            'popup-total-tracks': { prop: 'textContent', value: album.total_tracks },
            'popup-title': { prop: 'textContent', value: track.name },
            'popup-audio': { prop: 'src', value: track.preview_url || '' },
            'popup-duration': { prop: 'textContent', value: millisToMinutesAndSeconds(track.duration_ms) },
            'popup-track-number': { prop: 'textContent', value: track.track_number },
            'popup-explicit': { prop: 'textContent', value: track.explicit ? "Oui" : "Non" },
            'popup-spotify-link': { prop: 'href', value: track.external_urls?.spotify || '#' }
        };
        
        // Application sécurisée des valeurs
        Object.entries(elements).forEach(([id, config]) => {
            const element = document.getElementById(id);
            if (element) {
                element[config.prop] = config.value;
            } else {
                console.warn(`Élément avec l'ID '${id}' non trouvé`);
            }
        });
        
        // Configuration de l'image de l'album avec animation et lien
        const albumImgElement = document.getElementById('popup-album-img');
        if (albumImgElement) {
            albumImgElement.src = albumImg;
            albumImgElement.alt = altText;
            albumImgElement.style.cursor = 'pointer';
            albumImgElement.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
            
            // Événements hover
            albumImgElement.addEventListener('mouseenter', () => {
                albumImgElement.style.transform = 'scale(1.05)';
                albumImgElement.style.boxShadow = '0 8px 20px rgba(0,0,0,0.3)';
            });
            
            albumImgElement.addEventListener('mouseleave', () => {
                albumImgElement.style.transform = 'scale(1)';
                albumImgElement.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            });
            
            // Clic pour ouvrir l'album sur Spotify
            albumImgElement.addEventListener('click', () => {
                const albumUrl = `https://open.spotify.com/album/${album.id}`;
                window.open(albumUrl, '_blank');
            });
        }
        
        // Artistes
        const artistHTML = track.artists.map(artist => 
            `<span class="badge text-bg-primary me-1">${artist.name}</span>`
        ).join("");
        const artistsElement = document.getElementById("popup-artists");
        if (artistsElement) {
            artistsElement.innerHTML = artistHTML;
        }
        
        // Genres avec badges gris
        const genres = [...new Set(track.artists.flatMap(a => a.genres || []))];
        
        const genresElement = document.getElementById("popup-genres");
        if (genresElement) {
            if (genres.length > 0) {
                const genreHTML = genres.map(genre => 
                    `<span class="badge bg-secondary me-1 mb-1">${genre}</span>`
                ).join("");
                genresElement.innerHTML = genreHTML;
            } else {
                genresElement.innerHTML = '<span class="text-muted">Non précisé</span>';
            }
        }
        
        // Fonction pour créer les barres de progression avec tooltip
        function createProgressBar(popularity, containerId, label) {
            const container = document.getElementById(containerId);
            if (!container) return;
            
            let progressClass = 'bg-danger';
            let description = 'Faible popularité';
            
            if (popularity >= 80) {
                progressClass = 'bg-success';
                description = 'Très populaire';
            } else if (popularity >= 60) {
                progressClass = 'bg-info';
                description = 'Populaire';
            } else if (popularity >= 40) {
                progressClass = 'bg-warning';
                description = 'Moyennement populaire';
            }
            
            container.innerHTML = `
                <div class="progress" style="height: 20px; cursor: help;" 
                     title="${label}: ${popularity}/100 - ${description}"
                     data-bs-toggle="tooltip" 
                     data-bs-placement="top">
                    <div class="progress-bar ${progressClass}" role="progressbar" 
                         style="width: ${popularity}%" 
                         aria-valuenow="${popularity}" 
                         aria-valuemin="0" 
                         aria-valuemax="100">
                        ${popularity}/100
                    </div>
                </div>
            `;
            
            // Initialiser le tooltip Bootstrap
            const tooltipElement = container.querySelector('[data-bs-toggle="tooltip"]');
            if (tooltipElement) {
                new bootstrap.Tooltip(tooltipElement);
            }
        }
        
        // Barres de progression pour les popularités
        createProgressBar(track.popularity, "popup-track-popularity-bar", "Popularité du morceau");
        createProgressBar(album.popularity || track.popularity, "popup-album-popularity-bar", "Popularité de l'album");
        
        modal.show();
        
    } catch (error) {
        console.error('Erreur lors de l\'ouverture du popup:', error);
    }
}

console.log("Script chargé avec succès");