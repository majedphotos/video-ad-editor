import {continueRender, delayRender} from 'remotion';
import {T} from './theme';
const h = delayRender('font');
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(T.font) +
  ':wght@400;600;700;800;900&display=swap';
link.onload  = () => document.fonts.ready.then(() => continueRender(h));
link.onerror = () => continueRender(h);
document.head.appendChild(link);
