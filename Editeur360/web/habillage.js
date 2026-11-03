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
    var prefs = lireReglage("e360-barre", {});
    Array.prototype.forEach.call(h.children, function (c) {
      if (c.tagName === "DIV" && c.querySelector("button")) {
        c.setAttribute("data-e360", "vues");
        if (!c.hasAttribute("data-e360-vues-ok")) {
          c.setAttribute("data-e360-vues-ok", "");
          // La vue choisie (Liste, Carte, Dialogues…) est retenue pour la prochaine ouverture.
          c.addEventListener("click", function (e) {
            var b = e.target.closest && e.target.closest("button");
            if (b) ecrireReglage("e360-vue", libelle(b));
          }, true);
        }
      }
      if (c.tagName !== "BUTTON") return;
      var t = libelle(c);
      for (var i = 0; i < BARRE.length; i++) {
        if (t.indexOf(BARRE[i][1]) === 0) {
          var cle = BARRE[i][0], p = prefs[cle] || {};
          c.setAttribute("data-e360", cle);
          var place = p.place || (BARRE[i][2] ? "menu" : "barre");
          if (place === "menu") c.setAttribute("data-e360-menu", BARRE[i][2] || "Projet");
          else c.removeAttribute("data-e360-menu");
          c.style.order = p.ordre != null ? String(p.ordre) : "";
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
    var tEd = document.createElement("div");
    tEd.className = "e360-menu-titre";
    tEd.textContent = "Éditeur";
    menu.appendChild(tEd);
    [["Apparence de l'éditeur…", panneauApparence], ["Personnaliser la barre…", panneauBarre], ["Double toucher du crayon…", panneauCrayon]].forEach(function (x) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "e360-menu-item";
      item.textContent = x[0];
      item.addEventListener("click", function () { fermerMenu(); x[1](); });
      menu.appendChild(item);
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
    // Fenêtre jamais venue : on laisse l'éditeur. Une fois ouverte, on continue de préparer
    // ses lignes même si la liste des jeux arrive tard (stockage lent au lancement).
    if (!accueil.vu && Date.now() - accueil.debut > 6000) { finAccueil(); return; }
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
    // La croix de fermeture est le bouton de l'en-tête de la fenêtre. On la repère par sa
    // place et non par son style : Safari n'écrit pas les styles comme Chrome.
    function fermer() {
      var tete = carte.firstElementChild;
      var x = tete && tete.querySelector("button");
      if (x) x.click();
    }
    Array.prototype.forEach.call(carte.children, function (c) {
      if (c.tagName === "BUTTON" && /Nouveau jeu$/.test(libelle(c))) c.setAttribute("data-e360", "nouveau-jeu");
      if (c.tagName !== "DIV" || c.hasAttribute("data-e360-ligne") || !c.querySelector("button")) return;
      var ouvrir = Array.prototype.filter.call(c.querySelectorAll("button"), function (x) { return libelle(x) === "Ouvrir"; })[0];
      var enCours = Array.prototype.filter.call(c.children, function (x) { return x.tagName === "SPAN" && /En cours/.test(x.textContent); })[0];
      if (!ouvrir && !enCours) return;
      c.setAttribute("data-e360-ligne", "");
      c.setAttribute("role", "button");
      // Le jeu en cours a son propre bouton « Continuer », bien visible.
      if (enCours) {
        c.setAttribute("data-e360-en-cours", "");
        var cont = document.createElement("button");
        cont.type = "button";
        cont.className = "e360-continuer";
        cont.textContent = "Continuer";
        cont.addEventListener("click", function (e) { e.stopPropagation(); fermer(); });
        c.insertBefore(cont, enCours);
      }
      // Toute la ligne ouvre le jeu ; la ligne du jeu en cours le reprend.
      c.addEventListener("click", function (e) {
        if (!fen.isConnected || fen.getAttribute("data-e360") !== "accueil" || e.target.closest("button")) return;
        var o = Array.prototype.filter.call(c.querySelectorAll("button"), function (x) { return libelle(x) === "Ouvrir"; })[0];
        if (o) o.click();
        else fermer();
      });
    });
  }
  function finAccueil() {
    accueil.fait = true;
    document.documentElement.classList.remove("e360-demarrage");
    // On rouvre la vue où l'on travaillait la dernière fois.
    var vue = lireReglage("e360-vue", "");
    if (vue) setTimeout(function () {
      var h = barreDuHaut();
      var v = h && h.querySelector("[data-e360='vues']");
      var b = v && Array.prototype.filter.call(v.querySelectorAll("button"), function (x) { return libelle(x) === vue; })[0];
      if (b) b.click();
    }, 200);
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
  // Écran étroit (iPad en portrait) : la barre latérale devient un tiroir posé par-dessus
  // le contenu, fermé par défaut ; son état n'est alors pas mémorisé.
  var etroit = window.matchMedia("(max-width: 1100px)");
  function appliquerLargeur() {
    var masquee = etroit.matches ? true : lireReglage("e360-colonne-masquee", false);
    document.documentElement.classList.toggle("e360-colonne-masquee", masquee);
    document.documentElement.classList.toggle("e360-etroit", etroit.matches);
  }
  appliquerLargeur();
  if (etroit.addEventListener) etroit.addEventListener("change", appliquerLargeur);
  else if (etroit.addListener) etroit.addListener(appliquerLargeur);

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
        if (!etroit.matches) ecrireReglage("e360-colonne-masquee", masquee);
      });
      col.insertBefore(p, col.firstChild);
    }
    // En tiroir, toucher le contenu à côté le referme.
    var corps = col.parentElement;
    if (corps && !corps.hasAttribute("data-e360")) {
      corps.setAttribute("data-e360", "corps");
      corps.addEventListener("click", function (e) {
        if (!etroit.matches || document.documentElement.classList.contains("e360-colonne-masquee")) return;
        var c = colonneGauche();
        if (c && !c.contains(e.target)) document.documentElement.classList.add("e360-colonne-masquee");
      }, true);
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
      // Une scène de la liste : une étoile pour l'épingler en tête de colonne.
      if (cle === "Scènes" && el.tagName === "DIV" && /padding:\s*8px 10px/.test(st)) etoile(el);
      // Le réglage général en bas (« Activer la carte en jeu ») reste toujours visible.
      var general = el.querySelector && el.querySelector("input[type='checkbox']") && !el.querySelector("button");
      if (cle && replis[cle] && !general && el.tagName !== "INPUT") el.setAttribute("data-e360-cache", "");
      else el.removeAttribute("data-e360-cache");
    });
    favorisColonne(col);
  }

  // ---------- Scènes favorites ----------
  var favoris = lireReglage("e360-favoris", []);
  function nomLigne(l) {
    var s = l.querySelector("span");
    return s ? (s.textContent || "").trim() : "";
  }
  function etoile(ligne) {
    var nom = nomLigne(ligne);
    if (!nom) return;
    var e = ligne.querySelector(":scope > .e360-etoile");
    if (!e) {
      e = document.createElement("span");
      e.className = "e360-etoile";
      e.setAttribute("role", "button");
      e.setAttribute("aria-label", "Épingler la scène");
      e.addEventListener("click", function (ev) {
        ev.stopPropagation(); ev.preventDefault();
        var n = nomLigne(ligne), i = favoris.indexOf(n);
        if (i >= 0) favoris.splice(i, 1); else favoris.unshift(n);
        ecrireReglage("e360-favoris", favoris);
        planifier();
      }, true);
      ligne.appendChild(e);
    }
    var on = favoris.indexOf(nom) >= 0;
    if (e.classList.contains("on") !== on) e.classList.toggle("on", on);
    var signe = on ? "★" : "☆";
    if (e.textContent !== signe) e.textContent = signe;
  }
  function favorisColonne(col) {
    var lignes = {};
    Array.prototype.forEach.call(col.children, function (el) { if (el.querySelector(":scope > .e360-etoile")) lignes[nomLigne(el)] = el; });
    var presents = favoris.filter(function (n) { return lignes[n]; });
    var bloc = col.querySelector(":scope > .e360-favoris");
    var sig = presents.join("|");
    if (!presents.length) { if (bloc) bloc.remove(); return; }
    if (bloc && bloc.getAttribute("data-sig") === sig) return;
    if (!bloc) {
      bloc = document.createElement("div");
      bloc.className = "e360-favoris";
      var rep = col.querySelector(":scope > .e360-replier");
      col.insertBefore(bloc, rep ? rep.nextSibling : col.firstChild);
    }
    bloc.setAttribute("data-sig", sig);
    bloc.textContent = "";
    var t = document.createElement("div"); t.className = "e360-favoris-titre"; t.textContent = "★ Favoris"; bloc.appendChild(t);
    presents.forEach(function (n) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "e360-favori"; b.textContent = n;
      b.addEventListener("click", function () {
        var l = Array.prototype.filter.call(col.children, function (el) { return el.querySelector(":scope > .e360-etoile") && nomLigne(el) === n; })[0];
        if (l) l.click();
      });
      bloc.appendChild(b);
    });
  }

  // ---------- Options rangées en onglets ----------
  // Tout panneau qui enchaîne plusieurs rubriques (titres en capitales) est découpé en
  // pages : une rangée d'onglets en tête, et on glisse le doigt de côté pour changer.
  // Rien n'est déplacé : les rubriques des autres onglets sont seulement masquées,
  // pour que l'éditeur continue de gérer ses éléments comme avant.
  // Au-delà de 10 rubriques, elles sont regroupées par thème.
  var THEMES = [
    ["Général", /titre|nom|description|identifiant|version|narration|texte|type/i],
    ["Logique", /logique|variable|condition|action|r[ée]ussite|[ée]chec|indice|solution|abandon|ouverture|pr[ée]requis|d[ée]blocage|r[eè]gle/i],
    ["Sons", /musique|ambiance|\bsons?\b|bruitage|volume|audio|voix/i],
    ["Affichage", /pr[ée]sentation|champ de vision|cam[ée]ra|affichage|[ée]cran|t[ée]l[ée]phone/i],
    ["Contenu", /[ée]l[ée]ment|plateau|calque|objet|sc[eè]ne|carte|intervenant|personnage/i],
    ["Apparence", /couleur|fond|image|police|style|logo|opacit|arrondi|th[eè]me|ic[oô]ne|transition|habillage|apparence|visuel|taille|dessin|fen[eê]tre|bouton/i],
    ["Publier", /v[ée]rification|export|publi|application/i]
  ];
  var choixOnglet = lireReglage("e360-onglets", {});   // onglet choisi, par panneau (clé : la liste de ses rubriques), retenu

  function estRubrique(el) {
    return el.tagName === "DIV" && el.style.textTransform === "uppercase" && el.style.marginTop !== "0px" &&
      !el.classList.contains("e360-onglets");
  }
  // Une rubrique, ou un bloc qui commence par une rubrique (liste d'actions…).
  function rubriqueDe(el) {
    if (el.tagName !== "DIV") return null;
    if (estRubrique(el)) return el.textContent || "";
    var a = el.firstElementChild;
    return a && estRubrique(a) ? a.textContent || "" : null;
  }
  function nomCourt(t) {
    t = t.replace(/\?\s*$/, "").replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+[—–-]\s+.*$/, "").trim();
    t = t.replace(/^(le|la|les|des|du)\s+/i, "").replace(/^l['’]\s*/i, "");
    t = t.replace(/\s+d(e|u|es)\s+(l['’]\s*|la\s+)?(énigme|jeu|scène)$/i, "");
    t = t.replace(/^si elle est abandonnée$/i, "Abandon").replace(/^à\s+(la\s+|l['’]\s*)/i, "");
    t = t.split(" / ")[0].trim();
    t = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    return t.length > 24 ? t.slice(0, 23) + "…" : t;
  }
  // Dans un formulaire, seuls les thèmes sans ambiguïté sont séparés ; le reste est « Général ».
  var THEMES_FINS = { "Logique": 1, "Sons": 1, "Apparence": 1, "Publier": 1 };
  function themeDe(t, fin) {
    for (var i = 0; i < THEMES.length; i++) {
      if (fin && !THEMES_FINS[THEMES[i][0]]) continue;
      if (THEMES[i][1].test(t)) return THEMES[i][0];
    }
    return null;
  }

  // Un libellé de champ (capitales, petit) ou une ligne qui commence par un tel libellé
  // (deux champs côte à côte) : dans un formulaire, chacun ouvre une rubrique.
  function libelleDe(el) {
    if (el.tagName !== "DIV" || el.classList.contains("e360-onglets")) return null;
    if (el.style.textTransform === "uppercase") return el.textContent || "";
    var a = el.firstElementChild, b = a && a.firstElementChild;
    if (a && a.tagName === "DIV" && b && b.tagName === "DIV" && b.style.textTransform === "uppercase") return b.textContent || "";
    return null;
  }

  // Les rubriques d'un panneau, puis ses pages. « fin » : formulaire découpé à chaque
  // libellé de champ, toujours regroupé par thème.
  function decouper(p, fin) {
    var kids = Array.prototype.filter.call(p.children, function (k) { return !k.classList.contains("e360-onglets") && !estFenetre(k); });
    // Le bouton principal en bas d'une fenêtre reste toujours visible.
    var dernier = kids[kids.length - 1];
    if (dernier && (dernier.tagName === "BUTTON" || (dernier.tagName === "DIV" && dernier.children.length &&
      Array.prototype.every.call(dernier.children, function (b) { return b.tagName === "BUTTON"; })))) kids.pop();
    var rubs = [], cur = null, premier = null;
    kids.forEach(function (k) {
      var nom = fin ? libelleDe(k) : rubriqueDe(k);
      if (nom !== null) {
        cur = { nom: nom.replace(/\?\s*$/, "").trim(), els: [k] };
        rubs.push(cur);
        if (!premier) premier = k;
      } else if (cur) cur.els.push(k);
    });
    // Le titre ou le nom en tête d'un formulaire reste toujours visible.
    if (fin && rubs.length && /^(titre|nom)(\s|$)/i.test(rubs[0].nom)) { rubs.shift(); premier = rubs.length ? rubs[0].els[0] : null; }
    if (rubs.length < 2) return null;
    // Une page par rubrique, ou par thème quand il y en a trop.
    var pages = [];
    if (!fin && rubs.length <= 10) {
      rubs.forEach(function (r) { pages.push({ nom: nomCourt(r.nom), els: r.els.slice() }); });
    } else {
      var parNom = {};
      rubs.forEach(function (r) {
        var th = themeDe(r.nom, fin) || (fin || !pages.length ? "Général" : pages[pages.length - 1].nom);
        if (!parNom[th]) { parNom[th] = { nom: th, els: [] }; pages.push(parNom[th]); }
        parNom[th].els = parNom[th].els.concat(r.els);
      });
    }
    if (pages.length < 2) return null;
    return { avant: premier, pages: pages, cle: rubs.map(function (r) { return nomCourt(r.nom); }).join("|") };
  }

  // Le bas de la vue Liste : narration à gauche, réglages de la scène à droite.
  function decouperScene(p) {
    var kids = Array.prototype.filter.call(p.children, function (k) { return !k.classList.contains("e360-onglets") && !estFenetre(k); });
    if (kids.length !== 2) return null;
    var reglages = Array.prototype.slice.call(kids[1].children);
    var i = 0;
    // Les sons commencent au bloc « Musique d'ambiance » (son texte commence ainsi).
    while (i < reglages.length && !/^\s*(musique|ambiances?)\b/i.test(reglages[i].textContent || "")) i++;
    var pages = [{ nom: "Narration", els: [kids[0]] }, { nom: "Réglages", els: reglages.slice(0, i) }];
    if (i < reglages.length) pages.push({ nom: "Sons", els: reglages.slice(i) });
    return { avant: kids[0], pages: pages, cle: "scene" };
  }

  // Une fenêtre qui s'ouvre par-dessus (éditeur de nœuds, choix d'icône…) est posée par
  // l'éditeur dans le panneau : elle ne doit jamais être rangée dans un onglet ni masquée.
  function estFenetre(k) { return !!(k && k.style && k.style.position === "fixed"); }
  function montrerOnglet(p, d, nom, anime) {
    Array.prototype.forEach.call(p.children, function (k) { if (estFenetre(k) && k.hasAttribute("data-e360-hors-onglet")) k.removeAttribute("data-e360-hors-onglet"); });
    if (choixOnglet[d.cle] !== nom) { choixOnglet[d.cle] = nom; ecrireReglage("e360-onglets", choixOnglet); }
    var vise = d.pages.filter(function (pg) { return pg.nom === nom; })[0] || d.pages[0];
    if (p.getAttribute("data-e360-page") !== vise.nom) p.setAttribute("data-e360-page", vise.nom);
    d.pages.forEach(function (pg) {
      pg.els.forEach(function (el) {
        if (estFenetre(el)) return;
        if (pg === vise) {
          if (el.hasAttribute("data-e360-hors-onglet")) {
            el.removeAttribute("data-e360-hors-onglet");
            if (anime) { el.setAttribute("data-e360-entree", anime); setTimeout(function () { el.removeAttribute("data-e360-entree"); }, 260); }
          }
        } else if (!el.hasAttribute("data-e360-hors-onglet")) el.setAttribute("data-e360-hors-onglet", "");
      });
    });
    var barre = p.querySelector(":scope > .e360-onglets");
    if (barre) Array.prototype.forEach.call(barre.children, function (b) {
      var actif = b.getAttribute("data-onglet") === vise.nom;
      if (actif !== b.classList.contains("e360-onglet-actif")) {
        b.classList.toggle("e360-onglet-actif", actif);
        if (actif && b.scrollIntoView) b.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    });
  }

  function glisser(p) {
    var x0 = null, y0 = 0;
    p.addEventListener("touchstart", function (e) {
      var t = e.target;
      x0 = t.closest && t.closest("input[type='range'], canvas, svg, textarea, select, .e360-onglets") ? null : e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    }, { passive: true });
    p.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      // Panneau rangé dans un autre : le plus proche du doigt change seul de page.
      if (e.__e360Glisse) return;
      var d = p.__e360Decoupe && p.__e360Decoupe();
      if (!d) return;
      e.__e360Glisse = true;
      var noms = d.pages.map(function (pg) { return pg.nom; });
      var i = noms.indexOf(choixOnglet[d.cle]);
      if (i < 0) i = 0;
      var j = Math.max(0, Math.min(noms.length - 1, i + (dx < 0 ? 1 : -1)));
      if (j !== i) montrerOnglet(p, d, noms[j], dx < 0 ? "droite" : "gauche");
    }, { passive: true });
  }

  function appliquerOnglets(p, decoupe) {
    var d = decoupe();
    var barre = p.querySelector(":scope > .e360-onglets");
    if (!d) {
      if (barre) barre.remove();
      p.removeAttribute("data-e360-page");
      Array.prototype.forEach.call(p.querySelectorAll("[data-e360-hors-onglet]"), function (el) { el.removeAttribute("data-e360-hors-onglet"); });
      return;
    }
    p.__e360Decoupe = decoupe;
    var noms = d.pages.map(function (pg) { return pg.nom; });
    if (!barre || barre.getAttribute("data-noms") !== noms.join("|")) {
      if (barre) barre.remove();
      barre = document.createElement("div");
      barre.className = "e360-onglets";
      barre.setAttribute("role", "tablist");
      barre.setAttribute("data-noms", noms.join("|"));
      noms.forEach(function (nom) {
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("role", "tab");
        b.setAttribute("data-onglet", nom);
        b.textContent = nom;
        b.addEventListener("click", function () { var dd = p.__e360Decoupe && p.__e360Decoupe(); if (dd) montrerOnglet(p, dd, nom, null); });
        barre.appendChild(b);
      });
    }
    if (barre.nextElementSibling !== d.avant) p.insertBefore(barre, d.avant);
    if (!p.hasAttribute("data-e360-glisse")) { p.setAttribute("data-e360-glisse", ""); glisser(p); }
    montrerOnglet(p, d, noms.indexOf(choixOnglet[d.cle]) >= 0 ? choixOnglet[d.cle] : noms[0], null);
  }

  function ongletsPanneaux(root) {
    var vus = [];
    root.querySelectorAll("div").forEach(function (p) {
      if (p.classList.contains("e360-onglets") || p.closest("[data-e360='colonne'], [data-e360='accueil'], .e360-menu")) return;
      var grands = 0, petits = 0, premierEnfant = p.firstElementChild;
      for (var k = premierEnfant; k; k = k.nextElementSibling) {
        if (rubriqueDe(k) !== null) grands++;
        else if (libelleDe(k) !== null) petits++;
      }
      if (grands >= 2) { vus.push([p, function () { return decouper(p, false); }]); return; }
      // Réglages de la scène.
      if (p.children.length >= 2 && p.style.borderTop && p.style.display === "flex") {
        var c0 = Array.prototype.filter.call(p.children, function (k) { return !k.classList.contains("e360-onglets"); })[0];
        var l0 = c0 && c0.firstElementChild;
        if (l0 && l0.style.textTransform === "uppercase" && /narration/i.test(l0.textContent || "")) {
          p.setAttribute("data-e360-scene", "");
          poignee(p);
          vus.push([p, function () { return decouperScene(p); }]);
          return;
        }
      }
      // Formulaire d'une fenêtre ou d'un panneau qui défile : un libellé par champ.
      var fenetre = p.parentElement && p.parentElement.style.position === "fixed";
      var defile = p.style.overflowY === "auto" || p.style.overflow === "auto";
      if (petits + grands >= 4 && (fenetre || defile) && !(p.parentElement && p.parentElement.closest("[data-e360-glisse]"))) {
        vus.push([p, function () { return decouper(p, true); }]);
      }
    });
    vus.forEach(function (v) { appliquerOnglets(v[0], v[1]); });
  }

  // ---------- Petits panneaux de réglage de l'éditeur ----------
  function ouvrirPanneau(titre, construire) {
    var fond = document.createElement("div");
    fond.className = "e360-panneau-fond";
    var p = document.createElement("div");
    p.className = "e360-panneau";
    var t = document.createElement("div");
    t.className = "e360-panneau-titre";
    t.textContent = titre;
    var x = document.createElement("button");
    x.type = "button"; x.className = "e360-panneau-x"; x.textContent = "✕"; x.setAttribute("aria-label", "Fermer");
    x.addEventListener("click", function () { fond.remove(); });
    t.appendChild(x);
    p.appendChild(t);
    var corps = document.createElement("div");
    corps.className = "e360-panneau-corps";
    p.appendChild(corps);
    fond.appendChild(p);
    fond.addEventListener("click", function (e) { if (e.target === fond) fond.remove(); });
    document.body.appendChild(fond);
    var redessiner = function () { corps.textContent = ""; construire(corps, redessiner); };
    redessiner();
  }
  function choixEnLigne(parent, titre, options, actuel, choisir) {
    var l = document.createElement("div"); l.className = "e360-p-libelle"; l.textContent = titre; parent.appendChild(l);
    var r = document.createElement("div"); r.className = "e360-p-choix"; parent.appendChild(r);
    options.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "e360-p-bouton" + (o[0] === actuel ? " on" : "");
      if (o[2]) { b.style.background = o[2]; b.setAttribute("aria-label", o[1]); b.classList.add("e360-p-pastille"); }
      else b.textContent = o[1];
      b.addEventListener("click", function () { choisir(o[0]); });
      r.appendChild(b);
    });
  }

  // ---------- Apparence de l'éditeur : thème, couleur d'accent, taille du texte ----------
  var ACCENTS = [["#E8A33D", "Ambre"], ["#4FA3E0", "Bleu"], ["#5CC48A", "Vert"], ["#D9636B", "Rouge"], ["#A77BE0", "Violet"], ["#E07BB4", "Rose"]];
  function appliquerApparence() {
    var a = lireReglage("e360-apparence", {});
    var html = document.documentElement;
    ["clair", "sepia"].forEach(function (t) { html.classList.toggle("e360-theme-" + t, a.theme === t); });
    ["grand", "tres-grand"].forEach(function (t) { html.classList.toggle("e360-texte-" + t, a.texte === t); });
    if (a.accent && a.accent !== "#E8A33D") {
      html.style.setProperty("--accent", a.accent);
      html.setAttribute("data-e360-accent", "");
    } else { html.style.removeProperty("--accent"); html.removeAttribute("data-e360-accent"); }
  }
  function panneauApparence() {
    ouvrirPanneau("Apparence de l'éditeur", function (c, redessiner) {
      var a = lireReglage("e360-apparence", {});
      var change = function (patch) { for (var k in patch) a[k] = patch[k]; ecrireReglage("e360-apparence", a); appliquerApparence(); redessiner(); };
      choixEnLigne(c, "Thème", [["sombre", "Sombre"], ["clair", "Clair"], ["sepia", "Sépia"]], a.theme || "sombre", function (v) { change({ theme: v }); });
      choixEnLigne(c, "Couleur d'accent", ACCENTS.map(function (x) { return [x[0], x[1], x[0]]; }), a.accent || "#E8A33D", function (v) { change({ accent: v }); });
      choixEnLigne(c, "Taille du texte", [["normal", "Normale"], ["grand", "Grande"], ["tres-grand", "Très grande"]], a.texte || "normal", function (v) { change({ texte: v }); });
      var n = document.createElement("p"); n.className = "e360-p-note";
      n.textContent = "Le thème ne change que l'éditeur : le jeu garde ses propres couleurs.";
      c.appendChild(n);
    });
  }
  appliquerApparence();

  // ---------- Personnaliser la barre du haut ----------
  function panneauBarre() {
    ouvrirPanneau("Personnaliser la barre", function (c, redessiner) {
      var prefs = lireReglage("e360-barre", {});
      var liste = BARRE.map(function (b, i) {
        var p = prefs[b[0]] || {};
        return { cle: b[0], nom: LIBELLES_MENU[b[0]] || b[1], place: p.place || (b[2] ? "menu" : "barre"), ordre: p.ordre != null ? p.ordre : i };
      }).sort(function (x, y) { return x.ordre - y.ordre; });
      var ecrire = function () {
        var out = {};
        liste.forEach(function (x, i) { out[x.cle] = { place: x.place, ordre: i }; });
        ecrireReglage("e360-barre", out);
        planifier();
        redessiner();
      };
      var n = document.createElement("p"); n.className = "e360-p-note";
      n.textContent = "Ce qui est « dans la barre » reste visible en haut ; le reste passe dans le menu •••. Les flèches changent l'ordre.";
      c.appendChild(n);
      liste.forEach(function (x, i) {
        var l = document.createElement("div"); l.className = "e360-p-ligne";
        var nom = document.createElement("span"); nom.textContent = x.nom; l.appendChild(nom);
        var place = document.createElement("button"); place.type = "button";
        place.className = "e360-p-bouton" + (x.place === "barre" ? " on" : "");
        place.textContent = x.place === "barre" ? "Dans la barre" : "Dans •••";
        place.addEventListener("click", function () { x.place = x.place === "barre" ? "menu" : "barre"; ecrire(); });
        l.appendChild(place);
        [["↑", -1], ["↓", 1]].forEach(function (f) {
          var b = document.createElement("button"); b.type = "button"; b.className = "e360-p-bouton"; b.textContent = f[0];
          b.disabled = (i === 0 && f[1] < 0) || (i === liste.length - 1 && f[1] > 0);
          b.addEventListener("click", function () { var j = i + f[1]; var t = liste[i]; liste[i] = liste[j]; liste[j] = t; ecrire(); });
          l.appendChild(b);
        });
        c.appendChild(l);
      });
      var raz = document.createElement("button"); raz.type = "button"; raz.className = "e360-p-bouton"; raz.textContent = "Revenir à la barre d'origine";
      raz.addEventListener("click", function () { ecrireReglage("e360-barre", {}); planifier(); redessiner(); });
      c.appendChild(raz);
    });
  }

  // ---------- Double toucher de l'Apple Pencil ----------
  var ACTIONS_CRAYON = [["annuler", "Annuler"], ["vue", "Passer de la Liste à la Carte"], ["point", "Ajouter un point"], ["tester", "Tester la scène"], ["rien", "Rien"]];
  function panneauCrayon() {
    ouvrirPanneau("Double toucher du crayon", function (c, redessiner) {
      var a = lireReglage("e360-crayon", "annuler");
      var n = document.createElement("p"); n.className = "e360-p-note";
      n.textContent = "Ce que fait un double toucher sur le côté de l'Apple Pencil 2 pendant que tu travailles.";
      c.appendChild(n);
      ACTIONS_CRAYON.forEach(function (x) {
        var b = document.createElement("button"); b.type = "button";
        b.className = "e360-p-bouton e360-p-large" + (x[0] === a ? " on" : "");
        b.textContent = x[1];
        b.addEventListener("click", function () { ecrireReglage("e360-crayon", x[0]); redessiner(); });
        c.appendChild(b);
      });
    });
  }
  function boutonLibelle(debut) {
    var root = document.getElementById("root");
    return root && Array.prototype.filter.call(root.querySelectorAll("button"), function (b) { return b.offsetParent && libelle(b).indexOf(debut) === 0; })[0];
  }
  window.addEventListener("e360-crayon", function () {
    var a = lireReglage("e360-crayon", "annuler");
    var b = null;
    if (a === "annuler") b = document.querySelector("[data-e360-annuler]");
    else if (a === "point") b = boutonLibelle("Ajouter un point");
    else if (a === "tester") b = boutonLibelle("Tester la scène");
    else if (a === "vue") {
      var h = barreDuHaut(), v = h && h.querySelector("[data-e360='vues']");
      var dansListe = !!document.querySelector("[data-e360-scene]");
      b = v && Array.prototype.filter.call(v.querySelectorAll("button"), function (x) { return libelle(x) === (dansListe ? "Carte" : "Liste"); })[0];
    }
    if (b && !b.disabled) b.click();
  });

  // ---------- Barre réglable entre la vue 360 et les réglages de la scène ----------
  // Glisser vers le bas agrandit la vue, vers le haut les réglages ; deux touchers
  // rapides replient les réglages ou les rouvrent. La hauteur est retenue.
  var CLE_HAUTEUR = "e360:hauteur-reglages";
  function hauteurGardee() { try { return parseFloat(localStorage.getItem(CLE_HAUTEUR)) || 0; } catch (e) { return 0; } }
  function garderHauteur(h) { try { localStorage.setItem(CLE_HAUTEUR, String(Math.round(h))); } catch (e) {} }
  function poserHauteur(p, h) {
    var col = p.parentElement;
    // La vue 360 au-dessus doit pouvoir rétrécir : sans cela elle garde la taille
    // de son image et la barre ne remonte plus.
    var g = p.previousElementSibling, vue = g && g.previousElementSibling;
    if (vue && vue.style.minHeight !== "0px") { vue.style.minHeight = "0px"; vue.style.overflow = "hidden"; }
    var max = Math.max(120, (col ? col.clientHeight : window.innerHeight) - 240);
    h = Math.max(48, Math.min(max, h));
    p.style.height = Math.round(h) + "px";
    p.style.flex = "0 0 auto";
    return h;
  }
  function redimensionner() { try { window.dispatchEvent(new Event("resize")); } catch (e) {} }
  function poignee(p) {
    document.querySelectorAll(".e360-poignee").forEach(function (x) {
      if (!x.nextElementSibling || !x.nextElementSibling.hasAttribute("data-e360-scene")) x.remove();
    });
    var g = p.previousElementSibling;
    if (g && g.classList.contains("e360-poignee")) return;
    g = document.createElement("div");
    g.className = "e360-poignee";
    g.setAttribute("role", "separator");
    g.setAttribute("aria-label", "Glisser pour agrandir la vue 360");
    var y0 = 0, h0 = 0, tire = false, enCours = false, dernier = 0, avantRepli = 0;
    g.addEventListener("pointerdown", function (e) {
      e.preventDefault(); e.stopPropagation();
      try { g.setPointerCapture(e.pointerId); } catch (x) {}
      y0 = e.clientY; h0 = p.offsetHeight; tire = false; enCours = true;
    });
    g.addEventListener("pointermove", function (e) {
      if (!enCours) return;
      var dy = e.clientY - y0;
      if (!tire && Math.abs(dy) < 4) return;
      tire = true; g.classList.add("e360-tire");
      poserHauteur(p, h0 - dy);
      redimensionner();
    });
    var fin = function () {
      if (!enCours) return;
      enCours = false;
      g.classList.remove("e360-tire");
      if (tire) { garderHauteur(p.offsetHeight); redimensionner(); return; }
      var t = Date.now();
      if (t - dernier < 380) {
        if (p.offsetHeight > 70) { avantRepli = p.offsetHeight; poserHauteur(p, 48); }
        else poserHauteur(p, avantRepli || 280);
        garderHauteur(p.offsetHeight);
        redimensionner();
        dernier = 0;
      } else dernier = t;
    };
    g.addEventListener("pointerup", fin);
    g.addEventListener("pointercancel", fin);
    p.parentNode.insertBefore(g, p);
    var h = hauteurGardee();
    if (h) { poserHauteur(p, h); setTimeout(redimensionner, 60); }
  }

  // ---------- Un toucher bref déclenche le bouton tout de suite ----------
  // Safari perd parfois le clic quand la page change sous le doigt (survol simulé,
  // rendu en cours) : un bouton ne réagissait qu'une fois sur plusieurs. On le
  // déclenche nous-mêmes à la fin d'un toucher bref et immobile.
  var tape = null;
  document.addEventListener("touchstart", function (e) {
    tape = null;
    if (e.touches.length !== 1) return;
    var b = e.target.closest && e.target.closest("button, .e360-q");
    if (!b || b.disabled) return;
    var t = e.touches[0];
    tape = { b: b, x: t.clientX, y: t.clientY, t: Date.now() };
  }, { passive: true, capture: true });
  document.addEventListener("touchmove", function (e) {
    if (!tape) return;
    var t = e.touches[0];
    if (Math.abs(t.clientX - tape.x) + Math.abs(t.clientY - tape.y) > 12) tape = null;
  }, { passive: true, capture: true });
  document.addEventListener("touchcancel", function () { tape = null; }, { capture: true });
  document.addEventListener("touchend", function (e) {
    var d = tape; tape = null;
    if (!d || e.touches.length || Date.now() - d.t > 700 || !d.b.isConnected || d.b.disabled) return;
    var t = e.changedTouches[0];
    var sous = document.elementFromPoint(t.clientX, t.clientY);
    if (!sous || !(sous === d.b || d.b.contains(sous))) return;
    e.preventDefault();          // pas de clic simulé derrière : il compterait deux fois
    d.b.click();
  }, { passive: false, capture: true });

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
    ongletsPanneaux(root);
  }
  // Une passe au plus toutes les 180 ms : sur iPad, chaque passe parcourt toute la page.
  var dernierePasse = 0;
  function planifier() {
    if (prevu) return;
    prevu = true;
    var attente = Math.max(0, 180 - (Date.now() - dernierePasse));
    if (attente > 0) { setTimeout(function () { prevu = false; planifier(); }, attente); return; }
    dernierePasse = Date.now();
    // Une seule passe, à l'image suivante ; la minuterie sert de filet si les images
    // sont suspendues (vue en arrière-plan).
    var fait = false;
    var une = function () { if (!fait) { fait = true; passe(); } };
    requestAnimationFrame(une);
    setTimeout(une, 150);
  }

  // Ce qui bouge sans cesse (éditeur de nœuds, plateau, vue 360, aperçus) ne relance pas l'habillage.
  var ZONES_CALMES = "[data-cb-nodes], .pz-native, [data-dlg-canvas], [data-carte-plateau], [data-hud-el], canvas, svg, iframe";
  function observer(recs) {
    for (var i = 0; i < recs.length; i++) {
      var t = recs[i].target, el = t && t.nodeType === 1 ? t : t && t.parentElement;
      if (!el || !el.closest || !el.closest(ZONES_CALMES)) { planifier(); return; }
    }
  }
  function demarrer() {
    var root = document.getElementById("root");
    if (!root) return;
    new MutationObserver(observer).observe(root, { childList: true, subtree: true, characterData: true });
    planifier();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer);
  else demarrer();
})();
