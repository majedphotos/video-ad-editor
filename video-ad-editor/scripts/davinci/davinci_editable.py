# يُشغَّل داخل دافنشي (run_script_unsafe): exec(open(PATH).read(), {"resolve": resolve, "project": project, "CFG": {...}})
# ريل «قابل للتعديل»: كل شي قطعة لحالها على مسارها — مو كومب وحدة.
#   V1 خلفية (لونها خانة) · V2 الفيديو مقطّع حسب الوضع (ملء الشاشة / كرت تحت — زوم وتحريك بالإنسبكتر)
#   V3 مشاهد الرسم · V4 الكابشن جملة جملة — كل نص خانة بصفحة فيوجن (اختار العقدة ← الإنسبكتر)
# الرسم قوالب OGraf بـscripts/davinci/ograf_titles/ (mk-bg · mk-headline · mk-caption).
# CFG: templates (مسار ograf_titles) · work (مجلد الشغل) · clip (اسم المقطع بالمكتبة) · name · fps · total (ثواني) · bg · segs [[s,e,"F"|"D",zoom?]]
#      scenes [{"tpl","s","e","text":[...],"num":[...],"name"}] · caps [{"s","e","text","hot","y"}]
T = CFG["templates"].rstrip("/") + "/"   # <مجلد السكل>/scripts/davinci/ograf_titles — exec ما يعرف مكان الملف، فينعطى بالـCFG
FPS = CFG.get("fps", 30)
F = lambda t: int(round(t * FPS))
mp = project.GetMediaPool(); root = mp.GetRootFolder()
clip = [c for c in root.GetClipList() if c.GetName() == CFG["clip"]][0]
S = {"useCustomSettings": "1", "timelineResolutionWidth": "1080", "timelineResolutionHeight": "1920",
     "timelineFrameRate": str(FPS), "timelineInputResMismatchBehavior": "scaleToCrop"}
P = CFG["name"]
tl_names = {project.GetTimelineByIndex(i + 1).GetName(): project.GetTimelineByIndex(i + 1) for i in range(project.GetTimelineCount())}
olds = [t for n, t in tl_names.items() if n == P or n.startswith(P + " · ")]
if olds:
    project.SetCurrentTimeline(project.GetTimelineByIndex(1)); mp.DeleteTimelines(olds)
for c in root.GetClipList():
    if c.GetName() == P or c.GetName().startswith(P + " · "): mp.DeleteClips([c])
made = []


import os, json as _json, shutil, re as _re
CLIPS = os.path.join(CFG["work"], "ograf_clips"); os.makedirs(CLIPS, exist_ok=True)
for f in os.listdir(T):
    if f.endswith(".js"): shutil.copy(os.path.join(T, f), CLIPS)


