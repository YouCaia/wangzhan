/* 首页加载动画控制器
 * - 真实预加载首页瀑布流图片（用 Image 对象加载并计数）
 * - 进度条 = 已加载图片 / 总数；背后确实在访问资源
 * - 全部完成或超时兜底后，进度到 100%，淡出遮罩，随后由回调渲染瀑布流（图片已在缓存，秒显）
 * - 不依赖任何外部库，纯原生，避免引入额外失败点
 */
(function () {
  var overlay, barEl, pctEl;
  function cache() {
    overlay = document.getElementById('page-loader');
    barEl = document.getElementById('pl-bar');
    pctEl = document.getElementById('pl-pct');
  }
  function setProgress(p) {
    var v = Math.max(0, Math.min(100, Math.round(p * 100)));
    if (barEl) barEl.style.width = v + '%';
    if (pctEl) pctEl.textContent = v + '%';
  }
  function hide() {
    if (!overlay) cache();
    if (!overlay) return;
    if (overlay.classList.contains('pl-done')) return;
    overlay.classList.add('pl-done');
    setTimeout(function () { if (overlay) overlay.style.display = 'none'; }, 700);
  }

  // 真实预加载：并发加载所有 url，统计完成比例；任何图失败也推进，避免卡死
  function preload(urls, onComplete) {
    cache();
    if (!urls || !urls.length) { setProgress(1); onComplete(); return; }
    var total = urls.length;
    var loaded = 0;
    var finished = false;
    function tick() {
      loaded++;
      setProgress(loaded / total);
      if (loaded >= total && !finished) {
        finished = true;
        setProgress(1);
        onComplete();
      }
    }
    urls.forEach(function (u) {
      var im = new Image();
      im.onload = tick;
      im.onerror = tick; // 失败也计入，防止个别 503 卡住进度
      im.src = u;
    });
    // 超时兜底：跨境网络个别图可能极慢，最多等 10s 强制完成
    setTimeout(function () {
      if (!finished) { finished = true; setProgress(1); onComplete(); }
    }, 10000);
  }

  window.YCPreloader = {
    // urls: 需要预加载的图片地址数组；onComplete: 预加载结束后（图片已在缓存）的渲染回调
    run: function (urls, onComplete) {
      cache();
      setProgress(0.02);
      preload(urls, function () {
        if (onComplete) onComplete();      // 渲染瀑布流（图片从缓存秒显）
        setTimeout(hide, 250);             // 略作停顿再淡出，让用户看到 100%
      });
    },
    hide: hide
  };

  // 全局兜底：若 14s 后遮罩仍在（任何异常 / 脚本未加载），强制隐藏，避免永久白屏
  window.addEventListener('load', function () {
    setTimeout(function () {
      if (overlay && !overlay.classList.contains('pl-done')) hide();
    }, 14000);
  });
})();
