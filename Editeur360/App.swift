import UIKit
import WebKit
import UniformTypeIdentifiers
import Network

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let w = UIWindow(frame: UIScreen.main.bounds)
        w.rootViewController = EditeurViewController()
        w.makeKeyAndVisible()
        window = w
        return true
    }
}

/// Le stockage sur disque : la même répartition que l'appli PC.
///   library      -> Documents/Editeur 360/library.json
///   game:<id>    -> Documents/Editeur 360/jeux/<id>/game.json
/// Le dossier Documents est visible dans l'app Fichiers (« Sur mon iPad »).
/// Sans état modifiable : utilisable depuis la file d'écriture en arrière-plan.
final class Stockage: @unchecked Sendable {
    let racine: URL
    init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        racine = docs.appendingPathComponent("Editeur 360", isDirectory: true)
        try? FileManager.default.createDirectory(at: racine, withIntermediateDirectories: true)
    }
    private func propre(_ s: String) -> String {
        let ok = Set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-")
        let c = String(String(s.map { ok.contains($0) ? $0 : "_" }).prefix(80))
        return c.isEmpty ? "sans_nom" : c
    }
    private func fichier(_ cle: String) -> URL {
        if cle.hasPrefix("game:") {
            return racine.appendingPathComponent("jeux", isDirectory: true)
                .appendingPathComponent(propre(String(cle.dropFirst(5))), isDirectory: true)
                .appendingPathComponent("game.json")
        }
        return racine.appendingPathComponent(propre(cle) + ".json")
    }
    func lire(_ cle: String) -> String? {
        try? String(contentsOf: fichier(cle), encoding: .utf8)
    }
    func ecrire(_ cle: String, _ valeur: String) -> Bool {
        let f = fichier(cle)
        do {
            try FileManager.default.createDirectory(at: f.deletingLastPathComponent(), withIntermediateDirectories: true)
            try valeur.data(using: .utf8)!.write(to: f, options: .atomic)   // jamais un fichier à moitié écrit
            return true
        } catch { NSLog("écriture %@ : %@", cle, "\(error)"); return false }
    }
    func supprimer(_ cle: String) {
        let f = fichier(cle)
        try? FileManager.default.removeItem(at: f)
        if cle.hasPrefix("game:") { try? FileManager.default.removeItem(at: f.deletingLastPathComponent()) }
    }
}

/// Transfert par Wi-Fi : un petit serveur, ouvert seulement pendant que le panneau
/// est affiché. L'adresse contient un code aléatoire, renouvelé à chaque ouverture.
final class ServeurTransfert: @unchecked Sendable {
    let racine: URL
    private let file = DispatchQueue(label: "editeur360.transfert")
    private var ecoute: NWListener?
    private var jeton = ""
    var surRecu: (() -> Void)?
    private final class Tampon { var d = Data() }

    init(racine: URL) { self.racine = racine }

