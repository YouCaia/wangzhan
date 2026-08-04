/**
 * color-bends.js — 从 React Bits 的 <ColorBends /> 移植的「流动金色光带」背景
 *
 * 技术要点（与原组件一致，但不依赖 three）：
 *  - 直接跑原版 GLSL 片元着色器（满屏三角形），用原生 WebGL 渲染，零外部依赖、无 CDN 隐患。
 *  - 固定全屏 canvas，z-index:-1（真正的背景层），pointer-events:none，不拦截点击。
 *  - 透明背景（alpha），金色光带浮在深色底之上，与现有深金视觉统一。
 *  - 鼠标轻微推动光带（parallax + mouseInfluence，已调弱）。
 *  - prefers-reduced-motion / 触屏设备：不启用；WebGL 不可用：静默跳过。
 *  - 内部分辨率封顶 1280，保证性能（用户此前反馈过加载偏慢）。
 *
 * 两页共用。
 */
(function () {
  'use strict';
  if (window.__colorBendsLoaded) return;
  window.__colorBendsLoaded = true;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  if (reduce || !fine) return; // 减少动效 / 触屏：不启用

  var canvas = document.createElement('canvas');
  canvas.id = 'color-bends';
  canvas.setAttribute('aria-hidden', 'true');
  var st = canvas.style;
  st.position = 'fixed';
  st.left = '0'; st.top = '0';
  st.width = '100%'; st.height = '100%';
  st.zIndex = '-1';
  st.pointerEvents = 'none';

  var glOpts = { alpha: true, antialias: false, premultipliedAlpha: true, depth: false, stencil: false };
  var gl = canvas.getContext('webgl', glOpts) || canvas.getContext('experimental-webgl', glOpts);
  if (!gl) return; // 不支持则静默降级，不影响页面
  (document.body || document.documentElement).insertBefore(canvas, (document.body || document.documentElement).firstChild);

  var MAX_COLORS = 8;

  var vertSrc = [
    'attribute vec2 aPos;',
    'attribute vec2 aUv;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = aUv;',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  var fragSrc = [
    'precision highp float;',
    '#define MAX_COLORS ' + MAX_COLORS,
    'uniform vec2 uCanvas;',
    'uniform float uTime;',
    'uniform float uSpeed;',
    'uniform vec2 uRot;',
    'uniform int uColorCount;',
    'uniform vec3 uColors[MAX_COLORS];',
    'uniform int uTransparent;',
    'uniform float uScale;',
    'uniform float uFrequency;',
    'uniform float uWarpStrength;',
    'uniform vec2 uPointer;',
    'uniform float uMouseInfluence;',
    'uniform float uParallax;',
    'uniform float uNoise;',
    'uniform int uIterations;',
    'uniform float uIntensity;',
    'uniform float uBandWidth;',
    'varying vec2 vUv;',
    '',
    'void main() {',
    '  float t = uTime * uSpeed;',
    '  vec2 p = vUv * 2.0 - 1.0;',
    '  p += uPointer * uParallax * 0.1;',
    '  vec2 rp = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);',
    '  vec2 q = vec2(rp.x * (uCanvas.x / uCanvas.y), rp.y);',
    '  q /= max(uScale, 0.0001);',
    '  q /= 0.5 + 0.2 * dot(q, q);',
    '  q += 0.2 * cos(t) - 7.56;',
    '  vec2 toward = (uPointer - rp);',
    '  q += toward * uMouseInfluence * 0.2;',
    '',
    '    for (int j = 0; j < 5; j++) {',
    '      if (j >= uIterations - 1) break;',
    '      vec2 rr = sin(1.5 * (q.yx * uFrequency) + 2.0 * cos(q * uFrequency));',
    '      q += (rr - q) * 0.15;',
    '    }',
    '',
    '    vec3 col = vec3(0.0);',
    '    float a = 1.0;',
    '',
    '    if (uColorCount > 0) {',
    '      vec2 s = q;',
    '      vec3 sumCol = vec3(0.0);',
    '      float cover = 0.0;',
    '      for (int i = 0; i < MAX_COLORS; ++i) {',
    '            if (i >= uColorCount) break;',
    '            s -= 0.01;',
    '            vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));',
    '            float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(i)) / 4.0);',
    '            float kBelow = clamp(uWarpStrength, 0.0, 1.0);',
    '            float kMix = pow(kBelow, 0.3);',
    '            float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);',
    '            vec2 disp = (r - s) * kBelow;',
    '            vec2 warped = s + disp * gain;',
    '            float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(i)) / 4.0);',
    '            float m = mix(m0, m1, kMix);',
    '            float w = 1.0 - exp(-uBandWidth / exp(uBandWidth * m));',
    '            sumCol += uColors[i] * w;',
    '            cover = max(cover, w);',
    '      }',
    '      col = clamp(sumCol, 0.0, 1.0);',
    '      a = uTransparent > 0 ? cover : 1.0;',
    '    } else {',
    '        vec2 s = q;',
    '        for (int k = 0; k < 3; ++k) {',
    '            s -= 0.01;',
    '            vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));',
    '            float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(k)) / 4.0);',
    '            float kBelow = clamp(uWarpStrength, 0.0, 1.0);',
    '            float kMix = pow(kBelow, 0.3);',
    '            float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);',
    '            vec2 disp = (r - s) * kBelow;',
    '            vec2 warped = s + disp * gain;',
    '            float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(k)) / 4.0);',
    '            float m = mix(m0, m1, kMix);',
    '            col[k] = 1.0 - exp(-uBandWidth / exp(uBandWidth * m));',
    '        }',
    '        a = uTransparent > 0 ? max(max(col.r, col.g), col.b) : 1.0;',
    '    }',
    '',
    '    col *= uIntensity;',
    '',
    '    if (uNoise > 0.0001) {',
    '      float n = fract(sin(dot(gl_FragCoord.xy + vec2(uTime), vec2(12.9898, 78.233))) * 43758.5453123);',
    '      col += (n - 0.5) * uNoise;',
    '      col = clamp(col, 0.0, 1.0);',
    '    }',
    '',
    '    vec3 rgb = (uTransparent > 0) ? col * a : col;',
    '    gl_FragColor = vec4(rgb, a);',
    '}'
  ].join('\n');

  // —— 配置：对齐 React Bits 官方示例，颜色改深金（更暗、更纯金） ——
  // 官方示例参数：speed 0.2 / frequency 1 / warpStrength 1 / mouseInfluence 1 /
  // parallax 0.5 / noise 0.15 / bandWidth 6 / scale 1
  // 这里 intensity 降到 1.2，配色用中深金（非橙、非亮黄），整体更暗更稳重
  var cfg = {
    colors: ['#d9b24c', '#c09233', '#a87a25', '#7c531a'], // 金 / 暗金 / 古铜金 / 深金棕
    rotation: 90,
    speed: 0.2,
    autoRotate: 0,
    scale: 1,
    frequency: 1,
    warpStrength: 1,
    mouseInfluence: 1,
    parallax: 0.5,
    noise: 0.15,
    iterations: 1,
    intensity: 1.0,
    bandWidth: 6,
    transparent: true
  };

  function hexToRgb(hex) {
    var h = String(hex).replace('#', '').trim();
    var v;
    if (h.length === 3) v = [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
    else v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    return [v[0] / 255, v[1] / 255, v[2] / 255];
  }

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      if (window.console) console.error('[color-bends] shader compile error:', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  var vs = compile(gl.VERTEX_SHADER, vertSrc);
  var fs = compile(gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) return;

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    if (window.console) console.error('[color-bends] program link error:', gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  // 满屏四边形（triangle strip）
  var quadPos = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  var quadUv = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
  var posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, quadPos, gl.STATIC_DRAW);
  var uvBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.bufferData(gl.ARRAY_BUFFER, quadUv, gl.STATIC_DRAW);

  var aPos = gl.getAttribLocation(prog, 'aPos');
  var aUv = gl.getAttribLocation(prog, 'aUv');
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.enableVertexAttribArray(aUv);
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);

  function loc(n) { return gl.getUniformLocation(prog, n); }
  var u = {
    uCanvas: loc('uCanvas'),
    uTime: loc('uTime'),
    uSpeed: loc('uSpeed'),
    uRot: loc('uRot'),
    uColorCount: loc('uColorCount'),
    uColors: loc('uColors[0]'),
    uTransparent: loc('uTransparent'),
    uScale: loc('uScale'),
    uFrequency: loc('uFrequency'),
    uWarpStrength: loc('uWarpStrength'),
    uPointer: loc('uPointer'),
    uMouseInfluence: loc('uMouseInfluence'),
    uParallax: loc('uParallax'),
    uNoise: loc('uNoise'),
    uIterations: loc('uIterations'),
    uIntensity: loc('uIntensity'),
    uBandWidth: loc('uBandWidth')
  };

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // 配合 premultipliedAlpha

  function setStaticUniforms() {
    gl.uniform1f(u.uSpeed, cfg.speed);
    gl.uniform1f(u.uScale, cfg.scale);
    gl.uniform1f(u.uFrequency, cfg.frequency);
    gl.uniform1f(u.uWarpStrength, cfg.warpStrength);
    gl.uniform1f(u.uMouseInfluence, cfg.mouseInfluence);
    gl.uniform1f(u.uParallax, cfg.parallax);
    gl.uniform1f(u.uNoise, cfg.noise);
    gl.uniform1i(u.uIterations, cfg.iterations);
    gl.uniform1f(u.uIntensity, cfg.intensity);
    gl.uniform1f(u.uBandWidth, cfg.bandWidth);
    gl.uniform1i(u.uTransparent, cfg.transparent ? 1 : 0);

    var arr = new Float32Array(MAX_COLORS * 3);
    var cols = (cfg.colors || []).filter(Boolean).slice(0, MAX_COLORS).map(hexToRgb);
    for (var i = 0; i < MAX_COLORS; i++) {
      var c = (i < cols.length) ? cols[i] : [0, 0, 0];
      arr[i * 3] = c[0]; arr[i * 3 + 1] = c[1]; arr[i * 3 + 2] = c[2];
    }
    gl.uniform3fv(u.uColors, arr);
    gl.uniform1i(u.uColorCount, cols.length);
  }

  // 光标（NDC，平滑跟随）
  var tgtX = 0, tgtY = 0, curX = 0, curY = 0;
  window.addEventListener('pointermove', function (e) {
    tgtX = (e.clientX / window.innerWidth) * 2 - 1;
    tgtY = -((e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  function resize() {
    var w = window.innerWidth || 1, h = window.innerHeight || 1;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var maxDim = 1280; // 内部分辨率封顶，保证性能
    var bw = Math.floor(w * dpr), bh = Math.floor(h * dpr);
    var scaleDown = Math.min(1, maxDim / Math.max(bw, bh));
    bw = Math.max(1, Math.floor(bw * scaleDown));
    bh = Math.max(1, Math.floor(bh * scaleDown));
    canvas.width = bw; canvas.height = bh;
    gl.viewport(0, 0, bw, bh);
    gl.uniform2f(u.uCanvas, bw, bh);
  }

  setStaticUniforms();
  resize();
  window.addEventListener('resize', resize);

  var start = performance.now();
  function render(now) {
    var elapsed = (now - start) / 1000;
    gl.uniform1f(u.uTime, elapsed);

    var deg = (cfg.rotation + cfg.autoRotate * elapsed) % 360;
    var rad = deg * Math.PI / 180;
    gl.uniform2f(u.uRot, Math.cos(rad), Math.sin(rad));

    curX += (tgtX - curX) * 0.08;
    curY += (tgtY - curY) * 0.08;
    gl.uniform2f(u.uPointer, curX, curY);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
