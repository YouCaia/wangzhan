/* ============================================================
   perf-guard.js —— 全站性能守卫
   必须在 water-bg.js / color-bends.js / masonry-works.js 之前引入。

   解决的场景：
     - 远程桌面 / 虚拟机 / 无显卡驱动：浏览器 GPU 硬件加速被禁用，
       退到软件渲染（SwiftShader / Microsoft Basic Render）。
       此时「全屏 canvas + 全屏 WebGL + 十几处 backdrop-filter 模糊」
       会全部压到 CPU 上 → 一顿一顿。
     - 低配机器：背景每帧变化会让所有 backdrop-filter 图层每帧重算模糊。

   提供：
     window.__ycFX = { tier, noGpu, forced, water, bends, lens, waterFps, degrade(), killAll() }
   事件：
     'yc:fx-degrade' 一档降级（限帧 + 关水镜 + 降分辨率）
     'yc:fx-off'     全停（移除 canvas + 关闭全部 backdrop-filter）
   手动开关（用于对比排查，优先级高于自动判定）：
     ?fx=off  强制关闭全部特效   ?fx=on 强制开启（无视检测结果）
     localStorage.setItem('yc_fx','off'|'on') 可长期生效
   ============================================================ */
(function () {
  'use strict';
  if (window.__ycFX) return;

  var docEl = document.documentElement;

  /* ---------- 1) 手动开关 ---------- */
  var forced = null;
  try {
    var q = (location.search || '') + '&' + (location.hash || '').replace(/^#/, '');
    if (/[?&]fx=off/.test(q)) forced = false;
    else if (/[?&]fx=on/.test(q)) forced = true;
    else {
      var v = localStorage.getItem('yc_fx');
      if (v === 'off') forced = false; else if (v === 'on') forced = true;
    }
  } catch (e) {}

  /* ---------- 2) 软件渲染检测（远程桌面 / 虚拟机典型特征） ---------- */
  function detectNoGpu() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return true;
      var renderer = '';
      try {
        var ext = gl.getExtension('WEBGL_debug_renderer_info');
        renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      } catch (e2) { renderer = gl.getParameter(gl.RENDERER); }
      try { var lc = gl.getExtension('WEBGL_lose_context'); if (lc) lc.loseContext(); } catch (e3) {}
      renderer = String(renderer || '').toLowerCase();
      if (!renderer) return true;
      // SwiftShader / ANGLE 软件后端 / llvmpipe / Microsoft Basic Render Driver
      if (/swiftshader|llvmpipe|softpipe|software|basic render|basic render driver|mesa offscreen/.test(renderer)) return true;
      return false;
    } catch (e) { return true; }
  }

  var noGpu = detectNoGpu();
  var cores = navigator.hardwareConcurrency || 4;
  var mem = navigator.deviceMemory || 4;                 // Device Memory API，GiB
  var px = window.innerWidth * (window.devicePixelRatio || 1);
  var tier = (cores <= 4 || mem <= 4) ? 'low'
           : ((cores <= 8 || mem <= 8 || px > 2600) ? 'mid' : 'high');

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var fine = !window.matchMedia || window.matchMedia('(pointer: fine)').matches;
  var baseOn = !reduce && fine;

  var FX = {
    tier: tier,
    noGpu: noGpu,
    forced: forced,
    cores: cores,
    mem: mem,
    // 水波：软件渲染下保留但降到 24fps；光带（WebGL）在软件渲染下必须关
    water: forced !== null ? forced : baseOn,
    bends: forced !== null ? forced : (baseOn && !noGpu),
    lens: forced !== null ? forced : (baseOn && !noGpu && tier !== 'low'),
    waterFps: noGpu ? 24 : (tier === 'low' ? 30 : (tier === 'mid' ? 45 : 60)),
    killed: false
  };

  function emit(name) { try { window.dispatchEvent(new CustomEvent(name)); } catch (e) {} }

  FX.degrade = function () {
    if (FX.killed) return;
    docEl.classList.add('yc-soft');
    emit('yc:fx-degrade');
  };
  // 休眠降级：光带（WebGL）关闭，水波改为「静止时不重绘、只有指针划过才起涟漪」，
  // 同时关掉全部 backdrop-filter。比直接删除特效更体面，且几乎零持续开销。
  FX.hibernate = function () {
    if (FX.killed || FX.hibernateDone) return;
    FX.hibernateDone = true;
    FX.bends = false; FX.lens = false;
    docEl.classList.add('yc-soft');
    docEl.classList.add('yc-no-blur');
    emit('yc:fx-hibernate');
    try { console.info('[perf-guard] 帧率偏低，已进入省电模式：关闭光带与毛玻璃，水波仅在你移动鼠标时响应'); } catch (e) {}
  };
  FX.killAll = function () {
    if (FX.killed) return;
    FX.killed = true;
    FX.water = false; FX.bends = false; FX.lens = false;
    docEl.classList.add('yc-fx-off');
    docEl.classList.add('yc-no-blur');
    emit('yc:fx-off');
    try { console.info('[perf-guard] 帧率过低，已自动关闭全部视觉特效以保证流畅'); } catch (e) {}
  };

  // 软件渲染、或特效整体关闭（自动/手动）时，一并关掉所有 backdrop-filter：
  // 背景每帧变化会让这些模糊图层每帧重算，这是低配/远程桌面下最主要的开销。
  // 但 ?fx=on（用户强制开启）时不做任何降级。
  if (forced === false) {
    docEl.classList.add('yc-soft');
    docEl.classList.add('yc-no-blur');
    docEl.classList.add('yc-fx-off');
  } else if (forced !== true) {
    if (noGpu) { docEl.classList.add('yc-soft'); docEl.classList.add('yc-no-blur'); }
    if (!FX.water) { docEl.classList.add('yc-soft'); docEl.classList.add('yc-no-blur'); docEl.classList.add('yc-fx-off'); }
  }

  /* ---------- 3) 注入降级样式 ---------- */
  try {
    var css = document.createElement('style');
    css.setAttribute('data-perf-guard', '1');
    css.textContent =
      'html.yc-no-blur *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}' +
      'html.yc-fx-off #water-bg,html.yc-fx-off #color-bends,html.yc-fx-off #water-lens{display:none!important;}';
    (document.head || docEl).appendChild(css);
  } catch (e) {}

  /* ---------- 4) 运行时帧率看门狗（两级） ---------- */
  (function watchdog() {
    if (forced !== null || reduce) return;    // 手动指定 / 用户要求减少动效时不干预
    var phase = 1, frames = 0, t0 = 0;
    function tick(t) {
      if (!t0) { t0 = t; requestAnimationFrame(tick); return; }
      frames++;
      var el = t - t0;
      if (el < 2500) { requestAnimationFrame(tick); return; }
      var fps = frames / (el / 1000);
      if (phase === 1) {
        if (fps >= 45) return;                // 流畅，保持现状
        phase = 2; frames = 0; t0 = 0;
        FX.degrade();                          // 一档：限帧 + 关水镜 + 降分辨率
        requestAnimationFrame(tick);
      } else {
        if (fps < 32) FX.hibernate();            // 仍不流畅：进入休眠模式
      }
    }
    requestAnimationFrame(tick);
  })();

  window.__ycFX = FX;
})();
