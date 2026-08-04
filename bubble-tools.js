/* ============================================================
   BubbleMenu 风格工具 pill 入场动画
   进入 skills.html 时自动播放：pill 从 scale 0 弹开 + 标签淡入。
   ============================================================ */

(function () {
  var grid = document.getElementById('toolPillGrid');
  if (!grid) return;

  var pills = grid.querySelectorAll('.tool-pill');
  var labels = grid.querySelectorAll('.tool-pill-label');
  var played = false;

  function play() {
    if (played) return;
    played = true;

    if (typeof gsap === 'undefined') {
      // GSAP 未加载时直接显示
      pills.forEach(function (p) { p.style.transform = 'scale(1)'; });
      labels.forEach(function (l) { l.style.opacity = '1'; });
      return;
    }

    gsap.set(pills, { scale: 0, transformOrigin: '50% 50%' });
    gsap.set(labels, { y: 24, autoAlpha: 0 });

    pills.forEach(function (pill, i) {
      var delay = i * 0.12 + gsap.utils.random(-0.05, 0.05);
      var tl = gsap.timeline({ delay: delay });

      tl.to(pill, {
        scale: 1,
        duration: 0.5,
        ease: 'back.out(1.5)'
      });

      if (labels[i]) {
        tl.to(labels[i], {
          y: 0,
          autoAlpha: 1,
          duration: 0.5,
          ease: 'power3.out'
        }, '-=0.45');
      }
    });
  }

  // 页面加载后触发（优先 load，确保 GSAP 已就位）
  if (document.readyState === 'complete') {
    play();
  } else {
    window.addEventListener('load', play);
  }
})();
