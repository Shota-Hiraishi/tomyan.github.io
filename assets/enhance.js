/* ===========================================================
   enhance.js — 全ページ共通のUX層
   静的HTMLに後付けするため、要素が無いページでは各機能が
   自動的に無効になるよう組んである。
   =========================================================== */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------- localStorage（プライベートモード等で例外を投げる） ---------- */
  function readStore(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStore(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* 保存できなくても動作は続ける */ }
  }
  function clearStore(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* 同上 */ }
  }

  /* ---------- テーマ切替（system → light → dark → system） ---------- */
  var THEME_KEY = 'roadmap-theme';
  var ICONS = {
    system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 20.5h8"/></svg>',
    light:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/></svg>',
    dark:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13.5A8.2 8.2 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z"/></svg>'
  };
  var LABELS = { system: '表示: 端末の設定に合わせる', light: '表示: ライト', dark: '表示: ダーク' };
  var ORDER = ['system', 'light', 'dark'];

  function applyTheme(mode) {
    if (mode === 'system') {
      root.removeAttribute('data-theme');
      clearStore(THEME_KEY);
    } else {
      root.setAttribute('data-theme', mode);
      writeStore(THEME_KEY, mode);
    }
  }

  function currentTheme() {
    var saved = readStore(THEME_KEY);
    return (saved === 'light' || saved === 'dark') ? saved : 'system';
  }

  /* ---------- 右下の操作ボタン ---------- */
  function buildFab() {
    var fab = document.createElement('div');
    fab.className = 'ux-fab';

    var theme = currentTheme();
    var themeBtn = document.createElement('button');
    themeBtn.type = 'button';
    themeBtn.className = 'ux-theme';

    function paintTheme() {
      themeBtn.innerHTML = ICONS[theme];
      themeBtn.setAttribute('aria-label', LABELS[theme] + '（押すと切り替わります）');
      themeBtn.setAttribute('title', LABELS[theme]);
    }
    paintTheme();

    themeBtn.addEventListener('click', function () {
      theme = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
      applyTheme(theme);
      paintTheme();
    });

    var topBtn = document.createElement('button');
    topBtn.type = 'button';
    topBtn.className = 'ux-top';
    topBtn.hidden = true;
    topBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V6M6 12l6-6 6 6"/></svg>';
    topBtn.setAttribute('aria-label', 'ページの先頭へ戻る');
    topBtn.setAttribute('title', 'ページの先頭へ戻る');
    topBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    fab.appendChild(themeBtn);
    fab.appendChild(topBtn);
    document.body.appendChild(fab);
    return topBtn;
  }

  /* ---------- スキップリンク ---------- */
  function buildSkipLink() {
    var target = document.querySelector('section[id]');
    if (!target) { return; }
    var skip = document.createElement('a');
    skip.className = 'ux-skip';
    skip.href = '#' + target.id;
    skip.textContent = '本文へスキップ';
    document.body.insertBefore(skip, document.body.firstChild);
  }

  /* ---------- 読み進みバー ---------- */
  function buildProgress() {
    var bar = document.createElement('div');
    bar.className = 'ux-progress';
    document.body.appendChild(bar);
    return bar;
  }

  /* ---------- 横スクロールする表に合図を出す ---------- */
  function setupScrollables() {
    var boxes = document.querySelectorAll('.tbl-scroll, .compare');

    Array.prototype.forEach.call(boxes, function (box) {
      var hint = null;

      function refreshEdge() {
        var atEnd = box.scrollLeft + box.clientWidth >= box.scrollWidth - 2;
        box.classList.toggle('is-at-end', atEnd);
      }

      function evaluate() {
        var scrollable = box.scrollWidth - box.clientWidth > 2;

        if (scrollable) {
          box.classList.add('ux-scrollable');
          // キーボードでもスクロールできるようフォーカス可能にする
          if (!box.hasAttribute('tabindex')) {
            box.setAttribute('tabindex', '0');
            box.setAttribute('role', 'region');
            box.setAttribute('aria-label', '横にスクロールできる表');
          }
          if (!hint) {
            hint = document.createElement('div');
            hint.className = 'ux-hint';
            hint.textContent = '横にスクロールできます';
            box.parentNode.insertBefore(hint, box);
          }
          hint.hidden = false;
          refreshEdge();
        } else {
          box.classList.remove('ux-scrollable', 'is-at-end');
          box.removeAttribute('tabindex');
          box.removeAttribute('role');
          box.removeAttribute('aria-label');
          if (hint) { hint.hidden = true; }
        }
      }

      box.addEventListener('scroll', function () {
        refreshEdge();
        if (hint && box.scrollLeft > 8) { hint.classList.add('is-done'); }
      }, { passive: true });

      evaluate();
      box._uxEvaluate = evaluate;
    });

    return boxes;
  }

  /* ---------- パート比較表：各セルにパート名を持たせる ----------
     狭い画面では表が1列に潰れて「どのパートの記述か」が分からなくなる。
     ヘッダーの見出しを data-label として各セルに写しておき、
     CSS 側（@media max-width:600px）で ::before として表示する。 */
  function labelCompareCells() {
    Array.prototype.forEach.call(document.querySelectorAll('.compare'), function (table) {
      var head = table.querySelector('.compare-head');
      if (!head) { return; }

      var labels = Array.prototype.map.call(head.children, function (c) {
        return c.textContent.trim();
      });

      Array.prototype.forEach.call(table.querySelectorAll('.compare-row'), function (row) {
        Array.prototype.forEach.call(row.children, function (cell, i) {
          // 先頭セルは「観点」そのものなのでラベルを付けない
          if (i > 0 && labels[i]) { cell.setAttribute('data-label', labels[i]); }
        });
      });
    });
  }

  /* ---------- 目次の現在位置 ---------- */
  function setupTocHighlight() {
    var toc = document.querySelector('.toc');
    if (!toc) { return null; }

    var links = {};
    var order = [];
    Array.prototype.forEach.call(toc.querySelectorAll('a[href^="#"]'), function (a) {
      var id = a.getAttribute('href').slice(1);
      if (document.getElementById(id)) {
        links[id] = a;
        order.push(id);
      }
    });
    if (!order.length) { return null; }

    var strip = toc.querySelector('.wrap') || toc;
    var activeId = null;

    function setActive(id) {
      if (id === activeId) { return; }
      if (activeId && links[activeId]) { links[activeId].classList.remove('is-active'); }
      activeId = id;
      var link = links[id];
      if (!link) { return; }
      link.classList.add('is-active');

      // 目次の帯自体が横スクロールなので、現在位置を見える位置へ寄せる
      var left = link.offsetLeft - (strip.clientWidth - link.offsetWidth) / 2;
      if (strip.scrollWidth - strip.clientWidth > 2) {
        strip.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
      }
    }

    // 画面上部に最も近いセクションを現在位置とする
    function pick() {
      var best = null;
      var bestTop = Infinity;
      for (var i = 0; i < order.length; i++) {
        var el = document.getElementById(order[i]);
        var top = el.getBoundingClientRect().top - 80;
        if (top <= 0 && Math.abs(top) < bestTop) { bestTop = Math.abs(top); best = order[i]; }
      }
      if (!best) { best = order[0]; }
      setActive(best);
    }

    return pick;
  }

  /* ---------- 起動 ---------- */
  function init() {
    applyTheme(currentTheme());

    var topBtn = buildFab();
    buildSkipLink();
    labelCompareCells();

    var isLongPage = !!document.querySelector('.toc');
    var bar = isLongPage ? buildProgress() : null;
    var pickToc = setupTocHighlight();
    var boxes = setupScrollables();

    var ticking = false;

    function update() {
      var y = window.pageYOffset;

      if (bar) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (max > 0 ? Math.min(100, (y / max) * 100) : 0) + '%';
      }
      topBtn.hidden = y < 600;
      if (pickToc) { pickToc(); }
    }

    function onScroll() {
      if (ticking) { return; }
      ticking = true;
      window.requestAnimationFrame(function () {
        // finally で必ず解除する。ここを素通りさせると以降の更新が止まる
        try { update(); } finally { ticking = false; }
      });
    }

    // 非表示タブでは requestAnimationFrame が発火しない。
    // 戻ってきた時点で確実に追いつくよう、保留状態を解除して引き直す。
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        ticking = false;
        update();
      }
    });

    var resizeTimer = null;
    function onResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        Array.prototype.forEach.call(boxes, function (b) {
          if (b._uxEvaluate) { b._uxEvaluate(); }
        });
      }, 150);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    onScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
