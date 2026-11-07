/* يرسم طبقة الموشن الشفافة لكل فريم من plan.json
   node render_overlay.js <work> [f1,f2,...] */
const path=require('path'),fs=require('fs');
function resolvePuppeteer(){const S=path.resolve(__dirname,'..','..');
  for(const p of [process.env.PUPPETEER_PATH,path.join(S,'node_modules/puppeteer-core'),'puppeteer-core','puppeteer']){if(!p)continue;try{return require(p)}catch(e){}}
  throw new Error('ما لقيت puppeteer-core: شغّل 00_setup.sh --install')}
function findChrome(){if(process.env.CHROME_PATH)return process.env.CHROME_PATH;
  const LA=process.env.LOCALAPPDATA||'',PF=process.env.ProgramFiles||'C:/Program Files';
  for(const c of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',PF+'/Google/Chrome/Application/chrome.exe',LA+'/Google/Chrome/Application/chrome.exe',PF+'/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'])if(fs.existsSync(c))return c;
  throw new Error('ما لقيت كروم: حدّد CHROME_PATH')}
(async()=>{const W=path.resolve(process.argv[2]);const dir=path.join(W,'overlay');fs.mkdirSync(dir,{recursive:true});
const data=fs.readFileSync(path.join(W,'overlay_data.json'),'utf8');
const list=process.argv[3]?process.argv[3].split(',').map(Number):null;
const b=await resolvePuppeteer().launch({headless:'new',executablePath:findChrome(),args:['--allow-file-access-from-files','--force-color-profile=srgb']});
const pg=await b.newPage();await pg.setViewport({width:1080,height:1920});pg.on('pageerror',e=>console.log('خطأ:',e.message));
await pg.goto(require('url').pathToFileURL(path.join(__dirname,'overlay.html')).href);
await pg.evaluate(d=>window.boot(JSON.parse(d)),data);
const n=list||[...Array(await pg.evaluate(()=>window.frames_total())).keys()];
for(const f of n){const d=await pg.evaluate(t=>window.png(t),f/30);fs.writeFileSync(path.join(dir,String(f).padStart(4,'0')+'.png'),Buffer.from(d.split(',')[1],'base64'))}
await b.close();console.log('✅ طبقة الموشن',n.length,'فريم')})().catch(e=>{console.error(e.message);process.exit(1)});
