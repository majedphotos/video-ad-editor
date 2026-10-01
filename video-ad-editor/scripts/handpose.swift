// handpose <dir> <f0> <f1> <out.json> — مركز الكف (الرسغ + مفاصل الأصابع) لكل فريم %05d.jpg بـVision (ماك، ببلاش)
import Foundation
import Vision
import CoreImage
let a=CommandLine.arguments; let dir=a[1]; let f0=Int(a[2])!, f1=Int(a[3])!
var out:[[String:Any]]=[]
for i in f0...f1 {
  let p=String(format:"%@/%05d.jpg",dir,i)
  guard let img=CIImage(contentsOf:URL(fileURLWithPath:p)) else { continue }
  let W=img.extent.width,H=img.extent.height
  let r=VNDetectHumanHandPoseRequest(); r.maximumHandCount=2
  try? VNImageRequestHandler(ciImage:img,options:[:]).perform([r])
  var hands:[[String:Double]]=[]
  for o in r.results ?? [] {
    guard let pts=try? o.recognizedPoints(.all) else { continue }
    func P(_ n:VNHumanHandPoseObservation.JointName)->(Double,Double,Double)? { guard let q=pts[n], q.confidence>0.3 else {return nil}; return (Double(q.location.x*W),Double((1-q.location.y)*H),Double(q.confidence)) }
    let js:[VNHumanHandPoseObservation.JointName]=[.wrist,.indexMCP,.middleMCP,.ringMCP,.littleMCP]
    let v=js.compactMap{P($0)}; if v.count<3 { continue }
    let x=v.map{$0.0}.reduce(0,+)/Double(v.count), y=v.map{$0.1}.reduce(0,+)/Double(v.count), c=v.map{$0.2}.reduce(0,+)/Double(v.count)
    hands.append(["x":x,"y":y,"c":c])
  }
  out.append(["f":i,"hands":hands])
}
let d=try! JSONSerialization.data(withJSONObject:out); FileManager.default.createFile(atPath:a[4],contents:d)
print("ok",out.count)
