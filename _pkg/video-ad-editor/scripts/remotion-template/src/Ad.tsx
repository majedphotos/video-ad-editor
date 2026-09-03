import {AbsoluteFill, Audio, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {T, VEND, HAS_SFX, GUIDES} from './theme';
import {rgba} from './util';
import {vrect} from './stage';
import {Badge, Bar} from './Chrome';
import {Captions} from './Captions';
import {Scenes, VideoOverlay} from './Scenes';
import {Outro} from './Outro';
import {Guides} from './Guides';

export const Ad: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const R = vrect(t);
  const showVideo = t < VEND;

  return (
    <AbsoluteFill style={{background:T.bg, fontFamily:T.font}}>
      {showVideo && (
        <div style={{position:'absolute', left:R.x, top:R.y, width:R.w, height:R.h,
          borderRadius:R.r, overflow:'hidden',
          boxShadow: R.r > 0.5 ? `0 26px 64px ${rgba(T.ink,0.26)}` : 'none'}}>
          <OffthreadVideo src={staticFile('video.mp4')}
            style={{width:'100%', height:'100%', objectFit:'cover', objectPosition:'50% 26%'}} />
          <VideoOverlay t={t} />
        </div>
      )}
      {HAS_SFX && <Audio src={staticFile('sfx.wav')} />}
      <Badge t={t} />
      <Bar t={t} />
      <Scenes t={t} />
      <Captions t={t} />
      <Outro t={t} />
      {GUIDES && <Guides />}
    </AbsoluteFill>
  );
};
