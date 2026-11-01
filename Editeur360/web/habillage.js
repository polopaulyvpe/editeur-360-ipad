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
    var t = el.textContent || "";
    if (el.querySelector && el.querySelector(".e360-q")) t = t.replace(/\?\s*$/, "");   // notre « ? » ajouté en fin
    return t.replace(EMOJI, "").replace(/\s+/g, " ").trim();
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

  // ---------- Aides derrière un « ? » ----------
  // Les paragraphes d'explication (petit texte gris) sont masqués et un « ? » est
  // posé à côté du libellé qu'ils expliquent ; les infobulles (title) des boutons
  // aussi, puisque l'iPad n'a pas de survol.
  var GRIS = '[style*="color: rgb(139, 143, 163)"]';
  var BLOQUANTS = "input, button, select, textarea, img, canvas, svg, video, iframe";
  var questions = [];   // { q, cibles: [éléments ou textes], ancre }

  function taille(el) {
    var m = /font-size:\s*([\d.]+)px/.exec(el.getAttribute("style") || "");
    return m ? parseFloat(m[1]) : 99;
  }
  function estAide(el) {
    if (!/^(P|DIV|SPAN)$/.test(el.tagName)) return false;
    var st = el.getAttribute("style") || "";
    if (st.indexOf("uppercase") >= 0 || taille(el) > 11.5) return false;
    if (el.querySelector(BLOQUANTS) || el.closest("button, label, .e360-bulle, [data-e360='accueil']")) return false;
    if (Array.prototype.some.call(el.children, function (c) { return !/^(B|I|EM|STRONG|CODE|KBD|SPAN|BR|A)$/.test(c.tagName); })) return false;
    return (el.textContent || "").trim().length >= 40;
  }
  function estLibelle(el) {
    if (!el || el.hasAttribute("data-e360-aide") || el.querySelector(BLOQUANTS)) return false;
    if (/^(INPUT|BUTTON|SELECT|TEXTAREA|IMG|CANVAS)$/.test(el.tagName)) return false;
    var t = (el.textContent || "").trim();
    return t.length > 0 && t.length <= 80;
  }
  function creerQuestion() {
    // Un span et non un bouton : il peut se trouver dans un bouton ou un label.
    var q = document.createElement("span");
    q.className = "e360-q";
    q.setAttribute("role", "button");
    q.setAttribute("tabindex", "0");
    q.setAttribute("aria-label", "Aide");
    q.textContent = "?";
    q.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      montrerBulle(q);
    });
    return q;
  }
  function questionDe(ancre, mode) {
    for (var i = 0; i < questions.length; i++) if (questions[i].ancre === ancre && questions[i].mode === mode) return questions[i];
    var o = { q: creerQuestion(), ancre: ancre, mode: mode, textes: [] };
    o.q._e360 = o;
    questions.push(o);
    return o;
  }
  function placer(o) {
    if (o.q.isConnected) return;
    if (o.mode === "dans") o.ancre.appendChild(o.q);
    else if (o.mode === "apres") {
      if (o.ancre.nodeType === 1) o.q.style.order = getComputedStyle(o.ancre).order;
      o.ancre.parentNode.insertBefore(o.q, o.ancre.nextSibling);
    } else {
      o.q.classList.add("e360-q-seul");
      o.ancre.parentNode.insertBefore(o.q, o.ancre);
    }
  }

  function aides(root) {
    // Ménage : aides dont l'élément a disparu.
    questions = questions.filter(function (o) {
      o.textes = o.textes.filter(function (t) { return t.el.isConnected; });
      if (!o.ancre.isConnected || !o.textes.length) { o.q.remove(); return false; }
      return true;
    });
    // Petit texte gris, ou tout petit texte (il hérite alors du gris de son parent).
    var candidats = GRIS + ', [style*="font-size: 9"], [style*="font-size: 10px"], [style*="font-size: 10.5px"]';
    root.querySelectorAll(candidats).forEach(function (el) {
      if (el.hasAttribute("data-e360-aide") || !estAide(el)) return;
      el.setAttribute("data-e360-aide", "");
      var ancre = null, p = el.previousElementSibling;
      for (var i = 0; i < 3 && p; i++, p = p.previousElementSibling) {
        if (estLibelle(p)) { ancre = p; break; }
      }
      var o;
      if (ancre) o = questionDe(ancre, "dans");
      else {
        // Libellé écrit directement dans le parent (« Musique d'ambiance »…) : « ? » juste après.
        var t = el.parentNode.firstChild;
        o = t && t.nodeType === 3 && t.nodeValue.trim() ? questionDe(t, "apres") : questionDe(el, "avant");
      }
      o.textes.push({ el: el });
    });
    root.querySelectorAll("button[title]:not([data-e360-q])").forEach(function (b) {
      if (b.closest(".e360-menu") || !b.offsetParent) return;
      var t = (b.getAttribute("title") || "").trim();
      if (t.length < 25 || libelle(b).length > 0 && t.indexOf(libelle(b)) === 0 && t.length < libelle(b).length + 15) {
        b.setAttribute("data-e360-q", "non");
        return;
      }
      b.setAttribute("data-e360-q", "");
      // Dans le bouton, en fin de libellé : n'abîme pas les grilles et rangées de boutons.
      // Le « ? » arrête la propagation du toucher, donc le bouton ne se déclenche pas.
      var o = questionDe(b, "dans");
      o.textes.push({ el: b, titre: true });
    });
    questions.forEach(placer);
  }

  var bulle = null;
  function fermerBulle() { if (bulle) { bulle.remove(); bulle = null; } }
  function montrerBulle(q) {
    var o = q._e360;
    if (bulle && bulle._q === q) { fermerBulle(); return; }
    fermerBulle();
    bulle = document.createElement("div");
    bulle.className = "e360-bulle";
    bulle._q = q;
    o.textes.forEach(function (t) {
      var p = document.createElement("p");
      p.textContent = t.titre ? t.el.getAttribute("title") : (t.el.textContent || "").trim();
      bulle.appendChild(p);
    });
    document.body.appendChild(bulle);
    var r = q.getBoundingClientRect(), l = bulle.offsetWidth, h = bulle.offsetHeight;
    var x = Math.min(Math.max(8, r.left + r.width / 2 - l / 2), window.innerWidth - l - 8);
    var y = r.bottom + 8;
    if (y + h > window.innerHeight - 8) y = Math.max(8, r.top - h - 8);
    bulle.style.left = Math.round(x) + "px";
    bulle.style.top = Math.round(y) + "px";
  }
  document.addEventListener("pointerdown", function (e) {
    if (bulle && !bulle.contains(e.target) && e.target !== bulle._q) fermerBulle();
  }, true);
  window.addEventListener("resize", fermerBulle);
  document.addEventListener("scroll", fermerBulle, true);

  // ---------- Écran d'accueil : nouveau jeu ou jeu existant ----------
  // Au lancement, on ouvre « Mes jeux » de l'éditeur et on l'affiche en plein
  // écran comme page d'accueil. Les choix restent ceux de l'éditeur.
  var accueil = { demande: false, fait: false, debut: Date.now() };
  function fenetreMesJeux() {
    var fen = null;
    document.querySelectorAll("#root [style*='position: fixed'][style*='inset: 0px']").forEach(function (f) {
      if (Array.prototype.some.call(f.querySelectorAll("button"), function (b) { return /Nouveau jeu$/.test(libelle(b)); })) fen = f;
    });
    return fen;
  }
  function gererAccueil(h) {
    if (accueil.fait) return;
    if (Date.now() - accueil.debut > 6000) { finAccueil(); return; }
    var fen = fenetreMesJeux();
    if (!fen) {
      if (accueil.demande) {
        if (accueil.vu) finAccueil();          // fenêtre fermée : on est dans l'éditeur
        return;
      }
      var b = h && h.querySelector("[data-e360='mes-jeux']");
      if (b) { accueil.demande = true; b.click(); }
      return;
    }
    accueil.vu = true;
    fen.setAttribute("data-e360", "accueil");
    document.documentElement.classList.remove("e360-demarrage");
    var carte = fen.firstElementChild;
    if (!carte) return;
    Array.prototype.forEach.call(carte.children, function (c) {
      if (c.tagName === "BUTTON" && /Nouveau jeu$/.test(libelle(c))) c.setAttribute("data-e360", "nouveau-jeu");
      if (c.tagName === "DIV" && c.querySelector("button") && !c.hasAttribute("data-e360-ligne") && c.getAttribute("style") && c.getAttribute("style").indexOf("padding: 8px 10px") >= 0) {
        c.setAttribute("data-e360-ligne", "");
        // Toute la ligne ouvre le jeu ; la ligne du jeu en cours le reprend.
        c.addEventListener("click", function (e) {
          if (!fen.isConnected || fen.getAttribute("data-e360") !== "accueil" || e.target.closest("button")) return;
          var ouvrir = Array.prototype.filter.call(c.querySelectorAll("button"), function (x) { return libelle(x) === "Ouvrir"; })[0];
          if (ouvrir) ouvrir.click();
          else { var x = fen.querySelector("button[style*='background: transparent']"); if (x) x.click(); }
        });
      }
    });
  }
  function finAccueil() {
    accueil.fait = true;
    document.documentElement.classList.remove("e360-demarrage");
  }
  document.documentElement.classList.add("e360-demarrage");
  // Filet : si la fenêtre n'est jamais venue, on montre l'éditeur quand même.
  setTimeout(function () { if (!accueil.vu) finAccueil(); }, 5000);

  // ---------- Colonne de gauche repliable ----------
  // Toucher un titre (Scènes, Objets du jeu…) replie ou déplie sa rubrique ; un
  // bouton dans la barre du haut masque toute la colonne. L'état est gardé sur l'appareil.
  function lireReglage(cle, defaut) {
    try { var v = localStorage.getItem(cle); return v === null ? defaut : JSON.parse(v); } catch (e) { return defaut; }
  }
  function ecrireReglage(cle, v) {
    try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) { /* stockage indisponible : l'état ne sera pas gardé */ }
  }
  var replis = lireReglage("e360-replis", {});
  if (lireReglage("e360-colonne-masquee", false)) document.documentElement.classList.add("e360-colonne-masquee");

  function colonneGauche() {
    var app = document.querySelector("#root > div");
    var corps = app && app.children[1];
    var c = corps && corps.firstElementChild;
    return c && /width:\s*220px/.test(c.getAttribute("style") || "") ? c : null;
  }

  function colonne() {
    var col = colonneGauche();
    if (!col) return;
    col.setAttribute("data-e360", "colonne");
    // Poignée en tête de la barre latérale : « Réduire » ; réduite, la barre devient
    // une fine bande qu'on touche pour la rouvrir.
    if (!col.querySelector(":scope > .e360-replier")) {
      var p = document.createElement("button");
      p.type = "button";
      p.className = "e360-replier";
      p.setAttribute("aria-label", "Réduire ou ouvrir la barre latérale");
      p.innerHTML = '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
        '<polyline points="12,5 7,10 12,15"/></svg><span class="e360-r-ouvert">Réduire</span>' +
        '<span class="e360-r-ferme">Scènes · Objets · Énigmes · Intervenants · Sons</span>';
      p.addEventListener("click", function () {
        var masquee = document.documentElement.classList.toggle("e360-colonne-masquee");
        ecrireReglage("e360-colonne-masquee", masquee);
      });
      col.insertBefore(p, col.firstChild);
    }
    var cle = null;
    Array.prototype.forEach.call(col.children, function (el) {
      if (el.classList.contains("e360-replier")) return;
      var st = el.getAttribute("style") || "";
      if (el.tagName === "DIV" && st.indexOf("uppercase") >= 0) {
        cle = (el.textContent || "").replace(/\?\s*$/, "").trim();
        el.setAttribute("data-e360-titre", cle);
        if (replis[cle]) el.setAttribute("data-e360-replie", ""); else el.removeAttribute("data-e360-replie");
        if (!el.hasAttribute("data-e360-titre-ok")) {
          el.setAttribute("data-e360-titre-ok", "");
          el.setAttribute("role", "button");
          el.addEventListener("click", function () {
            var k = el.getAttribute("data-e360-titre");
            replis[k] = !replis[k];
            ecrireReglage("e360-replis", replis);
            planifier();
          });
        }
        return;
      }
      // Le réglage général en bas (« Activer la carte en jeu ») reste toujours visible.
      var general = el.querySelector && el.querySelector("input[type='checkbox']") && !el.querySelector("button");
      if (cle && replis[cle] && !general && el.tagName !== "INPUT") el.setAttribute("data-e360-cache", "");
      else el.removeAttribute("data-e360-cache");
    });
  }

  var prevu = false;
  function passe() {
    prevu = false;
    var root = document.getElementById("root");
    if (!root) return;
    root.querySelectorAll("button").forEach(epurerBouton);
    var h = barreDuHaut();
    if (h) reperer(h);
    gererAccueil(h);
    colonne();
    aides(root);
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
