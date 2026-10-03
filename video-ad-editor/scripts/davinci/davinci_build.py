# يُشغَّل داخل دافنشي (run_script_unsafe): exec(open(PATH).read(), {"resolve": resolve, "project": project, "CFG": {...}})
# يبني تايملاين ريل: V1 المقطع (للصوت) + V2 كومب التخطيط (كريمي + الفيديو ملء الشاشة/كرت عرضي + زوم قفزة + لوتي فوق).
# CFG: clip_prefix, layout_name, reel_name, gfx (index.json: مجموعة→مسار لوتي) أو lottie, scenes [[s,e,"F"|"D"]],
#      punch [ثواني الزوم القفزة], sfx (wav اختياري), bg (لون الخلفية hex من theme.json), blur (True), fps
F = lambda t: int(round(t * CFG.get("fps", 30)))
mp = project.GetMediaPool(); root = mp.GetRootFolder()
clip = [c for c in root.GetClipList() if c.GetName().startswith(CFG["clip_prefix"])][0]
project.SetCurrentTimeline(project.GetTimelineByIndex(1))
olds = [t for t in [project.GetTimelineByIndex(i + 1) for i in range(project.GetTimelineCount())]
        if t.GetName() in (CFG["layout_name"], CFG["reel_name"])]
if olds: mp.DeleteTimelines(olds)
for c in root.GetClipList():
    if c.GetName() in (CFG["layout_name"], CFG["reel_name"]): mp.DeleteClips([c])
S = {"useCustomSettings": "1", "timelineResolutionWidth": "1080", "timelineResolutionHeight": "1920",
     "timelineFrameRate": str(CFG.get("fps", 30)), "timelineInputResMismatchBehavior": "scaleToCrop"}

g = mp.CreateEmptyTimeline(CFG["layout_name"])
for k, v in S.items(): g.SetSetting(k, v)
project.SetCurrentTimeline(g); g.SetCurrentTimecode("01:00:00:00")
title = g.InsertFusionTitleIntoTimeline("Text+")
comp = title.GetFusionCompByIndex(1)
tools = comp.GetToolList(False)
tp0 = [v for v in tools.values() if v.GetAttrs()["TOOLS_RegID"] == "TextPlus"][0]
mo = [v for v in tools.values() if v.GetAttrs()["TOOLS_RegID"] == "MediaOut"][0]
comp.Lock()
tp0.SetInput("StyledText", "")


def kf(tool, name, pairs):
    tool.AddModifier(name, "BezierSpline")
    if pairs[0][0] > 0: pairs = [(0, pairs[0][1])] + pairs
    for f, v in pairs: tool.SetInput(name, v, max(0, f))


def kpath(tool, name, pairs):
    tool.AddModifier(name, "Path")
    for f, v in pairs: tool.SetInput(name, {1: 0.5, 2: v}, f)


