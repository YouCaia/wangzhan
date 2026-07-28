/* ============================================================
 * cursor-trail.js — 柔光金点 + 流动拖尾（鼠标跟随粒子）
 * 纯叠加层：pointer-events:none，绝不拦截点击（视频/按钮/编辑均正常）
 * 仅在支持 hover 的桌面、且用户未设置「减少动效」时启用
 * 配色取站点金色 --gold-light (#f0d089)
 * ============================================================ */
(function () {
  // 触屏 / 减少动效偏好：直接跳过，避免异常或不适
  if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var COL = [240, 208, 137]; // gold-light
  var MAX_POINTS = 20;       // 拖尾长度
  var HOVER_SEL = 'a,button,[data-edit],.work-card,.wd-gallery,video,.avatar-wrap,.qr-trigger';

  var canvas = document.createElement('canvas');
  canvas.id = 'cursor-trail';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;' +
    'pointer-events:none;z-index:9999;mix-blend-mode:screen;';
  document.body.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;

  function resize() {
    W = canvas.width = Math.floor(window.innerWidth * dpr);
    H = canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }
  resize();
  window.addEventListener('resize', resize);

  var points = [];
  var mouse = { x: -9999, y: -9999 };
  var big = false;

  window.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX * dpr;
    mouse.y = e.clientY * dpr;
    // 命中可交互元素时放大变亮，增强「互动感」
    big = !!(e.target && e.target.closest && e.target.closest(HOVER_SEL));
  });
  // 鼠标离开窗口时清空，避免拖尾卡在边缘
  window.addEventListener('mouseout', function (e) {
    if (!e.relatedTarget) { mouse.x = -9999; mouse.y = -9999; points.length = 0; }
  });

  function glow(x, y, radius, alpha) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, 'rgba(' + COL[0] + ',' + COL[1] + ',' + COL[2] + ',' + alpha + ')');
    g.addColorStop(1, 'rgba(' + COL[0] + ',' + COL[1] + ',' + COL[2] + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function frame() {
    if (mouse.x > -9000) {
      points.push({ x: mouse.x, y: mouse.y });
      if (points.length > MAX_POINTS) points.shift();
    }
    ctx.clearRect(0, 0, W, H);

    var n = points.length;
    for (var i = 0; i < n; i++) {
      var p = points[i];
      var t = i / n; // 越新越大越亮
      var r = (big ? 9 : 5.5) * dpr * (0.35 + t * 0.85);
      var a = (big ? 0.45 : 0.3) * t;
      glow(p.x, p.y, r, a);
    }
    // 主光点（最亮、最小）
    if (mouse.x > -9000) {
      var r2 = (big ? 13 : 8) * dpr;
      glow(mouse.x, mouse.y, r2, big ? 0.85 : 0.65);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
