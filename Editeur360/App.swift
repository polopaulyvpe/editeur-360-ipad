import UIKit
import WebKit
import UniformTypeIdentifiers

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
final class Stockage {
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
    private let fichiers = Fichiers()

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
    }

    // window.storage.get / set / delete
    func userContentController(_ ctl: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let d = message.body as? [String: Any], let op = d["op"] as? String else { replyHandler(nil, "requête"); return }
        let cle = d["key"] as? String ?? ""
        switch op {
        case "get": replyHandler(stockage.lire(cle), nil)
        case "set": replyHandler(stockage.ecrire(cle, d["value"] as? String ?? ""), nil)
        case "delete": stockage.supprimer(cle); replyHandler(true, nil)
        case "where": replyHandler("Fichiers › Sur mon iPad › Éditeur 360 › Editeur 360", nil)
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
