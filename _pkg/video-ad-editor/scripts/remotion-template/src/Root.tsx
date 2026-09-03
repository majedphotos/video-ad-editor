import {Composition} from 'remotion';
import {Ad} from './Ad';
import {DUR_F, FPS} from './theme';

export const RemotionRoot: React.FC = () => (
  <Composition id="Ad" component={Ad} durationInFrames={DUR_F}
    fps={FPS} width={1080} height={1920} />
);
