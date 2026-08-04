/* ============================================================
   StaggeredMenu — 原生 JS 移植（对应 React Bits 的 React 组件）
   依赖：vendor/gsap.min.js（已本地化）。动画时间轴 1:1 复刻原组件。
   所有菜单项 / 社交 / 颜色都集中在下面的 CONFIG 里，自行修改即可。
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
    // 菜单项：label 显示文字，link 跳转地址，ariaLabel 无障碍标签
    items: [
      { label: '首页', ariaLabel: '返回首页', link: 'index.html' },
      { label: '作品', ariaLabel: '查看作品集', link: 'works.html' },
      { label: '技能', ariaLabel: '查看技能特长', link: 'index.html#skills' },
      { label: '流程', ariaLabel: '查看服务流程', link: 'index.html#process' },
      { label: '联系', ariaLabel: '查看联系方式', link: 'index.html#contact' }
    ],
    // 社交链接：需要真实地址请替换 href（# 表示占位）
    socialItems: [
      { label: '微信', link: '#' },
      { label: '小红书', link: '#' },
      { label: '抖音', link: '#' },
      { label: '邮箱', link: 'mailto:youcai@example.com' }
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
  var plusH = document.getElementById('sm-plusH');
  var plusV = document.getElementById('sm-plusV');
  var textInner = document.getElementById('sm-textInner');

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

  // socials
  if (CONFIG.displaySocials && CONFIG.socialItems && CONFIG.socialItems.length) {
    socialsWrap.style.display = '';
    socialsList.innerHTML = '';
    CONFIG.socialItems.forEach(function (s) {
      var li = document.createElement('li');
      li.className = 'sm-socials-item';
      var a = document.createElement('a');
      a.className = 'sm-socials-link';
      a.href = s.link;
      a.textContent = s.label;
      if (/^https?:/i.test(s.link)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      li.appendChild(a);
      socialsList.appendChild(li);
    });
  } else {
    socialsWrap.style.display = 'none';
  }

  /* ---------- 降级：没有 GSAP 也能开合 ---------- */
  if (!gsap) {
    toggleBtn.addEventListener('click', function () {
      var isOpen = root.classList.toggle('sm-open');
      toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      icon.style.transform = isOpen ? 'rotate(225deg)' : 'rotate(0deg)';
    });
    list.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { root.classList.remove('sm-open'); });
    });
    if (CONFIG.closeOnClickAway) {
      document.addEventListener('mousedown', function (e) {
        if (panel.contains(e.target) || toggleBtn.contains(e.target)) return;
        if (root.classList.contains('sm-open')) root.classList.remove('sm-open');
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') root.classList.remove('sm-open');
    });
    return;
  }

  /* ====================== GSAP 动画逻辑 ====================== */
  var open = false;
  var busy = false;
  var openTl = null, closeTween = null, spinTween = null, textCycle = null, colorTween = null;

  gsap.set([panel].concat(Array.prototype.slice.call(preContainer.children)), { xPercent: offscreen, opacity: 1 });
  gsap.set(plusH, { transformOrigin: '50% 50%', rotate: 0 });
  gsap.set(plusV, { transformOrigin: '50% 50%', rotate: 90 });
  gsap.set(icon, { rotate: 0, transformOrigin: '50% 50%' });
  gsap.set(textInner, { yPercent: 0 });
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

  function animateIcon(opening) {
    if (spinTween) spinTween.kill();
    if (opening) spinTween = gsap.to(icon, { rotate: 225, duration: 0.8, ease: 'power4.out', overwrite: 'auto' });
    else spinTween = gsap.to(icon, { rotate: 0, duration: 0.35, ease: 'power3.inOut', overwrite: 'auto' });
  }

  function animateColor(opening) {
    if (colorTween) colorTween.kill();
    if (CONFIG.changeMenuColorOnOpen) {
      var target = opening ? CONFIG.openMenuButtonColor : CONFIG.menuButtonColor;
      colorTween = gsap.to(toggleBtn, { color: target, delay: 0.18, duration: 0.3, ease: 'power2.out' });
    }
  }

  function animateText(opening) {
    if (textCycle) textCycle.kill();
    var current = opening ? '菜单' : '关闭';
    var target = opening ? '关闭' : '菜单';
    var seq = [current];
    var last = current;
    for (var i = 0; i < 3; i++) { last = last === '菜单' ? '关闭' : '菜单'; seq.push(last); }
    if (last !== target) seq.push(target);
    seq.push(target);

    textInner.innerHTML = '';
    seq.forEach(function (l) {
      var s = document.createElement('span');
      s.className = 'sm-toggle-line';
      s.textContent = l;
      textInner.appendChild(s);
    });
    gsap.set(textInner, { yPercent: 0 });
    var lineCount = seq.length;
    var finalShift = ((lineCount - 1) / lineCount) * 100;
    textCycle = gsap.to(textInner, { yPercent: -finalShift, duration: 0.5 + lineCount * 0.07, ease: 'power4.out' });
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
    animateText(target);
  }

  function closeMenu() {
    if (open) {
      setOpen(false);
      playClose();
      animateIcon(false);
      animateText(false);
    }
  }

  toggleBtn.addEventListener('click', toggleMenu);

  // 点击菜单项：先收起再跳转（不拦截默认导航）
  list.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { closeMenu(); });
  });

  // 点击面板/按钮之外关闭
  if (CONFIG.closeOnClickAway) {
    document.addEventListener('mousedown', function (e) {
      if (panel.contains(e.target) || toggleBtn.contains(e.target)) return;
      if (open) closeMenu();
    });
  }

  // Esc 关闭
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) closeMenu();
  });
})();
