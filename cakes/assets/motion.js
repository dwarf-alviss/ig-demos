/* motion.js — слой движения для серии демо-сайтов.
   Ничего не грузит по сети, не трогает разметку страниц и логику магазинов:
   только читает DOM и навешивает эффекты. Подключать после app.js.
   Что делает:
     1) полоса прогресса чтения и тень шапки при прокрутке;
     2) приезд первого экрана (класс html.is-ready);
     3) задержку появления секций по порядку (--i);
     4) параллакс помеченных картинок (data-parallax);
     5) счётчики цифр в блоках со data-count;
     6) полёт картинки товара в корзину и толчок счётчика;
     7) появление карточек, которые магазин дорисовал после фильтра.
   Всё выключается, если у человека включено «меньше движения». */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var doc = document;
  var html = doc.documentElement;

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }

  /* ---------- 1. прогресс чтения и шапка ---------- */
  var bar = doc.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  doc.body.appendChild(bar);

  var header = $('.site-header') || $('header');
  var stick = 0;

  function onScroll() {
    var top = window.pageYOffset || html.scrollTop;
    var max = Math.max(1, html.scrollHeight - window.innerHeight);
    var share = Math.min(1, Math.max(0, top / max));
    bar.style.width = (share * 100).toFixed(2) + '%';
    bar.classList.toggle('is-active', top > 80);

    if (header) {
      if (top > stick + 8 && !header.classList.contains('is-scrolled')) { header.classList.add('is-scrolled'); stick = top; }
      else if (top < stick - 8 && header.classList.contains('is-scrolled')) { header.classList.remove('is-scrolled'); stick = top; }
    }

    if (!reduce) {
      for (var i = 0; i < parallax.length; i++) {
        var p = parallax[i];
        var box = p.node.getBoundingClientRect();
        if (box.bottom < -120 || box.top > window.innerHeight + 120) { continue; }
        var mid = box.top + box.height / 2 - window.innerHeight / 2;
        var shift = Math.max(-1, Math.min(1, mid / window.innerHeight)) * p.depth;
        p.node.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0)';
      }
    }
  }

  /* ---------- 4. параллакс ---------- */
  var parallax = [];
  function collectParallax() {
    /* контейнеры первого экрана, а не сами фото: у фото уже своё дыхание (kenburns) */
    var auto = $$('.hero__figure, .hero__media, .hero__stage, .hero__plate, .vitrine');
    parallax = auto.concat($$('[data-parallax]')).map(function (node, i) {
      var depth = parseFloat(node.getAttribute('data-parallax'));
      if (!isFinite(depth)) { depth = i ? 22 : 30; }
      return { node: node, depth: depth };
    });
  }

  /* ---------- счётчики: сами находим числа в блоках цифр ---------- */
  function collectCounters() {
    var hosts = $$('[data-count], [class*="stat"] strong, [class*="stat"] b, [class*="stat"] span, .hero__stats strong, .hero__facts b, .hero__seals b');
    hosts.forEach(function (node) {
      if (node.hasAttribute('data-count') || node.children.length) { return; }
      var text = node.textContent.trim();
      var m = /^(\d[\d\s]{0,9}(?:[.,]\d+)?)\s*([^\d]*)$/.exec(text);
      if (!m) { return; }
      node.setAttribute('data-count', m[1].replace(/\s/g, ''));
    });
  }

  /* ---------- 3. порядок появления секций ---------- */
  function numberReveals() {
    var groups = $$('.section, .grid, .row, .catalog__grid, main > *');
    groups.forEach(function (group) {
      var kids = $$('.reveal', group).filter(function (n) { return !n.hasAttribute('data-order'); });
      kids.forEach(function (n, i) {
        n.setAttribute('data-order', '1');
        if (!n.style.getPropertyValue('--i')) { n.style.setProperty('--i', String(Math.min(i, 8))); }
      });
    });
    $$('.reveal').forEach(function (n, i) {
      if (!n.style.getPropertyValue('--i')) { n.style.setProperty('--i', String(Math.min(i % 4, 4))); }
    });
  }

  /* ---------- 5. счётчики ---------- */
  function countUp(node) {
    var raw = node.getAttribute('data-count') || node.textContent.replace(/[^\d.,]/g, '');
    var target = parseFloat(String(raw).replace(/\s/g, '').replace(',', '.'));
    if (!isFinite(target)) { return; }
    var tail = node.textContent.replace(/[\d\s.,]+/g, '').trim();
    var decimals = (String(raw).split('.')[1] || '').length;
    var start = performance.now();
    var dur = 900;
    node.classList.add('is-counting');
    function step(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      var value = (target * eased).toFixed(decimals);
      node.textContent = value + (tail ? ' ' + tail : '');
      if (t < 1) { requestAnimationFrame(step); }
      else { node.classList.remove('is-counting'); node.textContent = String(node.getAttribute('data-count') || target) + (tail ? ' ' + tail : ''); }
    }
    requestAnimationFrame(step);
  }

  var counted = new WeakSet();
  function watchCounters() {
    var nodes = $$('[data-count]');
    if (!nodes.length) { return; }
    if (reduce || !('IntersectionObserver' in window)) { return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || counted.has(entry.target)) { return; }
        counted.add(entry.target);
        countUp(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: .4 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ---------- 6. полёт в корзину ---------- */
  function cartAnchor() {
    return $('.site-header a[href*="cart"], header a[href*="cart"], a[href*="cart"].header-actions__link') ||
      $('a[href*="cart"]');
  }
  function badgeNode() {
    return $('[data-cart-count]') || $('.cart-count') || $('.icon-btn__count') || $('.header-actions .badge') ||
      $('[class*="count"]') || $('.header-actions .badge');
  }

  function flyFrom(source) {
    if (reduce || !source) { return; }
    var target = cartAnchor();
    if (!target) { return; }
    var img = source.tagName === 'IMG' ? source : $('img', source);
    if (!img) { return; }
    var from = (img || source).getBoundingClientRect();
    var to = target.getBoundingClientRect();
    if (!from.width || !to.width) { return; }

    var clone = doc.createElement('img');
    clone.className = 'fly-item';
    clone.src = img.currentSrc || img.src;
    clone.alt = '';
    clone.style.left = from.left + from.width / 2 - 28 + 'px';
    clone.style.top = from.top + from.height / 2 - 28 + 'px';
    doc.body.appendChild(clone);

    var dx = to.left + to.width / 2 - (from.left + from.width / 2);
    var dy = to.top + to.height / 2 - (from.top + from.height / 2);
    var mid = { x: dx * .55, y: dy * .55 - 70 };

    if (clone.animate) {
      var anim = clone.animate([
        { transform: 'translate3d(0,0,0) scale(1)', opacity: 1, offset: 0 },
        { transform: 'translate3d(' + mid.x + 'px,' + mid.y + 'px,0) scale(.72)', opacity: 1, offset: .55 },
        { transform: 'translate3d(' + dx + 'px,' + dy + 'px,0) scale(.24)', opacity: .2, offset: 1 }
      ], { duration: 720, easing: 'cubic-bezier(.4,.05,.5,1)' });
      anim.onfinish = function () {
        clone.remove();
        var badge = badgeNode();
        if (badge) {
          badge.classList.remove('is-bumped');
          void badge.offsetWidth;
          badge.classList.add('is-bumped');
        }
      };
    } else {
      clone.remove();
    }
  }

  /* Кнопка добавления в магазинах серии подписана по-разному: data-add, data-action="add",
     иногда просто «В корзину». Ловим все три случая. */
  var ADD_SELECTOR = '[data-add], [data-action="add"], .card__add, .js-add, .lot__add';

  function addButton(node) {
    var found = node.closest ? node.closest(ADD_SELECTOR) : null;
    if (found) { return found; }
    var btn = node.closest ? node.closest('button') : null;
    return btn && /в корзину|заказать/i.test(btn.textContent) ? btn : null;
  }

  doc.addEventListener('click', function (event) {
    var btn = addButton(event.target);
    if (!btn || btn.disabled) { return; }
    var card = btn.closest('.card, .product, article.lot, article, li') || btn.parentElement;
    flyFrom(card);
  }, true);

  /* ---------- 7. карточки, которые магазин дорисовал после фильтра ---------- */
  function watchNewCards() {
    var host = $('.catalog__grid, .grid, main');
    if (!host || !('MutationObserver' in window)) { return; }
    var pending = false;
    var mo = new MutationObserver(function () {
      if (pending) { return; }
      pending = true;
      window.requestAnimationFrame(function () {
        pending = false;
        numberReveals();
        $$('.reveal:not(.is-visible)').forEach(function (n, i) {
          if (!n.style.getPropertyValue('--i')) { n.style.setProperty('--i', String(Math.min(i, 6))); }
          n.classList.add('tile-pop');
        });
      });
    });
    mo.observe(host, { childList: true });
  }

  /* ---------- страховка: то, что уже выше кадра, показываем принудительно ----------
     Иначе при переходе по якорю или восстановленной прокрутке секции остаются пустыми. */
  function sweep() {
    $$('.reveal:not(.is-visible)').forEach(function (node) {
      var box = node.getBoundingClientRect();
      if (box.top < window.innerHeight * .96) { node.classList.add('is-visible'); }
    });
  }

  /* ---------- запуск ---------- */
  function boot() {
    collectParallax();
    collectCounters();
    numberReveals();
    watchCounters();
    watchNewCards();
    window.requestAnimationFrame(function () { html.classList.add('is-ready'); });

    var tick = false;
    window.addEventListener('scroll', function () {
      if (tick) { return; }
      tick = true;
      window.requestAnimationFrame(function () { tick = false; onScroll(); sweep(); });
    }, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
    window.setTimeout(sweep, 900);
    window.setTimeout(sweep, 2400);
    window.addEventListener('load', sweep);
  }

  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', boot); }
  else { boot(); }
}());