def clip_manifest(tpl, slug, text, num, check):
    """نسخة من القالب لكل قطعة، قيمها مكتوبة كقيم افتراضية — دافنشي يرجّع الخانات للافتراضي وقت التحميل،
    فهذي الطريقة الوحيدة اللي تثبت النص (ويبقى قابل للتعديل من الإنسبكتر)."""
    m = _json.load(open(T + tpl, encoding="utf-8")); props = m["schema"]["properties"]
    kinds = {"text": [k for k, v in props.items() if v["type"] == "string" and "gddType" not in v],
             "num": [k for k, v in props.items() if v["type"] == "number"], "check": [k for k, v in props.items() if v["type"] == "boolean"]}
    for kind, vals in (("text", text), ("num", num), ("check", check)):
        for k, v in zip(kinds[kind], vals): props[k]["default"] = v
    m["id"] = m["id"] + "-" + slug
    path = os.path.join(CLIPS, "%s-%d.ograf.json" % (slug, len(os.listdir(CLIPS))))   # اسم جديد كل مرة (دافنشي يكاشّ المسار)
    _json.dump(m, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return path


def title_tl(name, tpl, text=(), num=(), check=()):
    """تايملاين صغير فيه عنوان فيوجن واحد بداخله OGrafLoader — يرجع عنصره بالمكتبة."""
    slug = _re.sub(r"[^a-z0-9]+", "-", tpl.split(".")[0]) + "-" + str(len(made))
    tpl_path = clip_manifest(tpl, slug, list(text), list(num), list(check))
    g = mp.CreateEmptyTimeline(name)
    for k, v in S.items(): g.SetSetting(k, v)
    project.SetCurrentTimeline(g); g.SetCurrentTimecode("01:00:00:00")
    it = g.InsertFusionTitleIntoTimeline("Text+")
    comp = it.GetFusionCompByIndex(1); tools = comp.GetToolList(False)
    tp = [v for v in tools.values() if v.GetAttrs()["TOOLS_RegID"] == "TextPlus"][0]
    mo = [v for v in tools.values() if v.GetAttrs()["TOOLS_RegID"] == "MediaOut"][0]
    comp.Lock(); tp.SetInput("StyledText", "")
    lo = comp.AddTool("OGrafLoader", -32768, -32768); lo.SetInput("TemplatePath", tpl_path)
    lo.SetAttrs({"TOOLS_Name": name.split(" · ")[-1].replace(" ", "_")})
    mo.ConnectInput("Input", lo); comp.Unlock()
    made.append({"name": name, "t0": lo.GetInput("DynParamText0"), "label0": (lo.GetInput("DynParamText0") is not None)})
    return [c for c in root.GetClipList() if c.GetName() == name][0]


bg = title_tl(P + " · خلفية", "mk-bg.ograf.json")
scene_items = [(sc, title_tl(P + " · " + sc.get("name", "مشهد"), sc["tpl"], sc.get("text", []), sc.get("num", []))) for sc in CFG.get("scenes", [])]
cap_items = [(cp, title_tl(P + " · كابشن %02d" % (i + 1), "mk-caption.ograf.json", [cp["text"], cp.get("hot", "")], [cp.get("y", 1330)]))
             for i, cp in enumerate(CFG.get("caps", []))]

tl = mp.CreateEmptyTimeline(P)
for k, v in S.items(): tl.SetSetting(k, v)
project.SetCurrentTimeline(tl)
for _ in range(3): tl.AddTrack("video")
for i, name in enumerate(["خلفية", "الفيديو", "الرسم", "الكابشن"]): tl.SetTrackName("video", i + 1, name)
t0 = tl.GetStartFrame(); N = F(CFG["total"])
mp.AppendToTimeline([{"mediaPoolItem": bg, "startFrame": 0, "endFrame": N - 1, "trackIndex": 1, "recordFrame": t0, "mediaType": 1}])
vids = mp.AppendToTimeline([{"mediaPoolItem": clip, "startFrame": F(s), "endFrame": F(e) - 1, "trackIndex": 2, "recordFrame": t0 + F(s)}
                            for s, e, m, *z in CFG["segs"]])
# الكرت تحت = المقطع بارتفاع 41٪ من الشاشة ونازل لين يلمس تحت (بالإنسبكتر: Zoom وTilt)
vprops = []
for (s, e, m, *z), it in zip(CFG["segs"], vids or []):
    zoom = 0.41 if m == "D" else (z[0] if z else 1.0)
    it.SetProperty("ZoomX", zoom); it.SetProperty("ZoomY", zoom)
    it.SetProperty("Tilt", -566.0 if m == "D" else 0.0)
    vprops.append([m, it.GetProperty("ZoomX"), it.GetProperty("Tilt")])
for sc, item in scene_items:
    mp.AppendToTimeline([{"mediaPoolItem": item, "startFrame": 0, "endFrame": F(sc["e"] - sc["s"]) - 1, "trackIndex": 3, "recordFrame": t0 + F(sc["s"]), "mediaType": 1}])
for cp, item in cap_items:
    mp.AppendToTimeline([{"mediaPoolItem": item, "startFrame": 0, "endFrame": F(cp["e"] - cp["s"]) - 1, "trackIndex": 4, "recordFrame": t0 + F(cp["s"]), "mediaType": 1}])
result = {"timeline": P, "tracks": [[x.GetName() for x in (tl.GetItemListInTrack("video", k) or [])] for k in range(1, 5)],
          "video_props": vprops, "titles": made}
