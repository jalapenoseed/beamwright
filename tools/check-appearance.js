setTimeout(() => { console.error('Appearance check timed out'); process.exit(1); }, 120000).unref();
const { chromium } = require('playwright');
const fs = require('fs');
(async()=>{
 const browser = await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page = await browser.newPage({viewport:{width:390,height:760},deviceScaleFactor:1});
 fs.mkdirSync('appearance-checks', {recursive:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'&&m.text().includes('WebGL disabled'))errors.push(m.text())});
 await page.goto(require('url').pathToFileURL(require('path').join(__dirname, '../dist/index.html')).href);
 await page.evaluate(()=>{__bw.toTitle();});
 await page.getByRole('button',{name:'skins & readability',exact:true}).click();
 for (const id of ['ocean','amber','contrast','steel']) {
   await page.locator('[data-skin-choice="'+id+'"]').click();
   if(await page.locator('html').getAttribute('data-skin')!==id) throw Error('skin switch');
   if(await page.locator('[data-skin-choice="'+id+'"]').getAttribute('aria-pressed')!=='true') throw Error('selection');
 }
 await page.locator('#glowRange').focus();
 await page.keyboard.press('Home');
 for(let k=0;k<10;k++) await page.keyboard.press('ArrowRight');
 await page.locator('#skinClose').click();
 await page.evaluate(()=>__bw.startPlay(0));
 await page.waitForTimeout(600);
 await page.screenshot({path:'appearance-checks/beamwright-steel-phone.png'});
 const result=await page.evaluate(()=>({skin:document.documentElement.dataset.skin,gl:GLR.ok,glow:SKIN.glow,overflow:document.documentElement.scrollWidth>innerWidth,levelName:document.getElementById('lvlName').textContent,skinSaved:JSON.parse(localStorage.getItem('beamwright.appearance'))}));
 await page.locator('#menuBtn').click();
 await page.getByRole('button',{name:'skins & readability',exact:true}).click();
 await page.keyboard.press('Escape');
 if(await page.locator('#skinov').isVisible())throw Error('Escape does not close');
 await page.reload();
 if(await page.locator('html').getAttribute('data-skin')!=='steel')throw Error('persistence');
 // Keep software WebGL at the phone viewport used above; desktop layout is checked in 2D.
 await page.evaluate(()=>__bw.startPlay(__bw.LEVELS.length-1, __bw.LEVELS.at(-1).sol));
 await page.waitForFunction(()=>__bw.S.res?.win);
 if(!await page.evaluate(()=>GLR.ok))throw Error('Masterworks WebGL unavailable');
 await page.screenshot({path:'appearance-checks/masterworks-webgl.png'});
 await page.close();
 if (!result.gl || result.overflow || result.glow !== 0.1 || result.skinSaved.glow !== 0.1) throw Error('Appearance or phone layout check failed: '+JSON.stringify(result));
 console.log(JSON.stringify({result,errors}));
 // Force the 2D fallback and verify the same selector remains usable.
 const fallback=await browser.newPage({viewport:{width:355,height:700}});
 await fallback.addInitScript(()=>{const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){return t==='webgl2'?null:old.call(this,t,...args)}});
 await fallback.goto(require('url').pathToFileURL(require('path').join(__dirname, '../dist/index.html')).href);await fallback.evaluate(()=>__bw.toTitle());
 await fallback.locator('#titleSkins').click();await fallback.locator('[data-skin-choice="contrast"]').click();await fallback.locator('#skinClose').click();await fallback.evaluate(()=>__bw.startPlay(0));
 console.log('fallback '+await fallback.locator('html').getAttribute('class'));
 await fallback.screenshot({path:'appearance-checks/beamwright-fallback-phone.png'});
 await fallback.setViewportSize({width:1280,height:720});await fallback.evaluate(()=>__bw.startPlay(13));
 await fallback.screenshot({path:'appearance-checks/beamwright-steel-desktop.png'});
 await browser.close();if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});

