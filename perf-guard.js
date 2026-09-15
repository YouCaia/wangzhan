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
    // 特效一律保留（用户明确要求不能为了流畅牺牲观感）。
    // 软件渲染下靠「降低变化频率」而不是「删除特效」来换性能：
    //   - 光带本身变化极慢（speed 0.2），10fps 与 60fps 肉眼几乎无差，成本仅 1/6
    //   - 水波进休眠，静止时零重绘
    //   - 背景变化慢了，十几层 backdrop-filter 的重算频率也随之下降
    water: forced !== null ? forced : baseOn,
    bends: forced !== null ? forced : baseOn,
    lens: forced !== null ? forced : (baseOn && tier !== 'low' && !noGpu),
    waterFps: noGpu ? 24 : (tier === 'low' ? 30 : (tier === 'mid' ? 45 : 60)),
    bendsFps: noGpu ? 10 : (tier === 'low' ? 20 : (tier === 'mid' ? 30 : 60)),
    killed: false
  };

  function emit(name) { try { window.dispatchEvent(new CustomEvent(name)); } catch (e) {} }

  // 一档降级：优先砍掉最贵的 backdrop-filter 毛玻璃（实测单项约 15fps），
  // 而光带继续以低帧率流动 —— 保住背景氛围与亮度，这是观感优先级最高的部分。
  FX.degrade = function () {
    if (FX.killed) return;
    docEl.classList.add('yc-soft');
    docEl.classList.add('yc-no-blur');
    emit('yc:fx-degrade');
  };
  // 休眠降级（最低档，只在实测真的很卡时才触发）：
  //   - 光带：冻结最后一帧画面（不是删除！）—— 背景仍保留金色光带，不会变暗
  //   - 水波：静止时不重绘，指针划过才起涟漪
  //   - 毛玻璃：关闭（它是唯一必须关掉的，因为背景一动就要重算）
  //   - 光斑：停止漂浮，但光晕保留
  FX.hibernate = function () {
    if (FX.killed || FX.hibernateDone) return;
    FX.hibernateDone = true;
    FX.lens = false;
    docEl.classList.add('yc-soft');
    docEl.classList.add('yc-no-blur');
    emit('yc:fx-hibernate');
    try { console.info('[perf-guard] 已切到省电模式：光带冻结为静态背景（亮度保留）· 毛玻璃关闭 · 水波仅在移动鼠标时响应'); } catch (e) {}
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
  // 软件渲染下不再主动关闭毛玻璃 —— 它决定 UI 质感，且背景变化频率降低后
  // 它的重算频率也会跟着降下来。只在看门狗实测帧率确实不达标时才降级。
  if (forced === false) {
    docEl.classList.add('yc-soft');
    docEl.classList.add('yc-no-blur');
    docEl.classList.add('yc-fx-off');
  } else if (forced !== true) {
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

  /* ---------- 4) 运行时帧率看门狗（持续监测 + 两级降级） ----------
   * 注意：不能只测一次！实测表明卡顿往往出现在「滚动浏览之后」——
   * 页面变重、图片全部解码、动效叠加，此时帧率才会掉下来。
   * 因此这里做长驻低频监测：每 2 秒统计一次平均帧率，连续偏低才降级。
   * 计数本身只有一个自增，开销可忽略。
   * ---------------------------------------------------------- */
  (function watchdog() {
    if (forced !== null || reduce) return;    // 手动指定 / 用户要求减少动效时不干预
    var phase = 0, frames = 0, t0 = 0, lowCount = 0;
    function tick(t) {
      if (phase >= 2) return;                 // 已降到最低档，停止监测
      requestAnimationFrame(tick);
      if (!t0) { t0 = t; return; }
      frames++;
      var el = t - t0;
      if (el < 2000) return;
      var fps = frames / (el / 1000);
      frames = 0; t0 = t;
      // 两档用不同阈值：一档 38fps 触发，二档要真的到 30fps 以下才继续降，
      // 避免在临界值反复横跳导致一降到底、把光带也冻掉。
      var low = fps < (phase === 0 ? 38 : 30);
      if (low) lowCount++; else lowCount = 0;
      if (lowCount >= 2 && phase === 0) { phase = 1; lowCount = 0; FX.degrade(); }
      else if (lowCount >= 3 && phase === 1) { phase = 2; FX.hibernate(); }
    }
    requestAnimationFrame(tick);
  })();

  window.__ycFX = FX;
})();
