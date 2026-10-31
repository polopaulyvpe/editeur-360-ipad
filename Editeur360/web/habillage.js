/* Habillage iPad, partie script : uniquement l'organisation visuelle.
   - retire les emoji décoratifs des boutons qui ont déjà un libellé ;
   - repère la barre du haut et ses boutons (attributs data-e360) pour que ipad.css
     puisse les ranger ;
   - regroupe les actions secondaires de la barre du haut dans un menu « Plus ».
     Les boutons d'origine restent dans la page (masqués) : le menu les clique,
     donc le comportement de l'éditeur ne change pas.
   Rien ici ne modifie les données ni le moteur (editor.js). */
(function () {
  "use strict";

  var EMOJI = /[\p{Extended_Pictographic}☰▶⬆⬇️‍]+\s*/gu;

  // Actions de la barre du haut : clé, début du libellé, groupe du menu (null = reste visible).
  var BARRE = [
    ["tester-scene", "Tester la scène", null],
    ["tester-jeu", "Tester le jeu", null],
    ["enregistrer", "Enregistrer", null],
    ["mes-jeux", "Mes jeux", null],
    ["charger", "Charger", "Projet"],
    ["json", "JSON", "Projet"],
    ["accueil", "Page d'accueil", "Apparence"],
    ["hud", "HUD", "Apparence"],
    ["da", "DA", "Apparence"],
    ["exporter", "Exporter le jeu", "Publier"],
    ["application", "Application", "Publier"]
  ];
  var LIBELLES_MENU = {
    charger: "Charger un projet…", json: "Exporter en JSON",
    accueil: "Page d'accueil", hud: "Interface du jeu (HUD)", da: "Direction artistique",
    exporter: "Exporter le jeu", application: "Application mobile"
  };

  function libelle(el) {
    return (el.textContent || "").replace(EMOJI, "").replace(/\s+/g, " ").trim();
  }

  // Emoji : retirés des libellés, masqués quand ce sont des icônes à côté d'un texte.
  function epurerBouton(b) {
    if (b.closest(".e360-menu")) return;
    var texte = libelle(b);
    if (!texte) { b.setAttribute("data-e360-icone-seule", ""); return; }
    b.removeAttribute("data-e360-icone-seule");
    var it = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    var n;
    while ((n = it.nextNode())) {
      var v = n.nodeValue;
      if (!v) continue;
      var propre = v.replace(EMOJI, "");
      if (propre !== v) {
        // Une icône seule dans son élément : on masque l'élément, sinon on retire l'emoji du texte.
        if (!propre.trim() && n.parentNode !== b && n.parentNode.childNodes.length === 1) {
          n.parentNode.setAttribute("data-e360-masque", "");
        } else {
          n.nodeValue = propre.replace(/^\s+/, b.firstChild === n ? "" : " ");
        }
      }
    }
  }

  function barreDuHaut() {
    var app = document.querySelector("#root > div");
    var h = app && app.firstElementChild;
    if (!h || h.tagName !== "DIV") return null;
    var aTester = Array.prototype.some.call(h.children, function (c) {
      return c.tagName === "BUTTON" && libelle(c).indexOf("Tester le jeu") === 0;
    });
    return aTester ? h : null;
  }

  function reperer(h) {
    h.setAttribute("data-e360", "barre");
    var spans = h.querySelectorAll(":scope > span");
    if (spans[0]) spans[0].setAttribute("data-e360", "logo");
    if (spans[1]) spans[1].setAttribute("data-e360", "marque");
    if (spans[2]) spans[2].setAttribute("data-e360", "nom-jeu");
    Array.prototype.forEach.call(h.children, function (c) {
      if (c.tagName === "DIV" && c.querySelector("button")) c.setAttribute("data-e360", "vues");
      if (c.tagName !== "BUTTON") return;
      var t = libelle(c);
      for (var i = 0; i < BARRE.length; i++) {
        if (t.indexOf(BARRE[i][1]) === 0) {
          c.setAttribute("data-e360", BARRE[i][0]);
          if (BARRE[i][2]) c.setAttribute("data-e360-menu", BARRE[i][2]);
          return;
        }
      }
    });
    if (!h.querySelector(":scope > .e360-plus")) {
      var p = document.createElement("button");
      p.type = "button";
      p.className = "e360-plus";
      p.setAttribute("aria-label", "Plus d'actions");
      p.textContent = "•••";
      p.addEventListener("click", function (e) { e.stopPropagation(); basculerMenu(p); });
      h.appendChild(p);
    }
  }

  var menu = null;
  function fermerMenu() {
    if (menu) { menu.remove(); menu = null; }
  }
  function basculerMenu(ancre) {
    if (menu) { fermerMenu(); return; }
    var h = barreDuHaut();
    if (!h) return;
    menu = document.createElement("div");
    menu.className = "e360-menu";
    var groupes = {};
    h.querySelectorAll("[data-e360-menu]").forEach(function (b) {
      var g = b.getAttribute("data-e360-menu");
      (groupes[g] = groupes[g] || []).push(b);
    });
    ["Projet", "Apparence", "Publier"].forEach(function (g) {
      if (!groupes[g]) return;
      var titre = document.createElement("div");
      titre.className = "e360-menu-titre";
      titre.textContent = g;
      menu.appendChild(titre);
      groupes[g].forEach(function (b) {
        var item = document.createElement("button");
        item.type = "button";
        item.className = "e360-menu-item";
        item.textContent = LIBELLES_MENU[b.getAttribute("data-e360")] || libelle(b);
        item.disabled = b.disabled;
        item.addEventListener("click", function () { fermerMenu(); b.click(); });
        menu.appendChild(item);
      });
    });
    document.body.appendChild(menu);
    var r = ancre.getBoundingClientRect();
    menu.style.top = Math.round(r.bottom + 6) + "px";
    menu.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + "px";
  }
  document.addEventListener("pointerdown", function (e) {
    if (menu && !menu.contains(e.target) && !e.target.closest(".e360-plus")) fermerMenu();
  }, true);
  window.addEventListener("resize", fermerMenu);

  var prevu = false;
  function passe() {
    prevu = false;
    var root = document.getElementById("root");
    if (!root) return;
    root.querySelectorAll("button").forEach(epurerBouton);
    var h = barreDuHaut();
    if (h) reperer(h);
  }
  function planifier() {
    if (!prevu) { prevu = true; requestAnimationFrame(passe); }
  }

  function demarrer() {
    var root = document.getElementById("root");
    if (!root) return;
    new MutationObserver(planifier).observe(root, { childList: true, subtree: true, characterData: true });
    planifier();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer);
  else demarrer();
})();