    private static func adresseIP() -> String? {
        var res: String?
        var liste: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&liste) == 0, let premier = liste else { return nil }
        defer { freeifaddrs(liste) }
        for p in sequence(first: premier, next: { $0.pointee.ifa_next }) {
            let i = p.pointee
            guard let a = i.ifa_addr, a.pointee.sa_family == UInt8(AF_INET), String(cString: i.ifa_name) == "en0" else { continue }
            var h = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            if getnameinfo(a, socklen_t(a.pointee.sa_len), &h, socklen_t(h.count), nil, 0, NI_NUMERICHOST) == 0 { res = String(cString: h) }
        }
        return res
    }

    func demarrer() -> String? {
        arreter()
        guard let ip = ServeurTransfert.adresseIP(), let port = NWEndpoint.Port(rawValue: 8360),
              let l = try? NWListener(using: .tcp, on: port) else { return nil }
        jeton = String(UUID().uuidString.prefix(6)).lowercased()
        l.newConnectionHandler = { [weak self] c in
            guard let self = self else { c.cancel(); return }
            c.start(queue: self.file)
            self.lire(c, Tampon())
        }
        l.start(queue: file)
        ecoute = l
        return "http://\(ip):8360/\(jeton)/"
    }

    func arreter() { ecoute?.cancel(); ecoute = nil }

    private func lire(_ c: NWConnection, _ t: Tampon) {
        c.receive(minimumIncompleteLength: 1, maximumLength: 1 << 20) { [weak self] d, _, fini, err in
            guard let self = self else { c.cancel(); return }
            if let d = d { t.d.append(d) }
            if let r = t.d.range(of: Data("\r\n\r\n".utf8)) {
                let lignes = String(decoding: t.d[t.d.startIndex..<r.lowerBound], as: UTF8.self).components(separatedBy: "\r\n")
                var taille = 0
                for l in lignes.dropFirst() where l.lowercased().hasPrefix("content-length:") {
                    taille = Int(l.dropFirst(15).trimmingCharacters(in: .whitespaces)) ?? 0
                }
                let recu = t.d.distance(from: r.upperBound, to: t.d.endIndex)
                if recu >= taille {
                    self.repondre(c, lignes[0], t.d.subdata(in: r.upperBound..<t.d.index(r.upperBound, offsetBy: taille)))
                    return
                }
            }
            if fini || err != nil { c.cancel(); return }
            self.lire(c, t)
        }
    }

    private func envoyer(_ c: NWConnection, _ etat: String, _ type: String, _ corps: Data, _ plus: String = "") {
        var tete = Data("HTTP/1.1 \(etat)\r\nContent-Type: \(type)\r\nContent-Length: \(corps.count)\r\n\(plus)Connection: close\r\n\r\n".utf8)
        tete.append(corps)
        c.send(content: tete, completion: .contentProcessed { _ in c.cancel() })
    }

    private func repondre(_ c: NWConnection, _ ligne: String, _ corps: Data) {
        let m = ligne.components(separatedBy: " ")
        guard m.count >= 2, m[1].hasPrefix("/\(jeton)/") else {
            envoyer(c, "404 Not Found", "text/plain", Data("Adresse inconnue".utf8)); return
        }
        let chemin = String(m[1].dropFirst(jeton.count + 2))
        if m[0] == "GET" && chemin.isEmpty {
            envoyer(c, "200 OK", "text/html; charset=utf-8", Data(ServeurTransfert.page.utf8)); return
        }
        if m[0] == "GET" && chemin == "liste" {
            let bib = (try? Data(contentsOf: racine.appendingPathComponent("library.json"))) ?? Data("[]".utf8)
            envoyer(c, "200 OK", "application/json", bib); return
        }
        if m[0] == "GET" && chemin.hasPrefix("jeu/") {
            let ok = Set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-")
            let id = String(chemin.dropFirst(4))
            let f = racine.appendingPathComponent("jeux", isDirectory: true).appendingPathComponent(id, isDirectory: true).appendingPathComponent("game.json")
            guard id.allSatisfy({ ok.contains($0) }), let d = try? Data(contentsOf: f) else {
                envoyer(c, "404 Not Found", "text/plain", Data("Jeu introuvable".utf8)); return
            }
            envoyer(c, "200 OK", "application/json", d, "Content-Disposition: attachment; filename=\"\(id).json\"\r\n"); return
        }
        if m[0] == "POST" && chemin == "envoi" {
            do {
                try corps.write(to: racine.appendingPathComponent("recu.json"), options: .atomic)
                envoyer(c, "200 OK", "text/plain", Data("ok".utf8))
                DispatchQueue.main.async { [weak self] in self?.surRecu?() }
            } catch { envoyer(c, "500 Error", "text/plain", Data("Écriture impossible".utf8)) }
            return
        }
        envoyer(c, "404 Not Found", "text/plain", Data("Adresse inconnue".utf8))
    }

    private static let page = #"""
    <!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Éditeur 360 : transfert</title>
    <style>body{font:16px system-ui,sans-serif;background:#0d1117;color:#e9e6dd;max-width:640px;margin:30px auto;padding:0 16px}a,button{display:inline-block;background:#e8a33d;color:#111;border:none;border-radius:8px;padding:8px 14px;text-decoration:none;font:inherit;cursor:pointer}li{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #2a3040}ul{list-style:none;padding:0}</style>
    <h1>Éditeur 360</h1><h2>Récupérer un jeu</h2><ul id="l"></ul>
    <h2>Envoyer un projet vers l'iPad</h2><input type="file" id="f" accept=".json"> <button id="b">Envoyer</button><p id="m"></p>
    <script>
    fetch('liste').then(r=>r.json()).then(d=>{const a=Array.isArray(d)?d:(d.games||d.entries||[]);const u=document.getElementById('l');if(!a.length)u.textContent='Aucun jeu.';a.forEach(j=>{const i=document.createElement('li'),s=document.createElement('span'),l=document.createElement('a');s.textContent=j.title||j.id;l.textContent='Télécharger';l.href='jeu/'+encodeURIComponent(j.id);l.download=(j.title||j.id)+'.json';i.append(s,l);u.append(i)})});
    document.getElementById('b').onclick=()=>{const f=document.getElementById('f').files[0],m=document.getElementById('m');if(!f){m.textContent='Choisis un fichier.';return}m.textContent='Envoi…';fetch('envoi',{method:'POST',body:f}).then(r=>{m.textContent=r.ok?'Reçu : regarde sur l’iPad.':'Échec.'}).catch(()=>{m.textContent='Échec.'})};
    </script></html>
    """#
}

/// Sert les fichiers de l'appli sous app://editeur/… : une vraie origine, pour
/// que blob:, fetch et WebGL se comportent comme dans un navigateur.
final class Fichiers: NSObject, WKURLSchemeHandler {
    let dossier = Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true)
    func webView(_ webView: WKWebView, start tache: WKURLSchemeTask) {
        guard let url = tache.request.url else { return }
        var chemin = url.path
        if chemin.isEmpty || chemin == "/" { chemin = "/index.html" }
        let f = dossier.appendingPathComponent(String(chemin.dropFirst()))
        guard f.path.hasPrefix(dossier.path), let data = try? Data(contentsOf: f) else {
            tache.didReceive(HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: nil)!)
            tache.didFinish(); return
        }
        let type: String
        switch f.pathExtension.lowercased() {
        case "html": type = "text/html; charset=utf-8"
        case "js": type = "text/javascript; charset=utf-8"
        case "css": type = "text/css"
        case "json": type = "application/json"
        case "png": type = "image/png"
        default: type = "application/octet-stream"
        }
        let rep = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                  headerFields: ["Content-Type": type, "Content-Length": "\(data.count)"])!
        tache.didReceive(rep); tache.didReceive(data); tache.didFinish()
    }
    func webView(_ webView: WKWebView, stop tache: WKURLSchemeTask) {}
}

final class EditeurViewController: UIViewController, WKScriptMessageHandlerWithReply,
                                   WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate {
    private var web: WKWebView!
    private let stockage = Stockage()
    private let fileStockage = DispatchQueue(label: "editeur360.stockage", qos: .userInitiated)
    private let fichiers = Fichiers()
    private var serveur: ServeurTransfert?

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    override func loadView() {
        let conf = WKWebViewConfiguration()
        conf.setURLSchemeHandler(fichiers, forURLScheme: "app")
        conf.allowsInlineMediaPlayback = true
        conf.mediaTypesRequiringUserActionForPlayback = []
        let ctl = conf.userContentController
        ctl.addScriptMessageHandler(self, contentWorld: .page, name: "storage")
        ctl.add(self, name: "fichier")
        if let u = Bundle.main.url(forResource: "pont", withExtension: "js", subdirectory: "web"),
           let src = try? String(contentsOf: u, encoding: .utf8) {
            ctl.addUserScript(WKUserScript(source: src, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        web = WKWebView(frame: .zero, configuration: conf)
        web.uiDelegate = self
        web.navigationDelegate = self
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 13/255, green: 17/255, blue: 23/255, alpha: 1)
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { web.isInspectable = true }
        view = web
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        web.load(URLRequest(url: URL(string: "app://editeur/index.html")!))
        // Double toucher sur l'Apple Pencil 2 : la page choisit quoi en faire (habillage.js).
        let crayon = UIPencilInteraction()
        crayon.delegate = self
        view.addInteraction(crayon)
    }

    // window.storage.get / set / delete
    func userContentController(_ ctl: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let d = message.body as? [String: Any], let op = d["op"] as? String else { replyHandler(nil, "requête"); return }
        let cle = d["key"] as? String ?? ""
        // Lire et écrire un jeu (plusieurs dizaines de Mo) ne bloque plus l'écran :
        // une file à part, une opération après l'autre ; la réponse revient ensuite.
        let s = stockage
        switch op {
        case "get":
            fileStockage.async { let v = s.lire(cle); DispatchQueue.main.async { replyHandler(v, nil) } }
        case "set":
            let valeur = d["value"] as? String ?? ""
            fileStockage.async { let ok = s.ecrire(cle, valeur); DispatchQueue.main.async { replyHandler(ok, nil) } }
        case "delete":
            fileStockage.async { s.supprimer(cle); DispatchQueue.main.async { replyHandler(true, nil) } }
        case "where": replyHandler("Fichiers › Sur mon iPad › Éditeur 360 › Editeur 360", nil)
        case "transfert_start":
            if serveur == nil {
                let t = ServeurTransfert(racine: stockage.racine)
                t.surRecu = { [weak self] in
                    self?.web.evaluateJavaScript("window.dispatchEvent(new Event('e360-recu'))", completionHandler: nil)
                }
                serveur = t
            }
            let adresse = serveur?.demarrer()
            UIApplication.shared.isIdleTimerDisabled = adresse != nil   // l'écran reste allumé pendant le transfert
            replyHandler(adresse, nil)
        case "transfert_stop":
            serveur?.arreter()
            UIApplication.shared.isIdleTimerDisabled = false
            replyHandler(true, nil)
        default: replyHandler(nil, "inconnu")
        }
    }

    // Un fichier exporté : « Enregistrer dans Fichiers », AirDrop, mail…
    func userContentController(_ ctl: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "fichier", let d = message.body as? [String: Any],
              let b64 = d["donnees"] as? String, let data = Data(base64Encoded: b64) else { return }
        let nom = (d["nom"] as? String ?? "fichier").replacingOccurrences(of: "/", with: "_")
        let dossier = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try? FileManager.default.createDirectory(at: dossier, withIntermediateDirectories: true)
        let f = dossier.appendingPathComponent(nom)
        do { try data.write(to: f) } catch { return }
        let feuille = UIActivityViewController(activityItems: [f], applicationActivities: nil)
        if let pop = feuille.popoverPresentationController {   // obligatoire sur iPad
            pop.sourceView = view
            pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            pop.permittedArrowDirections = []
        }
        present(feuille, animated: true)
    }

    // Les liens externes (action « ouvrir un site ») partent dans Safari.
    func webView(_ webView: WKWebView, createWebViewWith c: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let u = action.request.url, u.scheme == "https" { UIApplication.shared.open(u) }
        return nil
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let u = action.request.url, u.scheme == "https" || u.scheme == "http" {
            UIApplication.shared.open(u); decisionHandler(.cancel); return
        }
        decisionHandler(.allow)
    }

    // alert / confirm / prompt : WKWebView ne les affiche pas tout seul.
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage m: String,
                 initiatedByFrame f: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: m, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage m: String,
                 initiatedByFrame f: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: m, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Annuler", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt p: String, defaultText: String?,
                 initiatedByFrame f: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let a = UIAlertController(title: nil, message: p, preferredStyle: .alert)
        a.addTextField { $0.text = defaultText }
        a.addAction(UIAlertAction(title: "Annuler", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
        present(a, animated: true)
    }

    // Si iPadOS a dû fermer la page (mémoire), on la rouvre.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
}

extension EditeurViewController: UIPencilInteractionDelegate {
    func pencilInteractionDidTap(_ interaction: UIPencilInteraction) {
        web.evaluateJavaScript("window.dispatchEvent(new Event('e360-crayon'))", completionHandler: nil)
    }
}
