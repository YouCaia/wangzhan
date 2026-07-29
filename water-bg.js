/**
 * water-bg.js — 全站「水面」背景层（轻量、无外部库）
 * 做法：一块铺满视口的 canvas（pointer-events:none，不拦截点击），
 * 用低分辨率高度场模拟水波，鼠标划过注入轻微涟漪，静止时平静微漾。
 * 颜色极淡（暗底 + 极弱金色水光），以 screen 混合、低透明度叠加，
 * 不干扰文字、视频、灯箱与编辑模式。
 */
(function () {
  'use strict';
  if (window.__waterBgLoaded) return;
  window.__waterBgLoaded = true;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  if (reduce || !fine) return; // 减少动效 / 触屏设备：不启用

  // ---- 画布 ----
  var canvas = document.createElement('canvas');
  canvas.id = 'water-bg';
  canvas.setAttribute('aria-hidden', 'true');
  var st = canvas.style;
  st.position = 'fixed';
  st.left = '0';
  st.top = '0';
  st.width = '100%';
  st.height = '100%';
  st.zIndex = '9999';
  st.pointerEvents = 'none';
  st.opacity = '0.32';
  st.mixBlendMode = 'screen';
  (document.body || document.documentElement).appendChild(canvas);

  var ctx = canvas.getContext('2d');

  // ---- 低分辨率水波网格（与屏幕解耦，保证性能）----
  var SIM_W = 200, SIM_H = 120;
  var cur = new Float32Array(SIM_W * SIM_H);
  var prev = new Float32Array(SIM_W * SIM_H);

  // 离屏小画布：在此绘制水面，再放大铺满
  var off = document.createElement('canvas');
  off.width = SIM_W; off.height = SIM_H;
  var offCtx = off.getContext('2d');
  var out = offCtx.createImageData(SIM_W, SIM_H);

  // 基础水面图案（暗底 + 极淡金色水光/焦散），一次性生成
  var base = new Uint8ClampedArray(SIM_W * SIM_H * 4);
  (function buildBase() {
    for (var y = 0; y < SIM_H; y++) {
      for (var x = 0; x < SIM_W; x++) {
        var i = (y * SIM_W + x) * 4;
        var v = 10 + (1 - y / SIM_H) * 12;                                 // 上亮下暗的竖向渐变
        var caustic = (Math.sin(y * 0.17 + Math.sin(x * 0.05) * 1.4) * 0.5 + 0.5) * 14; // 横向水光
        var gold = Math.max(0, Math.sin(x * 0.028 + y * 0.02)) * 12;       // 金色
        base[i]     = v + gold * 1.0;
        base[i + 1] = v + gold * 0.7;
        base[i + 2] = v * 0.7 + caustic * 0.6 + gold * 0.3;
        base[i + 3] = 255;
      }
    }
  })();

  // ---- 可调参数（轻微适中）----
  var DAMP = 0.96;   // 阻尼：越接近 1 涟漪越持久
  var AMP = 5;       // 位移强度：水波折射幅度
  var lastT = 0, ambientTick = 0;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
    canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
  }
  resize();
  window.addEventListener('resize', resize);

  // 在网格坐标处注入扰动（负高度 = 凹陷，产生涟漪）
  function disturb(cx, cy, power) {
    var gx = Math.floor(cx / window.innerWidth * SIM_W);
    var gy = Math.floor(cy / window.innerHeight * SIM_H);
    var r = 7;
    for (var y = -r; y <= r; y++) {
      for (var x = -r; x <= r; x++) {
        var px = gx + x, py = gy + y;
        if (px < 1 || py < 1 || px >= SIM_W - 1 || py >= SIM_H - 1) continue;
        var d = Math.sqrt(x * x + y * y);
        if (d > r) continue;
        prev[py * SIM_W + px] -= power * (1 - d / r);
      }
    }
  }

  function step() {
    // 1) 水波传播
    for (var y = 1; y < SIM_H - 1; y++) {
      for (var x = 1; x < SIM_W - 1; x++) {
        var i = y * SIM_W + x;
        var val = (prev[i - 1] + prev[i + 1] + prev[i - SIM_W] + prev[i + SIM_W]) * 0.5 - cur[i];
        cur[i] = val * DAMP;
      }
    }
    var tmp = prev; prev = cur; cur = tmp; // 交换，prev 为最新

    // 2) 用高度场梯度做位移采样，生成折射水面
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

  // ---- 鼠标推动水面 ----
  var lastX = 0, lastY = 0, primed = false;
  window.addEventListener('pointermove', function (e) {
    if (!primed) { lastX = e.clientX; lastY = e.clientY; primed = true; return; }
    var vx = e.clientX - lastX, vy = e.clientY - lastY;
    var sp = Math.min(Math.sqrt(vx * vx + vy * vy), 40);
    disturb(e.clientX, e.clientY, 0.5 + sp * 0.04); // 速度越快，涟漪稍强
    lastX = e.clientX; lastY = e.clientY;
  }, { passive: true });

  // 极缓慢的环境微漾，让静止时也不是死水（很弱）
  function ambient() {
    ambientTick++;
    if (ambientTick % 24 === 0) {
      disturb(Math.random() * window.innerWidth, Math.random() * window.innerHeight, 0.2);
    }
  }

  function frame(t) {
    if (t - lastT >= 1000 / 60) { step(); ambient(); lastT = t; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
