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
    for (const viewport of [{width:1280,height:720},{width:390,height:760}]) {
      const page = await browser.newPage({viewport});
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(pathToFileURL(path.join(__dirname, '../dist/index.html')).href);
      await page.waitForFunction(() => window.__bw);
      await page.evaluate(() => { __bw.toTitle(); __bw.showLevels(); });
      assert.equal(await page.locator('#levelCount').textContent(), 'optics lab · 32 benches');
      assert.equal(await page.locator('#levelGrid .chap').filter({hasText:'Masterworks'}).count(), 1);
      const first = page.getByRole('button', {name:'Bench 23, Switchback',exact:true});
      assert.ok(await first.isEnabled(), 'chapter III must be available with no previous progress');
      assert.ok(await page.getByRole('button',{name:'Bench 24, The Inner Vault, locked',exact:true}).isDisabled());
      await first.click();
      assert.equal(await page.locator('#lvlName').textContent(), 'Switchback');
      await page.locator('#hintBtn').click();
      assert.ok((await page.locator('#status').textContent()).includes('Hint:'));
      for (let i = 22; i < 32; i++) {
        await page.evaluate(i => __bw.startPlay(i, __bw.LEVELS[i].sol), i);
        await page.waitForFunction(() => __bw.S.res?.win && !document.querySelector('#win').hidden);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (i === 31) {
          assert.equal(await page.locator('#winTitle').textContent(), 'Masterworks complete');
          await page.locator('#winStay').click();
          await page.screenshot({path:`appearance-checks/masterworks-${viewport.width}.png`});
        }
      }
      // Chapter II now continues into III, and the completion unlock survives reload.
      await page.evaluate(() => __bw.startPlay(21, __bw.LEVELS[21].sol));
      await page.waitForFunction(() => !document.querySelector('#win').hidden);
      assert.equal(await page.locator('#winNext').textContent(), 'start chapter III →');
      await page.locator('#winNext').click();
      assert.equal(await page.locator('#lvlName').textContent(), 'Switchback');
      await page.reload();
      await page.waitForFunction(() => window.__bw);
      await page.evaluate(() => { __bw.toTitle(); __bw.showLevels(); });
      assert.ok(await page.getByRole('button',{name:'Bench 32, Grandmaster, 3 of 3',exact:true}).isEnabled());
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Masterworks UI passed: chapter entry, hints, all 10 wins, chapter transition, saved progress, desktop and phone.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
