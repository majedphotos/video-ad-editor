/* node cover_render.js <setup.json> <out-prefix> */
const path=require('path'),fs=require('fs');const S=path.resolve(__dirname,'..','..');
const R=[process.env.PUPPETEER_PATH,path.join(S,'node_modules/puppeteer-core'),'puppeteer-core','puppeteer'].filter(Boolean);let P;for(const r of R){try{P=require(r);break}catch(e){}}
const C=process.env.CHROME_PATH||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(fs.existsSync);
(async()=>{const cfg=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const b=await P.launch({headless:'new',executablePath:C,args:['--allow-file-access-from-files']});const pg=await b.newPage();
for(const [n,w,h,e] of [['9x16',1080,1920,{}],['3x4',1080,1440,{y:-240,by:-240}],['1x1',1080,1080,{s:.82,x:97,y:-165,by:-355}]]){await pg.setViewport({width:w,height:h});await pg.goto(require('url').pathToFileURL(path.join(__dirname,'cover.html')).href);await pg.evaluate(c=>window.setup(c),{...cfg,w,h,...e});await pg.screenshot({path:`${process.argv[3]}-${n}.png`})}
await b.close()})().catch(e=>{console.error(e.message);process.exit(1)});
