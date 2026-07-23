/**
 * 通用全屏图片查看器
 * 用法：openLightbox(['url1.jpg','url2.jpg'], 0)
 */
(function () {
  'use strict';

  // 注入样式
  const style = document.createElement('style');
  style.textContent = `
    .wb-lightbox {
      position: fixed;
      inset: 0;
      z-index: 30000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    .wb-lightbox.active {
      opacity: 1;
      pointer-events: auto;
    }
    .wb-lightbox-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(5, 5, 8, 0.94);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .wb-lightbox-stage {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      z-index: 1;
    }
    .wb-lightbox-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      user-select: none;
      -webkit-user-drag: none;
      cursor: zoom-out;
      transition: transform 0.15s ease-out;
      will-change: transform;
    }
    .wb-lightbox-img.grabbing {
      cursor: grabbing;
    }
    .wb-lightbox-video {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      border-radius: 8px;
      cursor: default;
      background: #000;
    }
    .wb-lightbox-close {
      position: absolute;
      top: 18px;
      right: 24px;
      width: 44px;
      height: 44px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 50%;
      background: rgba(255,255,255,0.08);
      color: #fff;
      font-size: 28px;
      line-height: 1;
      cursor: pointer;
      z-index: 3;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, transform 0.2s;
    }
    .wb-lightbox-close:hover {
      background: rgba(255,255,255,0.18);
      transform: scale(1.05);
    }
    .wb-lightbox-counter {
      position: absolute;
      top: 28px;
      left: 24px;
      color: rgba(255,255,255,0.75);
      font-size: 13px;
      letter-spacing: 0.05em;
      z-index: 3;
    }
    .wb-lightbox-hint {
      position: absolute;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(255,255,255,0.45);
      font-size: 12px;
      white-space: nowrap;
      z-index: 3;
      pointer-events: none;
    }
    .wb-lightbox-arrow {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 48px;
      height: 48px;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 50%;
      background: rgba(255,255,255,0.08);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 3;
      opacity: 0;
      transition: opacity 0.2s, background 0.2s;
    }
    .wb-lightbox:hover .wb-lightbox-arrow {
      opacity: 1;
    }
    .wb-lightbox-arrow:hover {
      background: rgba(255,255,255,0.18);
    }
    .wb-lightbox-arrow.prev { left: 16px; }
    .wb-lightbox-arrow.next { right: 16px; }
    .wb-lightbox-arrow:disabled {
      opacity: 0.15 !important;
      cursor: default;
    }
    @media (max-width: 768px) {
      .wb-lightbox-arrow { display: none; }
      .wb-lightbox-hint { font-size: 11px; }
    }
  `;
  if (document.head) document.head.appendChild(style);

  // 创建 DOM
  const box = document.createElement('div');
  box.className = 'wb-lightbox';
  box.innerHTML = `
    <div class="wb-lightbox-backdrop"></div>
    <button class="wb-lightbox-close" aria-label="关闭">&times;</button>
    <div class="wb-lightbox-counter">1 / 1</div>
    <button class="wb-lightbox-arrow prev" aria-label="上一张"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
    <button class="wb-lightbox-arrow next" aria-label="下一张"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>
    <div class="wb-lightbox-stage">
      <img class="wb-lightbox-img" src="" alt="">
      <video class="wb-lightbox-video" src="" style="display:none"></video>
    </div>
    <div class="wb-lightbox-hint">点击图片关闭 · 滚轮缩放 · 左右滑动切换</div>
  `;
  // 兼容脚本放在 <head> 的情况：此时 document.body 尚不存在，延迟到 DOM 就绪再挂载
  function mountBox() {
    if (box.parentNode) return;
    (document.body || document.documentElement).appendChild(box);
  }
  if (document.body) mountBox();
  else document.addEventListener('DOMContentLoaded', mountBox);

  const img = box.querySelector('.wb-lightbox-img');
  const video = box.querySelector('.wb-lightbox-video');
  const counter = box.querySelector('.wb-lightbox-counter');
  const btnPrev = box.querySelector('.wb-lightbox-arrow.prev');
  const btnNext = box.querySelector('.wb-lightbox-arrow.next');
  const backdrop = box.querySelector('.wb-lightbox-backdrop');

  let urls = [];
  let index = 0;
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let pinchStartDist = 0;
  let pinchStartScale = 1;

  function folderNameFromUrl(url) {
    try {
      const decoded = decodeURIComponent(url);
      const parts = decoded.split('/');
      const last = parts[parts.length - 1];
      return last.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
    } catch (e) {
      return '';
    }
  }

  function applyTransform(animate) {
    img.style.transition = animate ? 'transform 0.2s ease-out' : 'none';
    img.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + scale + ')';
  }

  function resetTransform() {
    scale = 1;
    tx = 0;
    ty = 0;
    applyTransform(true);
  }

  function update() {
    const url = urls[index] || '';
    const isVid = /\.(mp4|webm|mov|m4v|ogg)$/i.test(url);
    if (isVid) {
      img.style.display = 'none';
      video.style.display = '';
      video.src = url;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.loop = false;
      video.play().catch(function(){});
    } else {
      video.style.display = 'none';
      try { video.pause(); } catch (_) {}
      video.removeAttribute('src');
      try { video.load(); } catch (_) {}
      img.style.display = '';
      img.src = url;
    }
    counter.textContent = urls.length > 1 ? (index + 1) + ' / ' + urls.length : '';
    btnPrev.disabled = index <= 0;
    btnNext.disabled = index >= urls.length - 1;
    resetTransform();
  }

  function open(u, startIdx) {
    if (!u || !u.length) return;
    urls = u;
    index = Math.max(0, Math.min(startIdx || 0, urls.length - 1));
    update();
    box.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    box.classList.remove('active');
    document.body.style.overflow = '';
    try { video.pause(); } catch (_) {}
    video.style.display = 'none';
    setTimeout(() => { img.src = ''; video.removeAttribute('src'); }, 300);
  }

  function prev() {
    if (index > 0) { index--; update(); }
  }

  function next() {
    if (index < urls.length - 1) { index++; update(); }
  }

  // 关闭事件
  box.querySelector('.wb-lightbox-close').addEventListener('click', close);
  backdrop.addEventListener('click', close);

  // 点击图片关闭
  img.addEventListener('click', function (e) {
    e.stopPropagation();
    close();
  });
  // 点击视频不关闭（让用户可以操作播放控件），仅 backdrop / 关闭按钮关闭
  video.addEventListener('click', function (e) {
    e.stopPropagation();
  });

  // 双击缩放
  img.addEventListener('dblclick', function (e) {
    e.stopPropagation();
    if (scale > 1.1) {
      resetTransform();
    } else {
      scale = 2.5;
      applyTransform(true);
    }
  });

  // 滚轮缩放
  box.addEventListener('wheel', function (e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    scale = Math.max(0.5, Math.min(5, scale + delta));
    applyTransform(false);
  }, { passive: false });

  // 拖动平移
  img.addEventListener('mousedown', function (e) {
    e.preventDefault();
    isDragging = true;
    dragStartX = e.clientX - tx;
    dragStartY = e.clientY - ty;
    img.classList.add('grabbing');
  });
  window.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    tx = e.clientX - dragStartX;
    ty = e.clientY - dragStartY;
    applyTransform(false);
  });
  window.addEventListener('mouseup', function () {
    isDragging = false;
    img.classList.remove('grabbing');
  });

  // Touch：单指拖动 / 双指缩放 / 滑动切换
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  img.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
      dragStartX = touchStartX - tx;
      dragStartY = touchStartY - ty;
      isDragging = true;
      img.classList.add('grabbing');
    } else if (e.touches.length === 2) {
      isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist = Math.sqrt(dx * dx + dy * dy);
      pinchStartScale = scale;
    }
  }, { passive: false });

  img.addEventListener('touchmove', function (e) {
    if (e.touches.length === 1 && isDragging) {
      e.preventDefault();
      const cx = e.touches[0].clientX;
      const cy = e.touches[0].clientY;
      tx = cx - dragStartX;
      ty = cy - dragStartY;
      applyTransform(false);
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (pinchStartDist > 0) {
        scale = Math.max(0.5, Math.min(5, pinchStartScale * (dist / pinchStartDist)));
        applyTransform(false);
      }
    }
  }, { passive: false });

  img.addEventListener('touchend', function (e) {
    img.classList.remove('grabbing');
    if (urls.length <= 1 || scale > 1.1) {
      isDragging = false;
      return;
    }
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - touchStartX;
    const dy = endY - touchStartY;
    const dt = Date.now() - touchStartTime;
    const threshold = window.innerWidth * 0.18;
    // 水平滑动切换
    if (Math.abs(dx) > Math.abs(dy) && (Math.abs(dx) > threshold || (Math.abs(dx) > 40 && dt < 250))) {
      if (dx < 0 && index < urls.length - 1) next();
      else if (dx > 0 && index > 0) prev();
    }
    isDragging = false;
  });

  // 箭头按钮
  btnPrev.addEventListener('click', function (e) { e.stopPropagation(); prev(); });
  btnNext.addEventListener('click', function (e) { e.stopPropagation(); next(); });

  // 键盘
  document.addEventListener('keydown', function (e) {
    if (!box.classList.contains('active')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  });

  // 暴露全局
  window.openLightbox = open;
  window.closeLightbox = close;
})();

