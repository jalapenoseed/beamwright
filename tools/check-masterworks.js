// Verify chapter entry, progression, hints and rendering at desktop and phone sizes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
setTimeout(() => { console.error('Masterworks UI check timed out'); process.exit(1); }, 120000).unref();
(async () => {
  const browser = await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    fs.mkdirSync('appearance-checks', { recursive: true });
    for (const viewport of [{width:960,height:600},{width:390,height:760}]) {
      const page = await browser.newPage({viewport});
      page.setDefaultTimeout(10000);
      page.setDefaultNavigationTimeout(20000);
      console.log('Masterworks viewport', viewport);
      // Navigation is checked in the supported 2D renderer; check-appearance separately checks the new finale with WebGL.
      await page.addInitScript(() => {
        const get = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type === 'webgl2' ? null : get.call(this, type, ...args); };
      });
      const errors = [];
      page.on('pageerror', e => { errors.push(e.message); console.error('Page error:', e.message); });
      await page.goto(pathToFileURL(path.join(__dirname, '../dist/index.html')).href);
      await page.waitForFunction(() => window.__bw);
      console.log('Page ready');
      await page.evaluate(() => __bw.toTitle());
      assert.ok(await page.locator('#title .title-wrap').evaluate(e => {
        const width = innerWidth;
        return [e, ...e.querySelectorAll('button')].every(el => {
          const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= width;
        });
      }), 'title controls fit the itch embed and phone');
      await page.locator('#titleMasterworks').click();
      assert.equal(await page.locator('#lvlName').textContent(), 'Switchback');
      await page.evaluate(() => __bw.toTitle());
      console.log('Opening Shape the Light');
      await page.locator('#titleShape').click();
      assert.equal(await page.locator('#lvlName').textContent(), 'Needle of Light');
      await page.evaluate(() => { __bw.toTitle(); __bw.showLevels(); });
      assert.equal(await page.locator('#levelCount').textContent(), 'optics lab · 36 benches');
      assert.equal(await page.locator('#levelGrid .chap').filter({hasText:'Masterworks'}).count(), 1);
      const first = page.getByRole('button', {name:'Bench 27, Switchback',exact:true});
      assert.ok(await first.isEnabled(), 'chapter IV must be available with no previous progress');
      assert.ok(await page.getByRole('button',{name:'Bench 28, The Inner Vault, locked',exact:true}).isDisabled());
      console.log('Opening Switchback from picker');
      await first.click();
      assert.equal(await page.locator('#lvlName').textContent(), 'Switchback');
      console.log('Hint control', await page.locator('#hintBtn').evaluate(e => ({hidden:e.hidden,display:getComputedStyle(e).display,rect:e.getBoundingClientRect().toJSON(),body:document.body.className})));
      await page.locator('#hintBtn').click();
      assert.ok((await page.locator('#status').textContent()).includes('Hint:'));
      for (let i = 26; i < 36; i++) {
        console.log('Solving bench', i + 1);
        await page.evaluate(i => __bw.startPlay(i, __bw.LEVELS[i].sol), i);
        try { await page.waitForFunction(() => __bw.S.res?.win && !document.querySelector('#win').hidden); }
        catch (e) {
          console.error('Win state', await page.evaluate(() => ({name:__bw.S.level.name,win:__bw.S.res?.win,placed:__bw.S.placed,press:__bw.S.press,winAt:__bw.S.winAt,winShown:__bw.S.winShown,screen:__bw.S.screen})));
          await page.screenshot({path:'appearance-checks/masterworks-failure.png'}); throw e;
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (i === 35) {
          assert.equal(await page.locator('#winTitle').textContent(), 'Masterworks complete');
          await page.locator('#winStay').click();
          await page.screenshot({path:`appearance-checks/masterworks-${viewport.width}.png`});
        }
      }
      // Chapter III now continues into IV, and the completion unlock survives reload.
      await page.evaluate(() => __bw.startPlay(25, __bw.LEVELS[25].sol));
      await page.waitForFunction(() => !document.querySelector('#win').hidden);
      assert.equal(await page.locator('#winNext').textContent(), 'start chapter IV →');
      await page.locator('#winNext').click();
      assert.equal(await page.locator('#lvlName').textContent(), 'Switchback');
      await page.reload();
      await page.waitForFunction(() => window.__bw);
      console.log('Page ready');
      await page.evaluate(() => { __bw.toTitle(); __bw.showLevels(); });
      assert.ok(await page.getByRole('button',{name:'Bench 36, Grandmaster, 3 of 3',exact:true}).isEnabled());
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Masterworks UI passed: chapter entry, hints, all 10 wins, chapter transition, saved progress, desktop and phone.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
