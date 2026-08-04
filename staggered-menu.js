/* ============================================================
   StaggeredMenu — 原生 JS 移植（对应 React Bits 的 React 组件）
   依赖：vendor/gsap.min.js（已本地化）。动画时间轴 1:1 复刻原组件。
   所有菜单项 / 社交 / 颜色都集中在下面的 CONFIG 里，自行修改即可。

   交互约定（按站长需求）：
   - 切换按钮只保留图标：关闭态=三横，打开态=叉（X）。无文字。
   - 菜单项点击跳转到独立页面（非页内锚点）。
   - 底部社交点击弹出信息层（微信/邮箱可复制，小红书/抖音暂未注册）。
   ============================================================ */
(function () {
  'use strict';

  var root = document.getElementById('sm-root');
  if (!root) return;
  var gsap = window.gsap;

  /* ====================== 配置区（可改） ====================== */
  var CONFIG = {
    // 滑入前的彩色底层（金色层，从深金到亮金，最多 4 个，会自动去掉中间一个做错位）
    colors: ['#5a4420', '#b8862f', '#d4a857'],
    // 菜单项：label 显示文字，link 跳转地址（均为独立页面）
    items: [
      { label: '首页', ariaLabel: '返回首页', link: 'index.html' },
      { label: '作品', ariaLabel: '查看作品集', link: 'works.html' },
      { label: '技能', ariaLabel: '查看技能与软件', link: 'skills.html' },
      { label: '信息', ariaLabel: '关于我的详细信息', link: 'info.html' },
      { label: '联系', ariaLabel: '查看联系方式', link: 'contact.html' }
    ],
    // 社交：点击弹窗。display=弹窗中显示的值（无前缀、无标题），copy=双击复制的内容（为空则不可复制）
    socialItems: [
      { label: '微信', display: 'ZhangdeShuaideZYC', copy: 'ZhangdeShuaideZYC' },
      { label: '小红书', display: '暂未注册', copy: '' },
      { label: '抖音', display: '暂未注册', copy: '' },
      { label: '邮箱', display: '1725067686@qq.com', copy: '1725067686@qq.com' }
    ],
    displaySocials: true,
    displayItemNumbering: true,
    menuButtonColor: '#f0d089',
    openMenuButtonColor: '#f0d089',
    changeMenuColorOnOpen: false,
    closeOnClickAway: true
  };

  var position = root.getAttribute('data-position') || 'right';
  var offscreen = position === 'left' ? -100 : 100;

  /* ---------- 构建 DOM（等价原组件的 JSX 渲染） ---------- */
  var preContainer = document.getElementById('sm-prelayers');
  var list = document.getElementById('sm-list');
  var socialsWrap = document.getElementById('sm-socials');
  var socialsList = document.getElementById('sm-socials-list');
  var toggleBtn = document.getElementById('sm-toggle');
  var panel = document.getElementById('sm-panel');
  var icon = document.getElementById('sm-icon');
  var barTop = document.getElementById('sm-barTop');
  var barMid = document.getElementById('sm-barMid');
  var barBot = document.getElementById('sm-barBot');

  // prelayers
  preContainer.innerHTML = '';
  var raw = CONFIG.colors.slice(0, 4);
  if (raw.length >= 3) raw.splice(Math.floor(raw.length / 2), 1);
  raw.forEach(function (c) {
    var d = document.createElement('div');
    d.className = 'sm-prelayer';
    d.style.background = c;
    preContainer.appendChild(d);
  });

  // items
  if (CONFIG.displayItemNumbering) list.setAttribute('data-numbering', '');
  else list.removeAttribute('data-numbering');
  list.innerHTML = '';
  CONFIG.items.forEach(function (it, idx) {
    var li = document.createElement('li');
    li.className = 'sm-itemWrap';
    var a = document.createElement('a');
    a.className = 'sm-item';
    a.href = it.link;
    a.setAttribute('aria-label', it.ariaLabel || it.label);
    a.setAttribute('data-index', idx + 1);
    var span = document.createElement('span');
    span.className = 'sm-itemLabel';
    span.textContent = it.label;
    a.appendChild(span);
    li.appendChild(a);
    list.appendChild(li);
  });

  // socials（按钮 + 弹窗数据）
  if (CONFIG.displaySocials && CONFIG.socialItems && CONFIG.socialItems.length) {
    socialsWrap.style.display = '';
    socialsList.innerHTML = '';
    CONFIG.socialItems.forEach(function (s) {
      var li = document.createElement('li');
      li.className = 'sm-socials-item';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sm-socials-link';
      btn.textContent = s.label;
      btn.setAttribute('data-label', s.label);
      btn.setAttribute('data-display', s.display);
      btn.setAttribute('data-copy', s.copy || '');
      li.appendChild(btn);
      socialsList.appendChild(li);
    });
  } else {
    socialsWrap.style.display = 'none';
  }

  /* ---------- 社交弹窗（注入 DOM，全页通用） ---------- */
  var popup = document.createElement('div');
  popup.className = 'sm-popup';
  popup.id = 'sm-popup';
  popup.setAttribute('aria-hidden', 'true');
  popup.innerHTML =
    '<div class="sm-popup-backdrop" id="sm-popup-backdrop"></div>' +
    '<div class="sm-popup-box" role="dialog" aria-modal="true" id="sm-popup-box">' +
      '<button class="sm-popup-close" id="sm-popup-close" aria-label="关闭">&times;</button>' +
      '<p class="sm-popup-text" id="sm-popup-text"></p>' +
      '<span class="sm-popup-toast" id="sm-popup-toast">已复制</span>' +
    '</div>';
  root.appendChild(popup);
  var popupBackdrop = popup.querySelector('#sm-popup-backdrop');
  var popupBox = popup.querySelector('#sm-popup-box');
  var popupText = popup.querySelector('#sm-popup-text');
  var popupToast = popup.querySelector('#sm-popup-toast');
  var popupClose = popup.querySelector('#sm-popup-close');
  var popupCopyValue = '';
  var popupToastTimer = null;

  function openPopup(display, copy) {
    popupText.textContent = display;
    popupCopyValue = copy || '';
    if (popupCopyValue) popupBox.classList.add('sm-popup-copyable');
    else popupBox.classList.remove('sm-popup-copyable');
    popup.classList.add('sm-popup-open');
    popup.setAttribute('aria-hidden', 'false');
  }
  function closePopup() {
    popup.classList.remove('sm-popup-open');
    popup.setAttribute('aria-hidden', 'true');
  }
  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {}, fallback);
    } else {
      fallback();
    }
  }
  function showToast() {
    if (!popupCopyValue) return;
    popupBox.classList.add('sm-popup-copied');
    if (popupToastTimer) clearTimeout(popupToastTimer);
    popupToastTimer = setTimeout(function () {
      popupBox.classList.remove('sm-popup-copied');
    }, 1300);
  }

  socialsList.querySelectorAll('.sm-socials-link').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openPopup(btn.getAttribute('data-display'), btn.getAttribute('data-copy'));
    });
  });
  popupClose.addEventListener('click', closePopup);
  popupBackdrop.addEventListener('click', closePopup);
  // 双击弹窗内容即复制（仅当存在可复制内容）
  popupBox.addEventListener('dblclick', function () {
    if (!popupCopyValue) return;
    copyText(popupCopyValue);
    showToast();
  });

  /* ---------- 降级：没有 GSAP 也能开合（靠 .sm-open 类 + CSS） ---------- */
  if (!gsap) {
    toggleBtn.addEventListener('click', function () {
      var isOpen = root.classList.toggle('sm-open');
      toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      toggleBtn.setAttribute('aria-label', isOpen ? '关闭菜单' : '打开菜单');
    });
    list.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { root.classList.remove('sm-open'); });
    });
    if (CONFIG.closeOnClickAway) {
      document.addEventListener('mousedown', function (e) {
        if (panel.contains(e.target) || toggleBtn.contains(e.target) || popup.contains(e.target)) return;
        if (root.classList.contains('sm-open')) root.classList.remove('sm-open');
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (popup.classList.contains('sm-popup-open')) closePopup(); else root.classList.remove('sm-open'); }
    });
    return;
  }

  /* ====================== GSAP 动画逻辑 ====================== */
  var open = false;
  var busy = false;
  var openTl = null, closeTween = null, spinTween = null, colorTween = null;

  gsap.set([panel].concat(Array.prototype.slice.call(preContainer.children)), { xPercent: offscreen, opacity: 1 });
  gsap.set([barTop, barMid, barBot], { y: 0, rotate: 0, opacity: 1, scaleX: 1 });
  gsap.set(toggleBtn, { color: CONFIG.menuButtonColor });

  function buildOpenTimeline() {
    if (openTl) openTl.kill();
    if (closeTween) { closeTween.kill(); closeTween = null; }

    var layers = Array.prototype.slice.call(preContainer.children);
    var itemEls = Array.prototype.slice.call(panel.querySelectorAll('.sm-itemLabel'));
    var numberEls = Array.prototype.slice.call(panel.querySelectorAll('.sm-list[data-numbering] .sm-item'));
    var socialTitle = panel.querySelector('.sm-socials-title');
    var socialLinks = Array.prototype.slice.call(panel.querySelectorAll('.sm-socials-link'));

    var layerStates = layers.map(function (el) { return { el: el, start: offscreen }; });
    var panelStart = offscreen;

    if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
    if (numberEls.length) gsap.set(numberEls, { '--sm-num-opacity': 0 });
    if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
    if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });

    var tl = gsap.timeline({ paused: true });

    layerStates.forEach(function (ls, i) {
      tl.fromTo(ls.el, { xPercent: ls.start }, { xPercent: 0, duration: 0.5, ease: 'power4.out' }, i * 0.07);
    });
    var lastTime = layerStates.length ? (layerStates.length - 1) * 0.07 : 0;
    var panelInsertTime = lastTime + (layerStates.length ? 0.08 : 0);
    var panelDuration = 0.65;
    tl.fromTo(panel, { xPercent: panelStart }, { xPercent: 0, duration: panelDuration, ease: 'power4.out' }, panelInsertTime);

    if (itemEls.length) {
      var itemsStart = panelInsertTime + panelDuration * 0.15;
      tl.to(itemEls, {
        yPercent: 0, rotate: 0, duration: 1, ease: 'power4.out',
        stagger: { each: 0.1, from: 'start' }
      }, itemsStart);
      if (numberEls.length) {
        tl.to(numberEls, {
          duration: 0.6, ease: 'power2.out', '--sm-num-opacity': 1,
          stagger: { each: 0.08, from: 'start' }
        }, itemsStart + 0.1);
      }
    }

    if (socialTitle || socialLinks.length) {
      var socialsStart = panelInsertTime + panelDuration * 0.4;
      if (socialTitle) tl.to(socialTitle, { opacity: 1, duration: 0.5, ease: 'power2.out' }, socialsStart);
      if (socialLinks.length) {
        tl.to(socialLinks, {
          y: 0, opacity: 1, duration: 0.55, ease: 'power3.out',
          stagger: { each: 0.08, from: 'start' },
          onComplete: function () { gsap.set(socialLinks, { clearProps: 'opacity' }); }
        }, socialsStart + 0.04);
      }
    }

    openTl = tl;
    return tl;
  }

  function playOpen() {
    if (busy) return;
    busy = true;
    var tl = buildOpenTimeline();
    if (tl) {
      tl.eventCallback('onComplete', function () { busy = false; });
      tl.play(0);
    } else busy = false;
  }

  function playClose() {
    if (openTl) { openTl.kill(); openTl = null; }
    var layers = Array.prototype.slice.call(preContainer.children);
    var all = layers.concat([panel]);
    if (closeTween) closeTween.kill();
    closeTween = gsap.to(all, {
      xPercent: offscreen, duration: 0.32, ease: 'power3.in', overwrite: 'auto',
      onComplete: function () {
        var itemEls = Array.prototype.slice.call(panel.querySelectorAll('.sm-itemLabel'));
        if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
        var numberEls = Array.prototype.slice.call(panel.querySelectorAll('.sm-list[data-numbering] .sm-item'));
        if (numberEls.length) gsap.set(numberEls, { '--sm-num-opacity': 0 });
        var socialTitle = panel.querySelector('.sm-socials-title');
        var socialLinks = Array.prototype.slice.call(panel.querySelectorAll('.sm-socials-link'));
        if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
        if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });
        busy = false;
      }
    });
  }

  // 三横 → 叉（X）
  function animateIcon(opening) {
    if (spinTween) spinTween.kill();
    if (opening) {
      spinTween = gsap.timeline({ overwrite: 'auto' });
      spinTween.to(barTop, { y: 5, rotate: 45, duration: 0.5, ease: 'power4.out' }, 0);
      spinTween.to(barMid, { opacity: 0, scaleX: 0.2, duration: 0.3 }, 0);
      spinTween.to(barBot, { y: -5, rotate: -45, duration: 0.5, ease: 'power4.out' }, 0);
    } else {
      spinTween = gsap.timeline({ overwrite: 'auto' });
      spinTween.to(barTop, { y: 0, rotate: 0, duration: 0.35, ease: 'power3.inOut' }, 0);
      spinTween.to(barMid, { opacity: 1, scaleX: 1, duration: 0.3 }, 0);
      spinTween.to(barBot, { y: 0, rotate: 0, duration: 0.35, ease: 'power3.inOut' }, 0);
    }
  }

  function animateColor(opening) {
    if (colorTween) colorTween.kill();
    if (CONFIG.changeMenuColorOnOpen) {
      var target = opening ? CONFIG.openMenuButtonColor : CONFIG.menuButtonColor;
      colorTween = gsap.to(toggleBtn, { color: target, delay: 0.18, duration: 0.3, ease: 'power2.out' });
    }
  }

  function setOpen(target) {
    open = target;
    toggleBtn.setAttribute('aria-expanded', target ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', target ? '关闭菜单' : '打开菜单');
    panel.setAttribute('aria-hidden', target ? 'false' : 'true');
    if (target) root.setAttribute('data-open', 'true');
    else root.removeAttribute('data-open');
  }

  function toggleMenu() {
    var target = !open;
    setOpen(target);
    if (target) playOpen(); else playClose();
    animateIcon(target);
  }

  function closeMenu() {
    if (open) {
      setOpen(false);
      playClose();
      animateIcon(false);
    }
  }

  toggleBtn.addEventListener('click', toggleMenu);

  // 点击菜单项：先收起再跳转（不拦截默认导航）
  list.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { closeMenu(); });
  });

  // 点击面板/按钮之外关闭（弹窗内不触发）
  if (CONFIG.closeOnClickAway) {
    document.addEventListener('mousedown', function (e) {
      if (panel.contains(e.target) || toggleBtn.contains(e.target) || popup.contains(e.target)) return;
      if (open) closeMenu();
    });
  }

  // Esc：先关弹窗，再关菜单
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (popup.classList.contains('sm-popup-open')) closePopup();
      else if (open) closeMenu();
    }
  });
})();
