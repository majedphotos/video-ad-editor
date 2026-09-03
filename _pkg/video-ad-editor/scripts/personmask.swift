// قصّ الشخص من كل فريم + بيانات الوجه — يشتغل بمكتبة ماك المدمجة (Vision)
// personmask <inDir> <outDir> [fast|balanced|accurate] [feather]
import Foundation
import Vision
import CoreImage

let a = CommandLine.arguments
guard a.count >= 3 else { print("usage: personmask <inDir> <outDir> [quality] [feather]"); exit(2) }
let inDir = a[1], outDir = a[2], q = a.count > 3 ? a[3] : "accurate"
let feather = a.count > 4 ? Double(a[4]) ?? 2.5 : 2.5
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
let ctx = CIContext(options: [.useSoftwareRenderer: false])
let files = (try FileManager.default.contentsOfDirectory(atPath: inDir))
    .filter { $0.hasSuffix(".jpg") }.sorted()
let seg = VNGeneratePersonSegmentationRequest()
seg.qualityLevel = q == "fast" ? .fast : (q == "balanced" ? .balanced : .accurate)
seg.outputPixelFormat = kCVPixelFormatType_OneComponent8
let face = VNDetectFaceRectanglesRequest()

var meta: [[String: Any]] = []
for f in files {
    guard let img = CIImage(contentsOf: URL(fileURLWithPath: inDir + "/" + f)) else { continue }
    let W = img.extent.width, H = img.extent.height
    let h = VNImageRequestHandler(ciImage: img, options: [:])
    do { try h.perform([seg, face]) } catch { continue }
    guard let obs = seg.results?.first as? VNPixelBufferObservation else { continue }
    var m = CIImage(cvPixelBuffer: obs.pixelBuffer)
    m = m.transformed(by: CGAffineTransform(scaleX: W / m.extent.width, y: H / m.extent.height))
    if feather > 0 {                                  // حواف ناعمة بدل الحادة
        m = m.clampedToExtent()
             .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: feather])
             .cropped(to: CGRect(x: 0, y: 0, width: W, height: H))
    }
    let out = URL(fileURLWithPath: outDir + "/" + f.replacingOccurrences(of: ".jpg", with: ".png"))
    try? ctx.writePNGRepresentation(of: m, to: out, format: .L8, colorSpace: CGColorSpaceCreateDeviceGray())

    var row: [String: Any] = ["f": f]
    if let fo = (face.results as? [VNFaceObservation])?.max(by: { $0.boundingBox.width < $1.boundingBox.width }) {
        let b = fo.boundingBox                        // Vision: أصل الإحداثيات أسفل يسار ونسبي
        row["face"] = ["x": b.minX * W, "y": (1 - b.maxY) * H, "w": b.width * W, "h": b.height * H]
    }
    meta.append(row)
}
let mj = try JSONSerialization.data(withJSONObject: meta, options: [])
try mj.write(to: URL(fileURLWithPath: outDir + "/meta.json"))
print("masks: \(meta.count)")
