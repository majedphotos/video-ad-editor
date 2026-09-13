// راصد الوجه والفم — يشتغل بمكتبة ماك المدمجة (Vision)
// facetrack <inDir> <out.json>
// لكل صورة: مستطيل الوجه الأكبر (نسبي 0..1 · الأصل أعلى يسار) + فتحة الفم (نسبة لارتفاع الوجه)
// يُستخدم بوضع البودكاست: من يتكلم (حركة الفم) · مكان الوجه (القصّ) · هل الكاميرتان لنفس الشخص
import Foundation
import Vision
import CoreImage

let a = CommandLine.arguments
guard a.count >= 3 else { print("usage: facetrack <inDir> <out.json>"); exit(2) }
let inDir = a[1], outPath = a[2]
let files = (try FileManager.default.contentsOfDirectory(atPath: inDir))
    .filter { $0.hasSuffix(".jpg") }.sorted()
var rows: [[String: Any]] = []
let req = VNDetectFaceLandmarksRequest()
for f in files {
    guard let img = CIImage(contentsOf: URL(fileURLWithPath: inDir + "/" + f)) else { continue }
    let h = VNImageRequestHandler(ciImage: img, options: [:])
    do { try h.perform([req]) } catch { continue }
    var row: [String: Any] = ["f": f]
    if let faces = req.results as? [VNFaceObservation], !faces.isEmpty {
        let fo = faces.max { $0.boundingBox.width * $0.boundingBox.height < $1.boundingBox.width * $1.boundingBox.height }!
        let b = fo.boundingBox
        row["face"] = ["x": b.minX, "y": 1 - b.maxY, "w": b.width, "h": b.height]
        if let lips = fo.landmarks?.innerLips {
            let pts = lips.normalizedPoints            // نسبية لمستطيل الوجه
            let ys = pts.map { $0.y }
            if let mx = ys.max(), let mn = ys.min() { row["mouth"] = Double(mx - mn) }
        }
        row["n"] = faces.count
    }
    rows.append(row)
}
let data = try JSONSerialization.data(withJSONObject: rows, options: [])
try data.write(to: URL(fileURLWithPath: outPath))
print("faces: \(rows.count)")