// === 共享：A+ 内容区渲染（首页 + 作品页 100% 共用同一个函数，物理上不可能产生不同结果）===
(function () {
  'use strict';

  // 1) 注入最高优先级的 A+ 防漏样式（!important 覆盖 .work-detail-main img 等任何父级规则）
  var STYLE_ID = 'youcai-aplus-bulletproof';
  if (!document.getElementById(STYLE_ID)) {
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.aplus-section { margin-top: 48px; }',
      '.aplus-container {',
      '  width: 100% !important;',
      '  display: flex !important;',
      '  flex-direction: column !important;',
      '  gap: 0 !important;',
      '  margin: 0 !important;',
      '  padding: 0 !important;',
      '}',
      '.aplus-container.gapped { gap: 16px !important; }',
      '.aplus-item {',
      '  width: 100% !important;',
      '  display: flex !important;',
      '  justify-content: center !important;',
      '  align-items: center !important;',
      '  overflow: hidden !important;',
      '  background: #141414 !important;',
      '  line-height: 0 !important;',
      '  font-size: 0 !important;',
      '  margin: 0 !important;',
      '  padding: 0 !important;',
      '}',
      '.aplus-item.gapped { border-radius: 12px; }',
      '.aplus-item img, .aplus-item video {',
      '  width: 100% !important;',
      '  height: auto !important;',
      '  display: block !important;',
      '  margin: 0 !important;',
      '  padding: 0 !important;',
      '  border-radius: 0 !important;',
      '}',
      '.aplus-size-970  { max-width: 970px;  margin-left: auto !important; margin-right: auto !important; }',
      '.aplus-size-1460 { max-width: 1460px; margin-left: auto !important; margin-right: auto !important; }',
      // 兼容旧 wd-aplus-* 命名（防止任何旧 CSS 残留生效）
      '.wd-aplus-section { margin-top: 48px; }',
      '.wd-aplus-grid { display: flex !important; flex-direction: column !important; gap: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }',
      '.wd-aplus-grid.gapped { gap: 16px !important; }',
      '.wd-aplus-item { width: 100% !important; display: flex !important; justify-content: center !important; align-items: center !important; margin: 0 !important; padding: 0 !important; line-height: 0 !important; font-size: 0 !important; }',
      '.wd-aplus-item img, .wd-aplus-item video { width: 100% !important; height: auto !important; display: block !important; margin: 0 !important; padding: 0 !important; border-radius: 0 !important; }'
    ].join('\n');
    if (document.head) document.head.appendChild(s);
    else document.addEventListener('DOMContentLoaded', function () { document.head.appendChild(s); });
  }

  // 2) 共享渲染函数：返回 .aplus-section DOM 元素
  function renderAplusSection(opts) {
    opts = opts || {};
    var images = opts.images || [];

    var section = document.createElement('div');
    section.className = 'aplus-section';
    // 仅当有标题/描述时，才与上方内容拉开 48px 间距；否则保持紧贴（与原 works.html 行为一致）
    section.style.cssText = (opts.title || opts.desc) ? 'margin-top: 48px;' : 'margin-top: 0;';

    if (images.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'wd-empty';
      empty.textContent = '暂无 A+ 内容';
      section.appendChild(empty);
      return section;
    }

    if (opts.title) {
      var label = document.createElement('div');
      label.className = 'work-detail-section-label';
      label.textContent = opts.title;
      section.appendChild(label);
    }

    if (opts.desc) {
      var desc = document.createElement('p');
      desc.style.cssText = 'color: rgba(255,255,255,0.5); font-size: 14px; line-height: 1.7; margin: 0 0 24px 0; max-width: 600px;';
      desc.textContent = opts.desc;
      section.appendChild(desc);
    }

    var gap = opts.gap || opts.mode || 'seamless';
    var isGapped = gap === 'gapped';

    var grid = document.createElement('div');
    grid.className = 'aplus-container' + (isGapped ? ' gapped' : '');
    // 内联保险：即使外部 CSS 漏到这里也强制无缝
    grid.style.cssText = 'width: 100%; display: flex; flex-direction: column; gap: ' + (isGapped ? '16px' : '0') + '; margin: 0; padding: 0;';
    section.appendChild(grid);

    var createMedia = opts.createMedia;
    // openLightbox 优先用调用方传入的（兼容 IIFE 内引用），否则用 window.openLightbox
    var aplusImageUrls = opts.aplusImageUrls || [];
    var mainImageUrlsCount = opts.mainImageUrlsCount || 0;
    var lightboxUrls = opts.lightboxUrls || [];
    var altPrefix = opts.altPrefix || 'A+ 内容';
    var openLightboxFn = opts.openLightbox || window.openLightbox;

    images.forEach(function (item, i) {
      var width = item.width || 970;
      var div = document.createElement('div');
      div.className = 'aplus-item aplus-size-' + width + (isGapped ? ' gapped' : '');
      // 内联保险：彻底杜绝父级 .work-detail-main img 之类的 margin/border-radius 漏到 A+
      div.style.cssText = 'width: 100%; display: flex; justify-content: center; align-items: center; overflow: hidden; background: #141414; line-height: 0; font-size: 0; margin: 0; padding: 0;';

      var media = createMedia ? createMedia(item.src, altPrefix + ' ' + (i + 1)) : null;
      if (media && media.tagName === 'IMG') {
        media.style.cssText = 'width: 100%; height: auto; display: block; margin: 0; padding: 0; border-radius: 0;';
        media.style.cursor = 'zoom-in';
        media.addEventListener('click', function () {
          var idx = aplusImageUrls.indexOf(item.src);
          if (idx >= 0 && openLightboxFn) openLightboxFn(lightboxUrls, mainImageUrlsCount + idx);
        });
      }
      if (media) div.appendChild(media);
      grid.appendChild(div);
    });

    return section;
  }

  // 3) 暴露到全局（兼容 lightbox.js 在 <head> 加载的情况）
  function expose() { window.renderAplusSection = renderAplusSection; }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', expose);
  } else {
    expose();
  }
})();
