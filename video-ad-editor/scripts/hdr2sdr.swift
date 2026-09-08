// hdr2sdr.swift — يحوّل فيديو HDR من الآيفون (HLG/Dolby Vision) إلى SDR بنفس مظهر أبل (AVFoundation يعمل tone mapping بنفسه)
// swiftc -O -o hdr2sdr hdr2sdr.swift && ./hdr2sdr in.mov out.mov
import AVFoundation
import Foundation
let args = CommandLine.arguments
guard args.count >= 3 else { print("usage: hdr2sdr <in> <out>"); exit(2) }
let inURL = URL(fileURLWithPath: args[1]), outURL = URL(fileURLWithPath: args[2])
try? FileManager.default.removeItem(at: outURL)
let asset = AVURLAsset(url: inURL)
let track = asset.tracks(withMediaType: .video).first!
let size = track.naturalSize.applying(track.preferredTransform)
let w = Int(abs(size.width)), h = Int(abs(size.height))
let reader = try! AVAssetReader(asset: asset)
// نطلب من القارئ إخراج BT.709 (SDR) — AVFoundation يطبّق التحويل اللوني الرسمي
let vout = AVAssetReaderTrackOutput(track: track, outputSettings: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
  AVVideoColorPropertiesKey: [AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
                              AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
                              AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2]])
vout.alwaysCopiesSampleData = false
reader.add(vout)
var aout: AVAssetReaderTrackOutput? = nil
if let at = asset.tracks(withMediaType: .audio).first {
  aout = AVAssetReaderTrackOutput(track: at, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM])
  reader.add(aout!)
}
let writer = try! AVAssetWriter(outputURL: outURL, fileType: .mov)
let vin = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: w, AVVideoHeightKey: h,
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 40_000_000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel],
  AVVideoColorPropertiesKey: [AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
                              AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
                              AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2]])
vin.expectsMediaDataInRealTime = false
writer.add(vin)
var ain: AVAssetWriterInput? = nil
if aout != nil {
  ain = AVAssetWriterInput(mediaType: .audio, outputSettings: [AVFormatIDKey: kAudioFormatMPEG4AAC, AVNumberOfChannelsKey: 1, AVSampleRateKey: 48000, AVEncoderBitRateKey: 192000])
  ain!.expectsMediaDataInRealTime = false; writer.add(ain!)
}
writer.startWriting(); reader.startReading(); writer.startSession(atSourceTime: .zero)
let g = DispatchGroup()
func pump(_ input: AVAssetWriterInput, _ output: AVAssetReaderTrackOutput) {
  g.enter()
  input.requestMediaDataWhenReady(on: DispatchQueue(label: "q\(ObjectIdentifier(input).hashValue)")) {
    while input.isReadyForMoreMediaData {
      if let sb = output.copyNextSampleBuffer() { input.append(sb) } else { input.markAsFinished(); g.leave(); return }
    }
  }
}
pump(vin, vout); if let a = ain, let o = aout { pump(a, o) }
g.wait()
let sem = DispatchSemaphore(value: 0)
writer.finishWriting { sem.signal() }; sem.wait()
if writer.status == .completed { print("✅ SDR:", outURL.path) } else { print("❌", writer.error?.localizedDescription ?? "?"); exit(1) }
