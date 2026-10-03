# يُشغَّل داخل دافنشي (run_script_unsafe): exec(open(PATH).read(), {"resolve": resolve, "project": project, "CFG": {...}})
# يطلّع ريلات طولية من حلقة/مقابلة عرضية — بطريقة المونتير: كل قطعة (هوك · سؤال · جواب) مقطع مستقل على V1
# تقدر تقصه وتسحبه، وكل مقطع عليه «إعادة تأطير ذكي» يلحق الوجه، والكابشن لوتي على V2.
# CFG: clip_name (اسم المقطع بالمكتبة يبدأ بـ), reels: [{name, segs: [[بداية, نهاية], ...] بالثواني من الأصل, lottie: مسار}],
#      reframe (True), size [1080, 1920]
mp = project.GetMediaPool(); root = mp.GetRootFolder()
def _all_clips(folder):
    out = list(folder.GetClipList() or [])
    for sf in folder.GetSubFolderList() or []:
        out += _all_clips(sf)
    return out


clip = [c for c in _all_clips(root) if c.GetName().startswith(CFG["clip_name"])][0]
FPS = float(clip.GetClipProperty("FPS") or 30)
W_, H_ = CFG.get("size", [1080, 1920])
S = {"useCustomSettings": "1", "timelineResolutionWidth": str(W_), "timelineResolutionHeight": str(H_),
     "timelineFrameRate": str(FPS if FPS != int(FPS) else int(FPS)), "timelineInputResMismatchBehavior": "scaleToCrop"}
names = {t.GetName(): t for t in [project.GetTimelineByIndex(i + 1) for i in range(project.GetTimelineCount())]}
out = []
for R in CFG["reels"]:
    nm, cap = R["name"], "CAP " + R["name"]
    project.SetCurrentTimeline(project.GetTimelineByIndex(1))
    olds = [names[n] for n in (nm, cap) if n in names]
    if olds: mp.DeleteTimelines(olds)
    for c in _all_clips(root):
        if c.GetName() in (nm, cap): mp.DeleteClips([c])
    total = sum(int(round(e * FPS)) - int(round(s * FPS)) for s, e in R["segs"])
    # 1) تايملاين الكابشن (عنوان فيوجن فيه لوتي)
    lottie = R.get("lottie")
    if lottie:
        g = mp.CreateEmptyTimeline(cap)
        for k, v in S.items(): g.SetSetting(k, v)
        project.SetCurrentTimeline(g); g.SetCurrentTimecode("01:00:00:00")
        title = g.InsertFusionTitleIntoTimeline("Text+")
        comp = title.GetFusionCompByIndex(1)
        tools = comp.GetToolList(False)
        tp0 = [v for v in tools.values() if v.GetAttrs()["TOOLS_RegID"] == "TextPlus"][0]
        mo = [v for v in tools.values() if v.GetAttrs()["TOOLS_RegID"] == "MediaOut"][0]
        comp.Lock(); tp0.SetInput("StyledText", "")
        lo = comp.AddTool("OGrafLoader", -32768, -32768); lo.SetInput("TemplatePath", lottie); lo.SetAttrs({"TOOLS_Name": "Captions"})
        mo.ConnectInput("Input", lo); comp.Unlock()
    # 2) الريل: كل قطعة مقطع مستقل
    tl = mp.CreateEmptyTimeline(nm)
    for k, v in S.items(): tl.SetSetting(k, v)
    project.SetCurrentTimeline(tl)
    infos = [{"mediaPoolItem": clip, "startFrame": int(round(s * FPS)), "endFrame": int(round(e * FPS)) - 1} for s, e in R["segs"]]
    mp.AppendToTimeline(infos)
    items = tl.GetItemListInTrack("video", 1) or []
    rf = [it.SmartReframe() for it in items] if CFG.get("reframe", True) else []
    if lottie:
        tl.AddTrack("video")
        ci = [c for c in _all_clips(root) if c.GetName() == cap][0]
        extra = int(round(R.get("extra", 0) * FPS))          # بطاقة الختام بعد آخر كلمة
        mp.AppendToTimeline([{"mediaPoolItem": ci, "startFrame": 0, "endFrame": total + extra - 1, "trackIndex": 2, "recordFrame": tl.GetStartFrame()}])
    out.append({"reel": nm, "clips": len(items), "reframed": sum(1 for x in rf if x), "secs": round(total / FPS, 1)})
result = {"fps": FPS, "reels": out}
