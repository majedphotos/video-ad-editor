// يلقى نص مكتوب بالفريم (ملصق، شاشة، رقم على المنتج) ويطلّع مربعه بالضبط — Vision المدمج بالماك
// textfind <inDir> <query|re:regex|*> [fast|accurate]
//   query: النص المطلوب (بلا فرق حروف كبيرة/صغيرة ومسافات) — يطلّع مربع النص نفسه بس (مو السطر كله)
//   * = كل النصوص بالفريم (للاستكشاف)
// المخرج JSON لكل فريم: [{f, hits:[{t, c, q:[[x,y]x4]}]}] — q بالبكسل، الأصل فوق يسار، الترتيب: فوق يسار ← فوق يمين ← تحت يمين ← تحت يسار
import Foundation
import Vision
import CoreImage

let a = CommandLine.arguments
guard a.count >= 3 else { print("usage: textfind <inDir> <query|*> [fast|accurate]"); exit(2) }
let inDir = a[1], query = a[2], fast = a.count > 3 && a[3] == "fast"
let norm: (String) -> String = { s in
    s.lowercased().replacingOccurrences(of: " ", with: "")
}
let q = norm(query)
let files = (try FileManager.default.contentsOfDirectory(atPath: inDir)).filter { $0.hasSuffix(".jpg") || $0.hasSuffix(".png") }.sorted()
var out: [[String: Any]] = []
for f in files {
    guard let img = CIImage(contentsOf: URL(fileURLWithPath: inDir + "/" + f)) else { FileHandle.standardError.write("⚠️ ما انقرى \(f)\n".data(using: .utf8)!); continue }
    let W = img.extent.width, H = img.extent.height
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = fast ? .fast : .accurate
    req.usesLanguageCorrection = false
    req.minimumTextHeight = 0.008
    if ProcessInfo.processInfo.environment["TF_CPU"] == "1" { req.usesCPUOnly = true }
    let h = VNImageRequestHandler(ciImage: img, options: [:])
    do { try h.perform([req]) } catch { FileHandle.standardError.write("⚠️ \(f): \(error)\n".data(using: .utf8)!); continue }
    var hits: [[String: Any]] = []
    for obs in (req.results ?? []) {
        for cand in obs.topCandidates(3) {
            let s = cand.string
            var rng: Range<String.Index>? = nil
            if q == "*" { rng = s.startIndex..<s.endIndex }
            else if query.hasPrefix("re:") {          // re:<تعبير> — الكلمة اللي يقرأها غلط (90Wh ← sawh): مكانها من اللي حولها
                let pat = String(query.dropFirst(3))
                if let re = try? NSRegularExpression(pattern: pat, options: [.caseInsensitive]),
                   let m = re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) {
                    let nr = m.numberOfRanges > 1 && m.range(at: 1).location != NSNotFound ? m.range(at: 1) : m.range
                    rng = Range(nr, in: s)
                }
            }
            else {
                // نطابق بلا مسافات: نلقى مكان أول حرف وآخر حرف بالنص الأصلي
                let chars = Array(s); var map: [Int] = []; var flat = ""
                for (i, ch) in chars.enumerated() where ch != " " { flat += String(ch).lowercased(); map.append(i) }
                if let r = flat.range(of: q) {
                    let i0 = flat.distance(from: flat.startIndex, to: r.lowerBound)
                    let i1 = flat.distance(from: flat.startIndex, to: r.upperBound) - 1
                    let a0 = s.index(s.startIndex, offsetBy: map[i0]), a1 = s.index(s.startIndex, offsetBy: map[i1] + 1)
                    rng = a0..<a1
                }
            }
            guard let r = rng, let box = try? cand.boundingBox(for: r) else { continue }
            let P: (CGPoint) -> [Double] = { p in [Double(p.x * W), Double((1 - p.y) * H)] }
            // Vision أحياناً يرجّع مربع السطر كله للجزء — نرجّع السطر ومكان الجزء فيه (a,b بالحروف) و43_textbox.py يقصّه بالنسبة
            let lb = (try? cand.boundingBox(for: s.startIndex..<s.endIndex)) ?? box
            hits.append(["t": String(s[r]), "c": Double(cand.confidence), "line": s,
                         "a": s.distance(from: s.startIndex, to: r.lowerBound), "b": s.distance(from: s.startIndex, to: r.upperBound),
                         "q": [P(box.topLeft), P(box.topRight), P(box.bottomRight), P(box.bottomLeft)],
                         "lq": [P(lb.topLeft), P(lb.topRight), P(lb.bottomRight), P(lb.bottomLeft)]])
            break
        }
    }
    out.append(["f": f, "hits": hits])
}
let d = try JSONSerialization.data(withJSONObject: out, options: [])
FileHandle.standardOutput.write(d)
