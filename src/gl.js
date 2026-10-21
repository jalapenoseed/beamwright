// ===== WebGL 2 compositor =====
// Takes the two 2D layers the game draws (objects, and additive beams), and paints the final frame:
// an anodized optical breadboard with tapped holes, light spilling onto the metal, bloom, chromatic
// fringing, grain, and every UI plate (keys, pockets, panels, VFD windows, LEDs) found via [data-plate].
const GLR = (() => {
  const MAX_RECTS = 64;
  let gl = null, ok = false, progs = {}, vao = null;
  let tObj, tBeam, fA0, fA1, fB0, fB1, sizeA = [1, 1], sizeB = [1, 1];

  const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

  const DOWN = `#version 300 es
precision mediump float; in vec2 uv; out vec4 o; uniform sampler2D t; uniform vec2 px;
void main(){
  vec4 c = texture(t, uv + px * vec2(-1.0, -1.0)) + texture(t, uv + px * vec2(1.0, -1.0))
         + texture(t, uv + px * vec2(-1.0, 1.0)) + texture(t, uv + px * vec2(1.0, 1.0));
  o = c * 0.25;
}`;

  const BLUR = `#version 300 es
precision mediump float; in vec2 uv; out vec4 o; uniform sampler2D t; uniform vec2 dir;
void main(){
  vec4 c = texture(t, uv) * 0.2270270270;
  c += (texture(t, uv + dir * 1.3846153846) + texture(t, uv - dir * 1.3846153846)) * 0.3162162162;
  c += (texture(t, uv + dir * 3.2307692308) + texture(t, uv - dir * 3.2307692308)) * 0.0702702703;
  o = c;
}`;

  const MAIN = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform vec2 uRes; uniform float uDpr, uTime, uDim, uMotion;
uniform vec4 uStage, uBoard; uniform vec2 uWH; uniform float uShowBoard;
uniform sampler2D tObj, tBeam, tA, tB;
uniform vec4 uR[${MAX_RECTS}]; uniform vec4 uM[${MAX_RECTS}]; uniform vec4 uC[${MAX_RECTS}]; uniform int uN;
uniform vec3 uBg, uMetal, uKey, uPanel, uPocket, uAccent;
uniform float uGlow, uLift, uGrain;
#define WARM uAccent

float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n11(float x){ float i = floor(x), f = fract(x); return mix(h21(vec2(i, 3.7)), h21(vec2(i + 1.0, 3.7)), f * f * (3.0 - 2.0 * f)); }
float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
vec4 stageTex(sampler2D t, vec2 su){ return texture(t, vec2(su.x, 1.0 - su.y)); }
bool bit(float s, float b){ return mod(floor(s / b), 2.0) >= 1.0; }

vec3 plates(vec3 col, vec2 p, float layer, vec3 spill){
  for (int i = 0; i < ${MAX_RECTS}; i++){
    if (i >= uN) break;
    vec4 m = uM[i];
    if (abs(m.z - layer) > 0.5) continue;
    vec4 c = uC[i];
    if (p.x < c.x || p.y < c.y || p.x > c.x + c.z || p.y > c.y + c.w) continue;
    vec4 r = uR[i];
    vec2 hb = r.zw * 0.5; vec2 lp = p - (r.xy + hb);
    float kind = m.x, st = m.y, rad = m.w;
    float reach = (kind > 6.5 || bit(st, 32.0)) ? 90.0 : 22.0;   // glowing keys need room for their halo
    if (abs(lp.x) > hb.x + reach || abs(lp.y) > hb.y + reach) continue;
    bool hov = bit(st, 1.0), down = bit(st, 2.0), on = bit(st, 4.0), dimd = bit(st, 8.0), led = bit(st, 16.0), attn = bit(st, 32.0);
    float pulse = 0.5 + 0.5 * sin(uTime * 3.4);
    float d = sdBox(lp, hb, rad);
    float fi = float(i);
    if (kind < 1.5) {                                   // KEY: raised anodized cap
      float lift = down ? 1.0 : 3.5;
      float sh = 1.0 - smoothstep(-3.0, 9.0, sdBox(lp - vec2(0.0, lift), hb, rad));
      if (d > 0.0) col *= 1.0 - 0.6 * sh;
      if (d < 0.0) {
        float t = clamp((lp.y + hb.y) / (2.0 * hb.y), 0.0, 1.0);
        vec3 base = mix(uKey * 1.12, uKey * 0.88, t);
        base += (n11(p.y * 2.7 + fi * 9.0) - 0.5) * 0.012;
        if (hov) base *= 1.16;
        if (down) base *= 0.8;
        float rim = smoothstep(-2.4, -0.3, d);
        base += rim * mix(0.11, -0.035, smoothstep(0.15, 0.75, t));
        base += spill * 0.18;
        if (attn) base += WARM * (0.05 + 0.09 * pulse) + rim * WARM * 0.4 * pulse;
        col = base;
        if (led) {
          vec2 lq = lp - vec2(-hb.x + (hb.y > 20.0 ? 16.0 : 13.0), 0.0);
          float l = length(lq);
          vec3 lampOff = vec3(0.09, 0.05, 0.025);
          vec3 lamp = on ? WARM * 1.35 : lampOff;
          col = mix(col, lamp, 1.0 - smoothstep(2.4, 3.4, l));
          if (on) col += WARM * exp(-l * 0.32) * 0.28;
        }
      } else if (attn) {
        col += WARM * exp(-d * 0.085) * (0.08 + 0.24 * pulse);   // idle nudge: the hint key breathes
      } else if (on && led) {
        // faint lamp spill onto the table below the key
        vec2 lq = lp - vec2(-hb.x + 13.0, 0.0);
        col += WARM * exp(-length(lq) * 0.12) * 0.03;
      }
    } else if (kind < 2.5) {                            // POCKET: machined recess
      if (d < 0.0) {
        vec3 fl = uPocket + (h21(floor(p * 0.75)) - 0.5) * 0.008;
        float ish = 1.0 - smoothstep(0.0, 12.0, lp.y + hb.y);       // shadow cast by the top wall
        fl *= 1.0 - 0.65 * ish;
        float wall = smoothstep(-3.5, 0.0, d);
        fl += wall * smoothstep(-hb.y, hb.y, lp.y) * 0.075;         // lower wall catches light
        if (hov) fl += 0.012;
        if (on) fl += WARM * (wall * 0.55 + 0.035);
        if (dimd) fl *= 0.75;
        col = fl;
      } else {
        col += (1.0 - smoothstep(0.0, 1.6, d)) * 0.05;               // milled lip
      }
    } else if (kind < 3.5) {                            // PANEL: raised slab with four cap screws
      float sh = 1.0 - smoothstep(-6.0, 26.0, sdBox(lp - vec2(0.0, 8.0), hb, rad));
      if (d > 0.0) col *= 1.0 - 0.7 * sh;
      if (d < 0.0) {
        vec3 base = uPanel;
        base += (n11(p.y * 1.9 + 41.0) * 0.6 + n11(p.y * 7.3) * 0.4 - 0.5) * 0.014;
        float t = clamp((lp.y + hb.y) / (2.0 * hb.y), 0.0, 1.0);
        base *= 1.08 - 0.16 * t;
        float rim = smoothstep(-3.0, -0.3, d);
        base += rim * mix(0.09, -0.03, smoothstep(-hb.y * 0.4, hb.y * 0.4, lp.y));
        vec2 sc = abs(lp) - (hb - vec2(14.0));
        float sd = length(sc);
        if (sd < 5.0) {
          vec3 screw = vec3(0.16, 0.165, 0.175) * (1.0 - 0.45 * smoothstep(-4.0, 4.0, sc.y + sc.x));
          float slot = abs(dot(sc, normalize(vec2(1.0, 0.6)))) < 0.8 ? 0.45 : 1.0;
          base = mix(base, screw * slot, 1.0 - smoothstep(4.0, 5.0, sd));
        }
        col = base;
      }
    } else if (kind < 4.5) {                            // WINDOW: recessed smoked glass (VFD)
      if (d < 0.0) {
        vec3 g = vec3(0.018, 0.015, 0.012);
        float ish = 1.0 - smoothstep(0.0, 9.0, lp.y + hb.y);
        g *= 1.0 - 0.6 * ish;
        g += vec3(0.03, 0.022, 0.012) * (1.0 - smoothstep(-hb.y, hb.y * 0.2, lp.y)) * 0.6;   // reflection band
        g += mod(floor(p.y), 3.0) < 1.0 ? vec3(0.004, 0.003, 0.001) : vec3(0.0);           // VFD mesh
        g += smoothstep(-2.0, 0.0, d) * smoothstep(0.0, hb.y, lp.y) * 0.06;
        col = g;
      } else {
        col += (1.0 - smoothstep(0.0, 1.4, d)) * 0.045;
      }
    } else if (kind > 6.5) {                            // ACCENT: lit amber key for the next step
      float lift = down ? 1.0 : 3.5;
      float sh = 1.0 - smoothstep(-3.0, 9.0, sdBox(lp - vec2(0.0, lift), hb, rad));
      float glow = 0.5 + 0.5 * sin(uTime * 2.4);
      if (d > 0.0) {
        col *= 1.0 - 0.45 * sh;
        col += WARM * exp(-d * 0.07) * (0.14 + 0.12 * glow + (hov ? 0.14 : 0.0));
      } else {
        float t = clamp((lp.y + hb.y) / (2.0 * hb.y), 0.0, 1.0);
        vec3 base = mix(vec3(1.0, 0.8, 0.47), vec3(0.92, 0.58, 0.22), t);
        float sx = mod(uTime * 110.0, hb.x * 2.0 + 300.0) - hb.x - 150.0;   // a glint sliding across the glass
        base += exp(-pow((lp.x - sx + lp.y * 0.6) / 22.0, 2.0)) * 0.25;
        if (hov) base *= 1.08;
        if (down) base *= 0.85;
        float rim = smoothstep(-2.4, -0.3, d);
        base += rim * mix(0.2, -0.14, smoothstep(0.15, 0.75, t));
        col = base * (0.93 + 0.07 * glow);
      }
    } else if (kind > 5.5) {                            // SHADE: soft darkening behind text
      col *= 1.0 - 0.3 * (1.0 - smoothstep(-hb.y * 0.8, 90.0, d));
    } else {                                            // LED lamp
      float rr = min(hb.x, hb.y), l = length(lp);
      if (on) col += WARM * exp(-max(l - rr, 0.0) * 0.28) * 0.35;
      if (l < rr + 1.5) {
        vec3 lamp = on ? mix(WARM * 1.5, vec3(1.0, 0.95, 0.85), 1.0 - smoothstep(0.0, rr * 0.6, l)) : vec3(0.075, 0.045, 0.025) + 0.03 * (1.0 - smoothstep(0.0, rr, length(lp + vec2(rr * 0.3))));
        col = mix(col, lamp, 1.0 - smoothstep(rr - 0.6, rr + 0.6, l));
        col += (1.0 - smoothstep(0.0, 1.2, abs(l - rr - 0.6))) * 0.05;
      }
    }
  }
  return col;
}

void main(){
  vec2 res = uRes / uDpr;
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 su = (p - uStage.xy) / uStage.zw;
  bool inStage = su.x >= 0.0 && su.y >= 0.0 && su.x <= 1.0 && su.y <= 1.0;
  vec3 spillA = inStage ? stageTex(tA, su).rgb : vec3(0.0);
  vec3 spillB = inStage ? stageTex(tB, su).rgb : vec3(0.0);

  // board coordinates (cells); the board may be turned 90° on portrait screens
  vec2 q = p - uStage.xy - uBoard.xy; float cell = uBoard.z;
  vec2 w = uBoard.w > 0.5 ? vec2(q.y / cell, uWH.y - q.x / cell) : q / cell;
  bool inBoard = uShowBoard > 0.5 && inStage && w.x >= 0.0 && w.y >= 0.0 && w.x <= uWH.x && w.y <= uWH.y;

  // the bench top around the breadboard: matte, faintly mottled
  vec3 col = uBg + (h21(floor(p * 0.5)) - 0.5) * 0.01 + (n11(p.x * 0.013 + p.y * 0.007) - 0.5) * 0.012;
  if (inBoard) {
    // black anodized aluminium, brushed along the board's long axis
    vec2 bw = uBoard.w > 0.5 ? vec2(q.y, q.x) : q;
    float streak = n11(bw.y * 0.9 + 13.0) * 0.55 + n11(bw.y * 3.3) * 0.3 + h21(vec2(floor(bw.y * 2.0), 1.0)) * 0.15;
    vec3 base = uMetal + (streak - 0.5) * 0.022;
    // M6 tapped hole at every cell centre
    vec2 f = (fract(w) - 0.5) * cell;
    float dh = length(f), hr = max(2.6, 0.075 * cell);
    float hole = 1.0 - smoothstep(hr - 0.7, hr + 0.4, dh);
    float thread = 0.5 + 0.5 * sin(dh * 3.2);
    float rim = smoothstep(hr - 0.4, hr + 0.5, dh) * (1.0 - smoothstep(hr + 0.5, hr + 2.0, dh));
    float inner = (1.0 - smoothstep(0.0, hr, dh)) * smoothstep(-0.2, 1.0, dot(normalize(f + 1e-4), normalize(vec2(0.3, 1.0))));
    vec3 holeCol = vec3(0.035) + inner * 0.02 * thread + spillB * 0.08;
    base = mix(base, holeCol, hole);
    base += rim * (0.045 + 0.6 * lum(spillB));
    // chamfered board edge and faint engraved cell guides
    vec2 e2 = min(w, uWH - w) * cell; float e = min(e2.x, e2.y);
    base += (1.0 - smoothstep(0.0, 2.6, e)) * 0.075;
    base *= 1.0 - (1.0 - smoothstep(2.6, 9.0, e)) * 0.25;
    vec2 gl2 = abs(fract(w + 0.5) - 0.5) * cell;
    float cross = (1.0 - smoothstep(0.3, 0.9, min(gl2.x, gl2.y))) * (1.0 - smoothstep(3.0, 5.0, max(gl2.x, gl2.y)));
    base += cross * 0.075;
    // light landing on the metal, with a sheen along the brushing
    base += spillB * uGlow * (0.5 + 0.7 * streak) * vec3(1.0, 0.9, 0.78);
    base += spillA * 0.2 * uGlow;
    col = base;
  } else {
    col += spillB * 0.18;
  }

  // objects (premultiplied) then additive beams with a touch of chromatic fringing
  if (inStage) {
    vec4 ob = stageTex(tObj, su);
    col = col * (1.0 - ob.a) + ob.rgb + ob.a * uLift;
    vec2 ca = (su - 0.5) * 0.004 * uMotion;
    vec3 bm = vec3(stageTex(tBeam, su + ca).r, stageTex(tBeam, su).g, stageTex(tBeam, su - ca).b);
    col += bm;
  }
  col += (spillA * 0.85 + spillB * 0.55) * uGlow;          // bloom

  col = plates(col, p, 0.0, spillB);
  col *= 1.0 - 0.6 * uDim;
  col = plates(col, p, 1.0, vec3(0.0));

  // highlight roll-off, vignette, grain
  vec3 hi = max(col - 0.8, 0.0); col = min(col, 0.8) + hi / (1.0 + hi * 1.4);
  vec2 sv = p / res - 0.5;
  col *= 1.0 - 0.08 * pow(length(sv * vec2(1.0, 0.9)) * 1.25, 2.6);
  float gr = h21(p + fract(uTime * 0.37) * 173.0 * uMotion) - 0.5;
  col += gr * uGrain;
  o = vec4(col, 1.0);
}`;

  function compile(fs) {
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const name = info.name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  function texture() {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function target(w, h) {
    const t = texture(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  }
  function freeTarget(x) { if (x) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f); } }
  let lastW = 0, lastH = 0;
  function ensureTargets(w, h) {
    if (w === lastW && h === lastH) return; lastW = w; lastH = h;
    [fA0, fA1, fB0, fB1].forEach(freeTarget);
    sizeA = [Math.max(2, Math.ceil(w / 4)), Math.max(2, Math.ceil(h / 4))];
    sizeB = [Math.max(2, Math.ceil(w / 12)), Math.max(2, Math.ceil(h / 12))];
    fA0 = target(...sizeA); fA1 = target(...sizeA); fB0 = target(...sizeB); fB1 = target(...sizeB);
  }
  function pass(prog, dst, src, uniforms) {
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.f : null);
    gl.viewport(0, 0, dst ? dst.w : gl.canvas.width, dst ? dst.h : gl.canvas.height);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform1i(prog.u.t, 0);
    for (const k in uniforms) gl.uniform2fv(prog.u[k], uniforms[k]);
    gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const R = new Float32Array(MAX_RECTS * 4), M = new Float32Array(MAX_RECTS * 4), C = new Float32Array(MAX_RECTS * 4);
  const KIND = { key: 1, pocket: 2, panel: 3, window: 4, led: 5, shade: 6, accent: 7 };
  const RADIUS = { key: 6, pocket: 9, panel: 12, window: 5, led: 0, shade: 40, accent: 7 };
  function collectRects(hideBase) {
    let n = 0;
    for (const el of document.querySelectorAll('[data-plate]')) {
      if (n >= MAX_RECTS) break;
      // with a menu open, only the menus' own plates are drawn (not the bench, and not the title screen)
      if (hideBase && !el.closest('.ov.modal')) continue;
      if (!el.getClientRects().length) continue;
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue;
      const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
      const kind = el.dataset.plate;
      const st = (el.classList.contains('is-hover') ? 1 : 0) + (el.classList.contains('is-down') ? 2 : 0)
        + (el.classList.contains('on') || el.getAttribute('aria-pressed') === 'true' ? 4 : 0)
        + (el.classList.contains('empty') || el.disabled ? 8 : 0) + (el.classList.contains('led') ? 16 : 0) + (el.classList.contains('attn') ? 32 : 0);
      const layer = el.closest('.ov') ? 1 : 0;
      const clipEl = el.parentElement && el.parentElement.closest('[data-clip]');
      const cr = clipEl ? clipEl.getBoundingClientRect() : { left: -1e4, top: -1e4, width: 2e4, height: 2e4 };
      R.set([r.left, r.top, r.width, r.height], n * 4);
      M.set([KIND[kind] || 1, st, layer, RADIUS[kind] ?? 6], n * 4);
      C.set([cr.left, cr.top, cr.width, cr.height], n * 4);
      n++;
    }
    return n;
  }

  return {
    get ok() { return ok; },
    init(canvas) {
      try {
        gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
        if (!gl) return false;
        progs.down = compile(DOWN); progs.blur = compile(BLUR); progs.main = compile(MAIN);
        vao = gl.createVertexArray(); gl.bindVertexArray(vao);
        const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        tObj = texture(); tBeam = texture();
        canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); ok = false; document.documentElement.classList.add('no-gl'); });
        ok = true;
      } catch (e) { console.warn('WebGL disabled:', e.message); ok = false; }
      return ok;
    },
    // f: { obj, beam (2D canvases), stage (DOMRect), board [ox, oy, cell, rot], wh [w, h], showBoard, dim, time, motion }
    frame(f) {
      if (!ok) return;
      const cvs = gl.canvas, dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
      if (cvs.width !== W || cvs.height !== H) { cvs.width = W; cvs.height = H; }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.bindTexture(gl.TEXTURE_2D, tObj); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, f.obj);
      gl.bindTexture(gl.TEXTURE_2D, tBeam); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, f.beam);
      ensureTargets(f.beam.width, f.beam.height);
      // bloom chain: quarter-res tight glow, twelfth-res wide spill
      pass(progs.down, fA0, tBeam, { px: [1.5 / f.beam.width, 1.5 / f.beam.height] });
      pass(progs.blur, fA1, fA0.t, { dir: [1 / sizeA[0], 0] });
      pass(progs.blur, fA0, fA1.t, { dir: [0, 1 / sizeA[1]] });
      pass(progs.down, fB0, fA0.t, { px: [1 / sizeA[0], 1 / sizeA[1]] });
      for (let k = 0; k < 2; k++) {
        pass(progs.blur, fB1, fB0.t, { dir: [(1 + k) / sizeB[0], 0] });
        pass(progs.blur, fB0, fB1.t, { dir: [0, (1 + k) / sizeB[1]] });
      }
      const m = progs.main, u = m.u;
      gl.useProgram(m.p); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
      [tObj, tBeam, fA0.t, fB0.t].forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); });
      const palette = SKIN.palette;
      for (const [uniform, value] of Object.entries({ uBg: palette.bg, uMetal: palette.board, uKey: palette.key, uPanel: palette.panel, uPocket: palette.pocket, uAccent: palette.accent })) gl.uniform3fv(u[uniform], value);
      gl.uniform1f(u.uGlow, SKIN.glow); gl.uniform1f(u.uLift, palette.lift); gl.uniform1f(u.uGrain, palette.grain);
      gl.uniform1i(u.tObj, 0); gl.uniform1i(u.tBeam, 1); gl.uniform1i(u.tA, 2); gl.uniform1i(u.tB, 3);
      gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uDpr, dpr); gl.uniform1f(u.uTime, f.time); gl.uniform1f(u.uDim, f.dim); gl.uniform1f(u.uMotion, f.motion);
      const s = f.stage; gl.uniform4f(u.uStage, s.left, s.top, Math.max(1, s.width), Math.max(1, s.height));
      gl.uniform4f(u.uBoard, ...f.board); gl.uniform2f(u.uWH, ...f.wh); gl.uniform1f(u.uShowBoard, f.showBoard ? 1 : 0);
      const n = collectRects(f.hideBase);
      gl.uniform1i(u.uN, n); gl.uniform4fv(u.uR, R); gl.uniform4fv(u.uM, M); gl.uniform4fv(u.uC, C);
      gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
})();
