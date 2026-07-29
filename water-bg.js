/**
 * water-bg.js — 全站「水面」交互层（轻量、无外部库）
 *
 * 两层叠加：
 *  1) 背景水波：铺满视口的 canvas（pointer-events:none），低分辨率高度场模拟水波，
 *     鼠标划过注入涟漪 + 缓慢游走的环境水流，静止时平静微漾。暗底+冷调水光，screen 混合。
 *  2) 水镜透镜：跟随光标的圆形层，用 backdrop-filter 引用 SVG 位移滤镜，
 *     实时扭曲「身后所有内容」——文字、按钮、导航、背景都像泡在水里一样晃动。
 *     光标移动越快，水推得越猛；停下即平复。Firefox/Safari 不支持 url() 滤镜时自动降级为透明。
 *
 * 两页共用，不拦截点击，不影响灯箱（z-index 低于灯箱）。
 */
(function () {
  'use strict';
  if (window.__waterBgLoaded) return;
  window.__waterBgLoaded = true;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  if (reduce || !fine) return; // 减少动效 / 触屏设备：不启用

  var body = document.body || document.documentElement;

  /* ============================================================
   * 1) 背景水波 canvas
   * ============================================================ */
  var canvas = document.createElement('canvas');
  canvas.id = 'water-bg';
  canvas.setAttribute('aria-hidden', 'true');
  var st = canvas.style;
  st.position = 'fixed';
  st.left = '0'; st.top = '0';
  st.width = '100%'; st.height = '100%';
  st.zIndex = '9999';
  st.pointerEvents = 'none';
  st.opacity = '0.4';
  st.mixBlendMode = 'screen';
  body.appendChild(canvas);

  var ctx = canvas.getContext('2d');

  var SIM_W = 220, SIM_H = 130;
  var cur = new Float32Array(SIM_W * SIM_H);
  var prev = new Float32Array(SIM_W * SIM_H);

  var off = document.createElement('canvas');
  off.width = SIM_W; off.height = SIM_H;
  var offCtx = off.getContext('2d');
  var out = offCtx.createImageData(SIM_W, SIM_H);

  // 基础水面图案：暗底 + 冷调水光/焦散 + 少量金色高光
  var base = new Uint8ClampedArray(SIM_W * SIM_H * 4);
  (function buildBase() {
    for (var y = 0; y < SIM_H; y++) {
      for (var x = 0; x < SIM_W; x++) {
        var i = (y * SIM_W + x) * 4;
        var v = 8 + (1 - y / SIM_H) * 14;                                       // 上亮下暗
        var caustic = (Math.sin(y * 0.15 + Math.sin(x * 0.045) * 1.3) * 0.5 + 0.5) * 16; // 横向水光（青）
        var gold = Math.max(0, Math.sin(x * 0.025 + y * 0.018)) * 14;           // 金高光
        base[i]     = v + gold * 0.9 + caustic * 0.15;
        base[i + 1] = v * 0.85 + gold * 0.65 + caustic * 0.5;
        base[i + 2] = v * 0.7 + gold * 0.25 + caustic * 0.9 + 14;               // 偏冷蓝
        base[i + 3] = 255;
      }
    }
  })();

  var DAMP = 0.965;  // 阻尼：越接近 1 涟漪越持久、越「黏」
  var AMP = 7;       // 折射幅度
  var lastT = 0;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
    canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
  }
  resize();
  window.addEventListener('resize', resize);

  // 在屏幕坐标处注入扰动（负高度 = 凹陷 → 涟漪）。r 越大涟漪越宽、越不「硬」
  function disturb(cx, cy, power, r) {
    r = r || 12;
    var gx = Math.floor(cx / window.innerWidth * SIM_W);
    var gy = Math.floor(cy / window.innerHeight * SIM_H);
    for (var y = -r; y <= r; y++) {
      for (var x = -r; x <= r; x++) {
        var px = gx + x, py = gy + y;
        if (px < 1 || py < 1 || px >= SIM_W - 1 || py >= SIM_H - 1) continue;
        var d = Math.sqrt(x * x + y * y);
        if (d > r) continue;
        // 平滑衰减（cos 而非线性），涟漪边缘更柔和
        var f = (Math.cos(d / r * Math.PI) * 0.5 + 0.5);
        prev[py * SIM_W + px] -= power * f;
      }
    }
  }

  function step() {
    for (var y = 1; y < SIM_H - 1; y++) {
      for (var x = 1; x < SIM_W - 1; x++) {
        var i = y * SIM_W + x;
        var val = (prev[i - 1] + prev[i + 1] + prev[i - SIM_W] + prev[i + SIM_W]) * 0.5 - cur[i];
        cur[i] = val * DAMP;
      }
    }
    var tmp = prev; prev = cur; cur = tmp;

    var data = out.data;
    for (var y2 = 0; y2 < SIM_H; y2++) {
      for (var x2 = 0; x2 < SIM_W; x2++) {
        var i2 = y2 * SIM_W + x2;
        var xl = x2 > 0 ? i2 - 1 : i2;
        var xr = x2 < SIM_W - 1 ? i2 + 1 : i2;
        var yu = y2 > 0 ? i2 - SIM_W : i2;
        var yd = y2 < SIM_H - 1 ? i2 + SIM_W : i2;
        var sx = x2 + ((prev[xl] - prev[xr]) * AMP | 0);
        var sy = y2 + ((prev[yu] - prev[yd]) * AMP | 0);
        if (sx < 0) sx = 0; else if (sx >= SIM_W) sx = SIM_W - 1;
        if (sy < 0) sy = 0; else if (sy >= SIM_H) sy = SIM_H - 1;
        var si = (sy * SIM_W + sx) * 4;
        var oi = i2 * 4;
        data[oi] = base[si];
        data[oi + 1] = base[si + 1];
        data[oi + 2] = base[si + 2];
        data[oi + 3] = 255;
      }
    }
    offCtx.putImageData(out, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, SIM_W, SIM_H, 0, 0, canvas.width, canvas.height);
  }

  /* ============================================================
   * 2) 水镜透镜（扭曲文字 / UI / 背景）
   * ============================================================ */
  var svgNS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.style.width = '0'; svg.style.height = '0';
  svg.style.left = '0'; svg.style.top = '0';

  var filter = document.createElementNS(svgNS, 'filter');
  filter.setAttribute('id', 'waterDisplace');
  filter.setAttribute('x', '-30%'); filter.setAttribute('y', '-30%');
  filter.setAttribute('width', '160%'); filter.setAttribute('height', '160%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  var turb = document.createElementNS(svgNS, 'feTurbulence');
  turb.setAttribute('type', 'fractalNoise');
  turb.setAttribute('baseFrequency', '0.011 0.016');
  turb.setAttribute('numOctaves', '2');
  turb.setAttribute('seed', '11');
  turb.setAttribute('result', 'noise');
  // 让噪声随时间缓慢流动 → 静止时也像活水
  var anim = document.createElementNS(svgNS, 'animate');
  anim.setAttribute('attributeName', 'baseFrequency');
  anim.setAttribute('dur', '18s');
  anim.setAttribute('values', '0.011 0.016; 0.014 0.012; 0.009 0.018; 0.011 0.016');
  anim.setAttribute('repeatCount', 'indefinite');
  turb.appendChild(anim);

  var disp = document.createElementNS(svgNS, 'feDisplacementMap');
  disp.setAttribute('id', 'waterDisp');
  disp.setAttribute('in', 'SourceGraphic');
  disp.setAttribute('in2', 'noise');
  disp.setAttribute('scale', '0');
  disp.setAttribute('xChannelSelector', 'R');
  disp.setAttribute('yChannelSelector', 'G');

  filter.appendChild(turb);
  filter.appendChild(disp);
  svg.appendChild(filter);
  body.appendChild(svg);

  var lens = document.createElement('div');
  lens.id = 'water-lens';
  lens.setAttribute('aria-hidden', 'true');
  var ls = lens.style;
  ls.position = 'fixed';
  ls.left = '0'; ls.top = '0';
  ls.width = '360px'; ls.height = '360px';
  ls.borderRadius = '50%';
  ls.pointerEvents = 'none';
  ls.zIndex = '25000';          // 压住导航/按钮/文字/背景，低于灯箱(30000)与作品面板(40000)
  ls.willChange = 'transform, opacity';
  ls.opacity = '0';
  ls.transition = 'opacity .35s ease';
  ls.backdropFilter = 'url(#waterDisplace)';
  ls.webkitBackdropFilter = 'url(#waterDisplace)';
  var maskCss = 'radial-gradient(circle at 50% 50%, #000 30%, rgba(0,0,0,0.55) 52%, transparent 74%)';
  ls.maskImage = maskCss;
  ls.webkitMaskImage = maskCss;
  body.appendChild(lens);

  /* ============================================================
   * 3) 交互：光标推动水面 + 驱动水镜
   * ============================================================ */
  var lastX = 0, lastY = 0, primed = false;
  var lx = window.innerWidth / 2, ly = window.innerHeight / 2; // 水镜当前位置
  var scale = 0, target = 0, lastMove = 0;
  var flowT = 0, ambientTick = 0;

  window.addEventListener('pointermove', function (e) {
    var cx = e.clientX, cy = e.clientY;
    if (!primed) { lastX = cx; lastY = cy; primed = true; }
    var vx = cx - lastX, vy = cy - lastY;
    var sp = Math.min(Math.sqrt(vx * vx + vy * vy), 60);

    // (a) 背景涟漪：速度越快越强
    disturb(cx, cy, 0.6 + sp * 0.05, 12);

    // (b) 水镜：随光标移动，速度驱动扭曲强度
    target = Math.min(8 + sp * 0.55, 30);
    lx = cx; ly = cy;
    lens.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0) translate(-50%,-50%)';
    lastMove = performance.now();

    lastX = cx; lastY = cy;
  }, { passive: true });

  function ambient() {
    ambientTick++;
    // 缓慢游走的环境水流（像有风），避免静止时像死水、也去除「僵硬感」
    if (ambientTick % 5 === 0) {
      flowT += 0.02;
      var fx = (Math.sin(flowT * 0.7) * 0.5 + 0.5) * window.innerWidth;
      var fy = (Math.cos(flowT * 0.5) * 0.5 + 0.5) * window.innerHeight;
      disturb(fx, fy, 0.22, 14);
    }
    // 偶发极轻的随机微漾
    if (ambientTick % 40 === 0) {
      disturb(Math.random() * window.innerWidth, Math.random() * window.innerHeight, 0.18, 10);
    }
  }

  function lensFrame() {
    // 停下超过 120ms → 目标强度衰减，水镜平复、淡出
    if (performance.now() - lastMove > 120) target *= 0.86;
    if (target < 0.3) target = 0;
    scale += (target - scale) * 0.2;
    if (scale < 0.3) scale = 0;
    disp.setAttribute('scale', scale.toFixed(2));
    lens.style.opacity = (scale > 1 ? Math.min(1, scale / 9) : 0).toFixed(3);
    requestAnimationFrame(lensFrame);
  }

  function frame(t) {
    if (t - lastT >= 1000 / 60) { step(); ambient(); lastT = t; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  requestAnimationFrame(lensFrame);
})();
