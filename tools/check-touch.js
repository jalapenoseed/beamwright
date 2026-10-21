// Real touch input inside a scrollable host page, like itch's game iframe.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
setTimeout(() => { console.error('Touch check timed out'); process.exit(1); }, 90000).unref();
(async () => {
  const game = fs.readFileSync(require('node:path').join(__dirname, '../dist/index.html'));
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(req.url === '/game' ? game : '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding-top:40px;height:2500px}iframe{width:100%;height:700px;border:0;display:block}</style><iframe src="/game"></iframe>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({args:['--no-sandbox']});
  try {
    const context = await browser.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true});
    await context.addInitScript(() => {
      const old = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(t,...a) { return t === 'webgl2' ? null : old.call(this,t,...a); };
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:' + server.address().port);
    const frame = page.frames().find(f => f.url().endsWith('/game'));
    await frame.waitForFunction(() => window.__bw);
    await frame.evaluate(() => {
      __bw.startPlay(0);
      window.touchChecks = [];
      for (const type of ['touchstart','touchmove']) document.addEventListener(type,e => touchChecks.push({type,prevented:e.defaultPrevented}));
    });
    const cdp = await context.newCDPSession(page);
    const touch = async (type,p) => cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p ? [{x:p.x,y:p.y,id:1}] : []});
    const rack = async () => {
      const r = await page.frameLocator('iframe').locator('#parts .pocket').first().boundingBox();
      return {x:r.x+r.width/2,y:r.y+r.height/2};
    };
    const cell = async (x,y) => {
      const p = await frame.evaluate(({x,y}) => {
        const r=document.querySelector('#stage').getBoundingClientRect(), L=__bw.S.level;
        const rot=r.height>r.width*1.15&&L.w>L.h, cols=rot?L.h:L.w, rows=rot?L.w:L.h;
        const c=Math.max(10,Math.min(r.width/(cols+.5),(r.height-18)/(rows+.6)));
        return {x:r.left+(r.width-cols*c)/2+(rot?L.h-y-.5:x+.5)*c,y:r.top+(r.height-rows*c)/2-4+(rot?x+.5:y+.5)*c};
      },{x,y});
      const host=await page.locator('iframe').boundingBox();
      return {x:host.x+p.x,y:host.y+p.y};
    };
    const state = () => frame.evaluate(() => ({placed:__bw.S.placed,inv:__bw.S.inv.mirror,drag:__bw.S.drag,press:__bw.S.press}));
    const move = async (a,b) => {
      for(let i=1;i<=8;i++) await touch('touchMove',{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8});
    };
    const a=await rack(), b=await cell(2,2), c=await cell(3,2);
    await touch('touchStart',a); await move(a,b);
    assert.equal((await state()).drag.type,'mirror');
    // An unrelated finger must not terminate the active drag.
    await frame.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup',{pointerId:999})));
    assert.ok((await state()).drag);
    await touch('touchEnd');
    let s=await state(); assert.equal(s.placed.length,1); assert.equal(s.placed[0].x,2); assert.equal(s.placed[0].y,2); assert.equal(s.inv,0); assert.equal(s.drag,null);
    const original=s.placed[0];
    await touch('touchStart',b); await move(b,c); await touch('touchCancel');
    s=await state(); assert.deepEqual(s.placed,[original]); assert.equal(s.inv,0); assert.equal(s.press,null);
    await touch('touchStart',b); await move(b,c); await touch('touchEnd');
    s=await state(); assert.equal(s.placed[0].x,3); assert.equal(s.placed[0].uid,original.uid);
    assert.equal(await page.evaluate(() => scrollY),0,'host page scrolled during drag');
    assert.equal(await frame.evaluate(() => scrollY),0,'game scrolled during drag');
    const events=await frame.evaluate(() => touchChecks);
    assert.ok(events.some(e => e.type==='touchmove'));
    assert.ok(events.every(e => e.prevented),'game touch default was not consumed');
    await frame.evaluate(() => __bw.startPlay(0));
    const tray=await rack(); await touch('touchStart',tray); await move(tray,b); await touch('touchCancel');
    s=await state(); assert.equal(s.placed.length,0); assert.equal(s.inv,1); assert.equal(s.drag,null);
    console.log('Touch iframe checks passed: tray and board drag, cancellation, pointer ownership, no page scrolling.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => {console.error(e);process.exit(1)});
