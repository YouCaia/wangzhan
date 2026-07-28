/* ============================================================
 * work-particles.js — 首页底部「作品碎片」互动区
 * 读取全局 workData / mediaSrc，用 Matter.js 物理引擎把作品缩略图
 * 从左侧像瀑布一样涌入，鼠标移过即产生「退散」力场。
 * 金色协调；移动端减量；用户开启「减少动效」时跳过。
 * 依赖：vendor/matter.min.js（须在本文件之前引入）
 * ============================================================ */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof Matter === 'undefined') return;
  if (typeof workData === 'undefined' || typeof mediaSrc === 'undefined') return;

  var section = document.getElementById('work-particles');
  var canvas = document.getElementById('work-particles-canvas');
  if (!section || !canvas) return;

  var isTouch = !!(window.matchMedia && window.matchMedia('(hover: none)').matches);

  // 收集作品缩略图（每个作品取第一张非视频主图）
  var urls = [];
  Object.keys(workData).forEach(function (k) {
    var d = workData[k];
    if (!d || !d.folder || !d.main) return;
    for (var i = 0; i < d.main.length; i++) {
      var f = d.main[i];
      if (/\.(mp4|webm|mov|m4v|ogg)$/i.test(f)) continue;
      urls.push(mediaSrc(d.folder, f));
      break;
    }
  });
  if (urls.length < 1) return;

  // 预加载并记录自然尺寸（用于等比缩放贴图）
  var dims = {};
  var done = 0;
  urls.forEach(function (u) {
    var im = new Image();
    im.onload = function () {
      dims[u] = { w: im.naturalWidth || 100, h: im.naturalHeight || 100 };
      if (++done === urls.length) init();
    };
    im.onerror = function () {
      dims[u] = { w: 100, h: 100 };
      if (++done === urls.length) init();
    };
    im.src = u;
  });

  function rand(a, b) { return a + Math.random() * (b - a); }

  function init() {
    var W = section.clientWidth;
    var H = section.clientHeight || 420;

    var Engine = Matter.Engine, Render = Matter.Render, Runner = Matter.Runner,
        Bodies = Matter.Bodies, Composite = Matter.Composite, Body = Matter.Body, Events = Matter.Events;

    var engine = Engine.create();
    engine.world.gravity.y = 0.35;

    var render = Render.create({
      canvas: canvas,
      engine: engine,
      options: { width: W, height: H, background: '#0a0a0a', wireframes: false, pixelRatio: 1 }
    });

    // 边界：底 / 左 / 右（顶部开放，碎片从左侧涌入）
    var wallOpt = { isStatic: true, render: { visible: false } };
    var ground = Bodies.rectangle(W / 2, H + 40, W + 400, 80, wallOpt);
    var leftWall = Bodies.rectangle(-40, H / 2, 80, H * 3, wallOpt);
    var rightWall = Bodies.rectangle(W + 40, H / 2, 80, H * 3, wallOpt);
    Composite.add(engine.world, [ground, leftWall, rightWall]);

    var COUNT = isTouch ? 22 : 44;
    var particles = [];

    function spawn(initial) {
      var url = urls[Math.floor(Math.random() * urls.length)];
      var d = dims[url] || { w: 100, h: 100 };
      var size = rand(46, 84);                 // 显示边长
      var scale = size / d.w;                 // 等比缩放（body 高度按图比例）
      var x = initial ? rand(-60, W * 0.5) : rand(-140, -20);
      var y = rand(20, H - 20);
      var body = Bodies.rectangle(x, y, size, size * (d.h / d.w), {
        restitution: 0.45,
        friction: 0.04,
        frictionAir: 0.02,
        render: { sprite: { texture: url, xScale: scale, yScale: scale } }
      });
      Body.setAngle(body, rand(-0.3, 0.3));
      Body.setVelocity(body, { x: rand(1.5, 3.5), y: rand(0, 1.5) }); // 向右下涌入
      Body.setAngularVelocity(body, rand(-0.02, 0.02));
      return body;
    }

    for (var i = 0; i < COUNT; i++) particles.push(spawn(true));
    Composite.add(engine.world, particles);

    // 鼠标退散力场
    var mouse = { x: -9999, y: -9999, active: false };
    canvas.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.active = true;
    });
    canvas.addEventListener('mouseleave', function () { mouse.active = false; });

    var R = isTouch ? 90 : 140;
    Events.on(engine, 'beforeUpdate', function () {
      if (mouse.active) {
        for (var i = 0; i < particles.length; i++) {
          var b = particles[i];
          var dx = b.position.x - mouse.x;
          var dy = b.position.y - mouse.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < R && dist > 0.5) {
            var mag = ((R - dist) / R) * ((R - dist) / R) * 0.0016 * b.mass; // 近强远弱
            Body.applyForce(b, b.position, { x: (dx / dist) * mag, y: (dy / dist) * mag });
          }
        }
      }
      // 循环：贴右墙且几乎静止的碎片重置回左侧，维持瀑布流动
      for (var j = 0; j < particles.length; j++) {
        var pb = particles[j];
        if (pb.position.x > W - 10 && Math.abs(pb.velocity.x) < 0.6) {
          Body.setPosition(pb, { x: rand(-140, -20), y: rand(20, H - 20) });
          Body.setVelocity(pb, { x: rand(1.5, 3.5), y: rand(0, 1.5) });
        }
      }
    });

    Render.run(render);
    Runner.run(Runner.create(), engine);

    // 自适应尺寸
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        var nW = section.clientWidth, nH = section.clientHeight || 420;
        render.canvas.width = nW; render.canvas.height = nH;
        render.options.width = nW; render.options.height = nH;
        Body.setPosition(ground, { x: nW / 2, y: nH + 40 });
        Body.setPosition(rightWall, { x: nW + 40, y: nH / 2 });
      }, 200);
    });
  }
})();
