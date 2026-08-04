/* ============================================================
   Masonry（React Bits 组件的纯原生 JS 移植，对应其 React + gsap 实现）
   依赖：window.gsap（已本地化 vendor/gsap.min.js）。
   仅用于首页「精选作品」区块，替换原网格卡片。
   特性：
     - 响应式多列瀑布流（按容器宽度自动计算列数）
     - 入场动画：从底部 + 模糊到清晰 + 交错淡入（gsap）
     - 默认黑白（grayscale），悬停变回彩色（CSS）
   暴露 window.buildHomeMasonry(listEl, items, onItemClick)
     items: [{ id, img, workKey }]
   ============================================================ */
(function () {
  'use strict';

  var gsap = window.gsap;

  // 按容器宽度决定列数（首页作品区最宽 max-w-5xl≈1024px，故桌面取 3 列）
  function columnsFor(width) {
    if (width >= 820) return 3;
    if (width >= 520) return 2;
    return 1;
  }

  // 高度变化系数，营造瀑布流错落感（图片多为 1:1，靠 span 制造差异）
  var SPANS = [1.0, 1.28, 0.86, 1.16, 1.0, 1.24, 0.92, 1.18, 1.05, 1.12, 0.95, 1.2];
  function spanFor(index) {
    return SPANS[index % SPANS.length];
  }

  // 计算并应用绝对定位布局（left/top 定位，避免与 gsap 的 transform 冲突）
  function layout(listEl) {
    var items = listEl._masonryItems;
    if (!items || !items.length) return;
    var width = listEl.clientWidth;
    if (!width) return;
    var columns = columnsFor(width);
    var columnWidth = width / columns;
    var colHeights = new Array(columns).fill(0);

    items.forEach(function (item) {
      var col = 0, min = colHeights[0];
      for (var c = 1; c < columns; c++) {
        if (colHeights[c] < min) { min = colHeights[c]; col = c; }
      }
      var h = columnWidth * item.span;
      var x = columnWidth * col;
      var y = colHeights[col];
      item.x = x; item.y = y; item.w = columnWidth; item.h = h;
      var el = item.el;
      el.style.width = columnWidth + 'px';
      el.style.height = h + 'px';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      // 列高递增（padding 已提供图片间视觉间距，此处不再额外加 gap）
      colHeights[col] += h;
    });

    var total = 0;
    for (var c = 0; c < columns; c++) total = Math.max(total, colHeights[c]);
    listEl.style.height = total + 'px';
  }

  function buildMasonry(listEl, items, onItemClick) {
    if (!listEl) return;
    listEl.innerHTML = '';

    // 构建 DOM
    listEl._masonryItems = items.map(function (it, idx) {
      var wrap = document.createElement('div');
      wrap.className = 'masonry-item';
      wrap.setAttribute('data-key', it.id);
      var img = document.createElement('div');
      img.className = 'masonry-item-img';
      if (it.img) img.style.backgroundImage = 'url("' + it.img + '")';
      wrap.appendChild(img);
      wrap.addEventListener('click', function () {
        if (onItemClick) onItemClick(it.workKey);
      });
      listEl.appendChild(wrap);
      return { id: it.id, img: it.img, workKey: it.workKey, span: spanFor(idx), el: wrap };
    });

    // 布局（同步，确保入场动画前位置已就绪）
    layout(listEl);

    // 入场动画：模糊→清晰 + 从底部上浮 + 交错淡入
    if (gsap) {
      var els = listEl._masonryItems.map(function (it) { return it.el; });
      gsap.set(els, { opacity: 0, y: 90, filter: 'blur(10px)' });
      gsap.to(els, {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.06,
        overwrite: 'auto'
      });
    }

    // 响应式：容器尺寸变化时重新布局
    if (listEl._masonryObserver) listEl._masonryObserver.disconnect();
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { layout(listEl); });
      ro.observe(listEl);
      listEl._masonryObserver = ro;
    } else {
      window.addEventListener('resize', function () { layout(listEl); });
    }
  }

  window.buildHomeMasonry = buildMasonry;
})();