base = comp.AddTool("Background", -32768, -32768)
_bg = CFG.get("bg", "#F0EEE6").lstrip("#"); _rgb = [int(_bg[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [1.0]
for c, v in zip(("TopLeftRed", "TopLeftGreen", "TopLeftBlue", "TopLeftAlpha"), _rgb): base.SetInput(c, v)
mi = comp.AddTool("MediaIn", -32768, -32768); mi.SetInput("MediaID", clip.GetMediaId())
xf = comp.AddTool("Transform", -32768, -32768); xf.ConnectInput("Input", mi)
xf.SetInput("Pivot", {1: 0.5, 2: 0.62})
import json as _json
GFX = _json.load(open(CFG["gfx"])) if CFG.get("gfx") else {"main": CFG["lottie"]}
bg_in = base
if "grid" in GFX:
    gl = comp.AddTool("OGrafLoader", -32768, -32768); gl.SetInput("TemplatePath", GFX["grid"]); gl.SetAttrs({"TOOLS_Name": "L_grid"})
    gg = comp.AddTool("Merge", -32768, -32768); gg.ConnectInput("Background", base); gg.ConnectInput("Foreground", gl)
    gg.SetAttrs({"TOOLS_Name": "Grid"}); bg_in = gg
vm = comp.AddTool("Merge", -32768, -32768)
vm.ConnectInput("Background", bg_in); vm.ConnectInput("Foreground", xf)
vm.SetAttrs({"TOOLS_Name": "VideoCard"})
if CFG.get("blur", True):
    for t_ in (vm, xf):
        t_.SetInput("MotionBlur", 1); t_.SetInput("Quality", 4); t_.SetInput("ShutterAngle", 90)
mask = comp.AddTool("RectangleMask", -32768, -32768)
mask.SetInput("Width", 1.0); mask.SetInput("CornerRadius", 0.035)
vm.ConnectInput("EffectMask", mask)
SC = CFG["scenes"]; TR = 10
P = {"F": {"size": 0.8889, "cy": 0.5, "my": 0.5, "mh": 1.2}, "D": {"size": 0.3646, "cy": 0.205, "my": 0.205, "mh": 0.41}}
ks = {"size": [], "cy": [], "my": [], "mh": []}
for s, e, m in SC:
    fs = F(s); f0 = 0 if fs == 0 else fs + TR; fe = F(min(e, 3600))
    for key in ks: ks[key] += [(f0, P[m][key]), (fe, P[m][key])]
kf(vm, "Size", ks["size"]); kpath(vm, "Center", ks["cy"])
kf(mask, "Height", ks["mh"]); kpath(mask, "Center", ks["my"])
zk = [(0, 1.0)]
for w in CFG.get("punch", []):
    seg_end = [e for s, e, m in SC if s <= w < e][0]
    zk += [(F(w) - 1, 1.0), (F(w) + 2, 1.12), (F(seg_end) - 1, 1.12), (F(seg_end), 1.0)]
kf(xf, "Size", zk)
prev = vm
order = [g for g in GFX if g not in ("grid", "Captions")] + (["Captions"] if "Captions" in GFX else [])
for gname in order:
    lo = comp.AddTool("OGrafLoader", -32768, -32768); lo.SetInput("TemplatePath", GFX[gname]); lo.SetAttrs({"TOOLS_Name": "L_" + gname})
    gm = comp.AddTool("Merge", -32768, -32768); gm.ConnectInput("Background", prev); gm.ConnectInput("Foreground", lo)
    gm.SetAttrs({"TOOLS_Name": gname}); prev = gm
mo.ConnectInput("Input", prev)
comp.Unlock()

lay = [c for c in root.GetClipList() if c.GetName() == CFG["layout_name"]][0]
tl = mp.CreateEmptyTimeline(CFG["reel_name"])
for k, v in S.items(): tl.SetSetting(k, v)
project.SetCurrentTimeline(tl)
mp.AppendToTimeline([clip]); tl.AddTrack("video")
n = int(clip.GetClipProperty("Frames") or 0) or F(62.6)
mp.AppendToTimeline([{"mediaPoolItem": lay, "startFrame": 0, "endFrame": n - 1, "trackIndex": 2, "recordFrame": 108000}])
if CFG.get("sfx"):
    for c in root.GetClipList():
        if c.GetName() == CFG["sfx"].split("/")[-1]: mp.DeleteClips([c])
    sfx = mp.ImportMedia([CFG["sfx"]])[0]
    tl.AddTrack("audio", "stereo")
    mp.AppendToTimeline([{"mediaPoolItem": sfx, "trackIndex": tl.GetTrackCount("audio"), "recordFrame": 108000, "mediaType": 2}])
result = {"reel": tl.GetName(), "audio": [(a, [x.GetName() for x in (tl.GetItemListInTrack("audio", a) or [])]) for a in range(1, tl.GetTrackCount("audio") + 1)], "v2": [(x.GetName(), x.GetDuration()) for x in tl.GetItemListInTrack("video", 2)]}
