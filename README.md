# Portfolio — Dylan Belledent

Portfolio de développeur full stack : particules WebGL qui se transforment au scroll, typo variable élastique, projets en scroll horizontal, index filtrable et un lab génératif 2D.

**100 % statique, sans build** : HTML, CSS et JavaScript (modules ES). Three.js, GSAP et Lenis sont dans `vendor/`.

## Lancer en local

```bash
python serve.py
```

Puis ouvrir http://localhost:5173 (ou l'extension Live Server de VS Code).

## Modifier le contenu

Tout est dans [`js/data.js`](js/data.js) : profil, compétences, et les projets.
Un projet avec `featured: true` apparaît dans le scroll horizontal ; tous apparaissent dans l'index.
Chaque projet a sa page : `projet.html?p=<slug>`. Les images vont dans `assets/`.

## Mettre en ligne (GitHub Pages)

Pousser le dossier sur un dépôt GitHub, puis **Settings → Pages → Deploy from a branch → `main` / `(root)`**.

## Structure

```
index.html        accueil
projet.html       page projet (remplie par js/project.js)
css/style.css     styles (tokens clair / sombre en haut)
js/               main.js, project.js, common.js, scene.js (WebGL), lab.js (canvas 2D), cursor.js, data.js
vendor/           three, gsap, lenis
assets/           images, vidéos, PDF
demos/            démos jouables (AR Béziers, Spoti-Stats, Summer Adventure)
```

© 2026 Dylan Belledent
