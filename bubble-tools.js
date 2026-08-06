/* ============================================================
   BubbleMenu 风格工具 pill 入场动画 + 点击放大选中
   进入 skills.html 时自动播放：pill 从 scale 0 弹开 + 标签淡入。
   点击 pill 放大并保持（互斥）。
   ============================================================ */

(function () {
  var grid = document.getElementById('toolPillGrid');
  if (!grid) return;

  var pills = grid.querySelectorAll('.tool-pill');
  var labels = grid.querySelectorAll('.tool-pill-label');
  var played = false;

  function getRot(el) {
    var v = getComputedStyle(el).getPropertyValue('--item-rot');
    return parseFloat(v) || 0;
  }

  function bindClicks() {
    pills.forEach(function (pill) {
      pill.addEventListener('click', function () {
        var wasActive = pill.classList.contains('is-active');
        pills.forEach(function (p) { p.classList.remove('is-active'); });
        if (!wasActive) pill.classList.add('is-active');
      });
    });
  }

  function play() {
    if (played) return;
    played = true;

    // 移除 preload（由 inline 脚本加上的首屏隐藏），交还给 GSAP/CSS 控制
    grid.classList.remove('preload');

    if (typeof gsap === 'undefined') {
      pills.forEach(function (p) { p.style.transform = 'scale(1)'; });
      labels.forEach(function (l) { l.style.opacity = '1'; });
      bindClicks();
      return;
    }

    // 入场时即带旋转角度，避免动画结束后出现角度跳变
    pills.forEach(function (pill) {
      gsap.set(pill, { scale: 0, rotation: getRot(pill), transformOrigin: '50% 50%' });
    });
    gsap.set(labels, { y: 24, autoAlpha: 0 });

    var tl = gsap.timeline({
      onComplete: function () {
        // 交还 transform 给 CSS 控制（旋转 / hover / 点击放大）
        pills.forEach(function (p) { gsap.set(p, { clearProps: 'transform' }); });
        bindClicks();
      }
    });

    pills.forEach(function (pill, i) {
      var delay = i * 0.12 + gsap.utils.random(-0.05, 0.05);
      tl.to(pill, { scale: 1, duration: 0.5, ease: 'back.out(1.5)' }, delay);
      if (labels[i]) {
        tl.to(labels[i], { y: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' }, delay + 0.05);
      }
    });
  }

  if (document.readyState === 'complete') {
    play();
  } else {
    window.addEventListener('load', play);
  }
})();
