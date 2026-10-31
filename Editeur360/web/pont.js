(function () {
  var h = window.webkit && window.webkit.messageHandlers;
  if (!h || !h.storage) return;
  window.storage = {
    get: function (key) {
      return h.storage.postMessage({ op: "get", key: String(key) }).then(function (v) {
        return v == null ? null : { value: v };
      });
    },
    set: function (key, value) {
      return h.storage.postMessage({ op: "set", key: String(key), value: String(value) }).then(function (ok) { return ok === true; });
    },
    delete: function (key) {
      return h.storage.postMessage({ op: "delete", key: String(key) }).then(function () { return true; });
    },
    where: function () { return h.storage.postMessage({ op: "where" }); }
  };
  // Un lien « télécharger » (exports .zip, .html, kit DA…) : sur iPad on passe le
  // fichier à l'appli, qui ouvre « Enregistrer dans Fichiers » / Partager.
  var clic = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var href = this.href || "";
    if (this.hasAttribute("download") && (href.indexOf("blob:") === 0 || href.indexOf("data:") === 0)) {
      var nom = this.getAttribute("download") || "fichier";
      fetch(href).then(function (r) { return r.blob(); }).then(function (b) {
        return new Promise(function (ok, ko) {
          var fr = new FileReader();
          fr.onload = function () { ok(String(fr.result)); };
          fr.onerror = ko;
          fr.readAsDataURL(b);
        });
      }).then(function (url) {
        h.fichier.postMessage({ nom: nom, donnees: url.slice(url.indexOf(",") + 1) });
      }).catch(function (e) { console.error("téléchargement", e); });
      return;
    }
    return clic.apply(this, arguments);
  };
})();
