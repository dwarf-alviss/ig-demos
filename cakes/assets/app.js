/* app.js — вся логика «Мельницы»: каталог, корзина, оформление заказа, панель владельца.
   Никаких библиотек, без fetch() — только DOM, localStorage и данные из data.js. */
(function () {
  'use strict';

  /* ============================================================
     1. Мелкие утилиты
     ============================================================ */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function money(n) {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' BYN';
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayISO() { return toISO(new Date()); }
  function addDays(iso, days) {
    var d = iso ? new Date(iso + 'T12:00:00') : new Date();
    d.setDate(d.getDate() + days);
    return toISO(d);
  }
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function dateRu(iso) {
    if (!iso) return '—';
    var d = new Date(iso.length > 10 ? iso : iso + 'T12:00:00');
    if (isNaN(d)) return iso;
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  }
  function dateTimeRu(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return dateRu(toISO(d)) + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function statusInfo(id) {
    return STATUSES.filter(function (s) { return s.id === id; })[0] || STATUSES[0];
  }
  function featureLabel(id) {
    var f = FEATURES.filter(function (x) { return x.id === id; })[0];
    return f ? f.label : id;
  }
  function productById(id) {
    return PRODUCTS.filter(function (p) { return p.id === id; })[0] || null;
  }

  /* ---------- иконки «Мельницы»: округлый плотный контур, штрих 1.8,
     viewBox 0 0 24 24. Корзина — коробка для торта с бантом, а не сумка. ---------- */
  var ICONS = {
    'cake-box': '<path d="M5.2 8.6h13.6a1.2 1.2 0 0 1 1.2 1.2v1.6a1.2 1.2 0 0 1-1.2 1.2H5.2A1.2 1.2 0 0 1 4 11.4v-1.6a1.2 1.2 0 0 1 1.2-1.2Z"/><path d="M5.8 12.6v5.5a1.4 1.4 0 0 0 1.4 1.4h9.6a1.4 1.4 0 0 0 1.4-1.4v-5.5"/><path d="M12 8.6V7.4"/><path d="M12 7.7c-.7-1.8-3.5-1.9-3.5-.2 0 1.2 1.9 1.6 3.5.2Z"/><path d="M12 7.7c.7-1.8 3.5-1.9 3.5-.2 0 1.2-1.9 1.6-3.5.2Z"/>',
    'menu': '<path d="M5 7h14"/><path d="M5 12h14"/><path d="M5 17h9"/>',
    'search': '<circle cx="10.8" cy="10.8" r="6.6"/><path d="m20 20-4.4-4.4"/>',
    'clock': '<circle cx="12" cy="12" r="8.8"/><path d="M12 7.2V12l3.4 2"/>',
    'calendar': '<rect x="3.2" y="5" width="17.6" height="15.8" rx="3.4"/><path d="M3.2 9.8h17.6"/><path d="M8 3v3.6"/><path d="M16 3v3.6"/>',
    'candle': '<path d="M9.4 21h5.2"/><rect x="10.2" y="10.4" width="3.6" height="10.6" rx="1.3"/><path d="M12 10.4V8.6"/><path d="M12 8.6c1.7-1.2 1.7-3.2 0-4.7-1.7 1.5-1.7 3.5 0 4.7Z"/>',
    'whisk': '<path d="M20.6 3.4 15 9"/><path d="M15 9c-3.9-2.6-7.6-.4-8.4 3.5-.8 3.9 1 6.5 3.3 6.5 3 0 5.4-3.2 5.1-10Z"/><path d="M14.2 12.4c-2.3-1.2-4.3-.2-4.9 2"/>',
    'scales': '<path d="M12 3.2v17"/><path d="M8.4 20.8h7.2"/><path d="M12 5.6H5.6"/><path d="M12 5.6h6.4"/><path d="M3.4 12.2a2.2 2.2 0 0 0 4.4 0L5.6 5.6 3.4 12.2Z"/><path d="M16.2 12.2a2.2 2.2 0 0 0 4.4 0L18.4 5.6 16.2 12.2Z"/>',
    'truck': '<path d="M15.4 17.2V6.4a1.8 1.8 0 0 0-1.8-1.8H5.2a1.8 1.8 0 0 0-1.8 1.8v10.8"/><path d="M9.6 17.2h4.6"/><path d="M15.4 9.2h2.7a1.8 1.8 0 0 1 1.5.8l1.7 2.5c.2.3.3.6.3 1v1.9a1.8 1.8 0 0 1-1.8 1.8h-1.2"/><circle cx="7.4" cy="17.6" r="2.2"/><circle cx="17.6" cy="17.6" r="2.2"/>',
    'heart': '<path d="M12 20.8 4.6 13.4a4.9 4.9 0 0 1 7-6.9l.4.4.4-.4a4.9 4.9 0 0 1 7 6.9Z"/>',
    'phone': '<path d="M6.6 3.4h2.6a1.8 1.8 0 0 1 1.7 1.3l.7 2.3a1.8 1.8 0 0 1-.5 1.8L9.6 10a13 13 0 0 0 4.4 4.4l1.2-1.5a1.8 1.8 0 0 1 1.8-.5l2.3.7a1.8 1.8 0 0 1 1.3 1.7v2.6a1.8 1.8 0 0 1-2 1.8C11.9 18.5 5.5 12.1 4.8 5.4a1.8 1.8 0 0 1 1.8-2Z"/>',
    'mail': '<rect x="3" y="5.2" width="18" height="13.6" rx="3"/><path d="m4.6 8.4 6.2 4.1a2.2 2.2 0 0 0 2.4 0l6.2-4.1"/>',
    'map-pin': '<path d="M12 21.2c4-3.6 6.6-6.9 6.6-10a6.6 6.6 0 1 0-13.2 0c0 3.1 2.6 6.4 6.6 10Z"/><circle cx="12" cy="11" r="2.6"/>',
    'instagram': '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.4"/><circle cx="12" cy="12" r="4.2"/><path d="M17.2 6.9h.01"/>',
    'check': '<path d="M4.8 12.4 9.6 17.2 19.2 6.8"/>',
    'chevron-right': '<path d="m9.6 5.6 6.4 6.4-6.4 6.4"/>',
    'arrow-right': '<path d="M4.4 12h15.2"/><path d="m13.6 6 6 6-6 6"/>',
    'x': '<path d="m6.4 6.4 11.2 11.2"/><path d="m17.6 6.4-11.2 11.2"/>',
    'plus': '<path d="M12 5.2v13.6"/><path d="M5.2 12h13.6"/>',
    'minus': '<path d="M5.2 12h13.6"/>',
    'trash-2': '<path d="M4 7h16"/><path d="M9.2 7V5.4A1.4 1.4 0 0 1 10.6 4h2.8a1.4 1.4 0 0 1 1.4 1.4V7"/><path d="M6.4 7v11.6A1.4 1.4 0 0 0 7.8 20h8.4a1.4 1.4 0 0 0 1.4-1.4V7"/><path d="M10.4 11v5.2"/><path d="M13.6 11v5.2"/>',
    'user': '<circle cx="12" cy="8" r="3.8"/><path d="M4.8 20.4a7.2 7.2 0 0 1 14.4 0"/>',
    'settings': '<circle cx="12" cy="12" r="2.9"/><path d="M12 3.4v2.2"/><path d="M12 18.4v2.2"/><path d="M4.3 7.7 6.2 8.8"/><path d="m17.8 15.2 1.9 1.1"/><path d="M4.3 16.3l1.9-1.1"/><path d="m17.8 8.8 1.9-1.1"/>',
    'star': '<path d="M12 3.6l2.5 5.1 5.6.8-4.1 4 1 5.6-5-2.6-5 2.6 1-5.6-4.1-4 5.6-.8Z"/>',
    'gift': '<rect x="3.2" y="8.4" width="17.6" height="4.2" rx="1.2"/><path d="M4.8 12.6v5.8a1.6 1.6 0 0 0 1.6 1.6h11.2a1.6 1.6 0 0 0 1.6-1.6v-5.8"/><path d="M12 8.4v11.6"/><path d="M12 8.4c-1.2-2.4-5-2.6-5-.6 0 1.7 2.9 2.2 5 .6Z"/><path d="M12 8.4c1.2-2.4 5-2.6 5-.6 0 1.7-2.9 2.2-5 .6Z"/>',
    'sparkles': '<path d="M12 3.6c.5 4.3 2.5 6.3 6.8 6.8-4.3.5-6.3 2.5-6.8 6.8-.5-4.3-2.5-6.3-6.8-6.8 4.3-.5 6.3-2.5 6.8-6.8Z"/><path d="M18.4 15.6c.2 1.9 1.1 2.8 3 3-1.9.2-2.8 1.1-3 3-.2-1.9-1.1-2.8-3-3 1.9-.2 2.8-1.1 3-3Z"/>',
    'filter': '<path d="M20.4 4.4 13.6 12v6.2l-3.2 2V12L3.6 4.4A.8.8 0 0 1 4.2 3h15.6a.8.8 0 0 1 .6 1.4Z"/>',
    'credit-card': '<rect x="2.8" y="5.6" width="18.4" height="12.8" rx="3"/><path d="M2.8 10.2h18.4"/><path d="M6.4 14.6h3.2"/>',
    'shield-check': '<path d="M12 3.2 5 5.9v5.6c0 4.2 2.9 7.4 7 9.3 4.1-1.9 7-5.1 7-9.3V5.9Z"/><path d="m9.2 11.8 2 2 3.6-3.8"/>',
    'package': '<path d="M3.6 8.4 12 4.4l8.4 4v7.2L12 19.6l-8.4-4Z"/><path d="M3.6 8.4 12 12.4l8.4-4"/><path d="M12 12.4v7.2"/>',
    'ruler': '<path d="M20.6 15.4a2 2 0 0 1 0 2.8l-2.4 2.4a2 2 0 0 1-2.8 0L3.4 8.6a2 2 0 0 1 0-2.8l2.4-2.4a2 2 0 0 1 2.8 0Z"/><path d="m13.6 11.8 1.8-1.8"/><path d="m11 9.2 1.8-1.8"/><path d="m8.4 6.6 1.8-1.8"/><path d="m16.2 14.4 1.8-1.8"/>',
    'palette': '<path d="M12 21.4a9.4 9.4 0 1 1 9.4-9.4c0 2.6-2 4.6-4.6 4.6h-2a2 2 0 0 0-1.6 3.2l.2.3a1.9 1.9 0 0 1-1.4 2.9Z"/><circle cx="13.4" cy="7.6" r="1"/><circle cx="17" cy="11" r="1"/><circle cx="8.2" cy="13" r="1"/><circle cx="9.8" cy="8.4" r="1"/>',
    'scissors': '<circle cx="6.4" cy="6.4" r="2.6"/><circle cx="6.4" cy="17.6" r="2.6"/><path d="M8.3 8.2 20 20"/><path d="M20 4 8.3 15.8"/>'
  };
  function icon(name, cls) {
    var body = ICONS[name] || '';
    return '<svg class="' + (cls || 'icon') + '" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  /* ============================================================
     2. Хранилище: корзина и заказы
     ============================================================ */
  var CART_KEY = 'igdemo_cakes_cart_v1';
  var ORDERS_KEY = 'igdemo_cakes_orders_v1';

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var val = JSON.parse(raw);
      return val === null || val === undefined ? fallback : val;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* приватный режим */ }
  }

  function getCart() {
    var raw = readJSON(CART_KEY, []);
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (i) { return i && i.id && i.qty > 0; });
  }
  function saveCart(cart) {
    writeJSON(CART_KEY, cart);
    updateCartBadges();
  }
  function addToCart(item, qty) {
    qty = qty || 1;
    var cart = getCart();
    var same = cart.filter(function (i) { return i.id === item.id; })[0];
    if (same) {
      same.qty += qty;
    } else {
      var copy = { id: item.id, qty: qty };
      if (item.title) { copy.title = item.title; copy.price = item.price; copy.meta = item.meta; copy.img = item.img; }
      cart.push(copy);
    }
    saveCart(cart);
  }
  function setQty(id, qty) {
    var cart = getCart().map(function (i) {
      if (i.id === id) i.qty = Math.max(1, Math.min(20, qty));
      return i;
    });
    saveCart(cart);
  }
  function removeFromCart(id) {
    saveCart(getCart().filter(function (i) { return i.id !== id; }));
  }
  function clearCart() { saveCart([]); }

  /* строка корзины: товар из каталога или торт, собранный в калькуляторе */
  function cartLine(item) {
    var p = productById(item.id);
    if (p) {
      return {
        id: item.id, qty: item.qty, title: p.name, meta: p.format,
        price: p.price, img: p.img, alt: p.alt
      };
    }
    return {
      id: item.id, qty: item.qty,
      title: item.title || 'Торт на заказ',
      meta: item.meta || 'собрали в калькуляторе',
      price: item.price || 0,
      img: item.img || 'assets/img/hero.jpg',
      alt: 'Торт на заказ'
    };
  }
  function cartLines() { return getCart().map(cartLine); }
  function cartCount() {
    return getCart().reduce(function (n, i) { return n + i.qty; }, 0);
  }
  function cartSubtotal() {
    return cartLines().reduce(function (sum, l) { return sum + l.price * l.qty; }, 0);
  }
  function deliveryFor(subtotal, method) {
    if (method === 'pickup') return 0;
    return subtotal >= SHOP.freeFrom ? 0 : (subtotal > 0 ? SHOP.deliveryFee : 0);
  }

  function getOrders() {
    var raw = readJSON(ORDERS_KEY, []);
    return Array.isArray(raw) ? raw : [];
  }
  function saveOrders(list) { writeJSON(ORDERS_KEY, list); }

  /* ============================================================
     3. Общие элементы: счётчик корзины, меню, тост, появление секций
     ============================================================ */
  function updateCartBadges() {
    var n = cartCount();
    $$('.js-cart-count').forEach(function (el) {
      el.textContent = n > 99 ? '99+' : String(n);
      el.hidden = n === 0;
    });
    var subtotal = cartSubtotal();
    $$('.js-cart-total-mini').forEach(function (el) {
      // при пустой корзине сумму не показываем, чтобы в шапке не висел «0 BYN»
      el.textContent = subtotal > 0 ? money(subtotal) : '';
      el.hidden = subtotal === 0;
    });
  }

  var toastTimer = null;
  function toast(message) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-visible'); }, 2600);
  }

  function initDrawer() {
    var burger = $('.js-burger');
    var drawer = $('#drawer');
    var backdrop = $('#drawer-backdrop');
    if (!burger || !drawer) return;
    function setOpen(open) {
      drawer.classList.toggle('is-open', open);
      if (backdrop) backdrop.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('is-locked', open);
    }
    burger.addEventListener('click', function () { setOpen(!drawer.classList.contains('is-open')); });
    if (backdrop) backdrop.addEventListener('click', function () { setOpen(false); });
    $$('a', drawer).forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    var closeBtn = $('.js-drawer-close', drawer);
    if (closeBtn) closeBtn.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  function initReveal() {
    var items = $$('.reveal');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
    // Страховка: если наблюдатель не сработал, всё, что на первом экране, всё равно показываем
    window.setTimeout(function () {
      items.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) { el.classList.add('is-visible'); }
      });
    }, 900);
  }

  function initYear() {
    $$('.js-year').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* ============================================================
     4. Каталог
     ============================================================ */
  function cardHTML(p) {
    var feats = p.features.slice(0, 3).map(function (f) {
      return '<span class="tag">' + esc(featureLabel(f)) + '</span>';
    }).join('');
    return '' +
      '<article class="card product reveal">' +
        '<div class="card__media">' +
          '<img src="' + esc(p.img) + '" alt="' + esc(p.alt) + '" loading="lazy" width="900" height="675">' +
          (p.badge ? '<span class="badge card__badge">' + esc(p.badge) + '</span>' : '') +
        '</div>' +
        '<div class="card__body">' +
          '<h3 class="product__name">' + esc(p.name) + '</h3>' +
          '<p class="product__format">' + esc(p.format) + '</p>' +
          '<p class="product__desc small">' + esc(p.desc) + '</p>' +
          '<p class="product__prep small muted">' + icon('clock', 'icon icon--sm') + 'испечём за ' + p.prep + ' ' + plural(p.prep, 'день', 'дня', 'дней') + '</p>' +
          '<div class="tags">' + feats + '</div>' +
          '<div class="card__foot">' +
            '<span class="price">' + money(p.price) + '</span>' +
            '<button class="btn btn--sm" type="button" data-add="' + esc(p.id) + '">' + icon('cake-box', 'icon icon--sm') + 'В корзину</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function initCatalog() {
    var grid = $('#products');
    if (!grid) return;

    var state = { q: '', cat: 'all', price: 'any', features: [], sort: 'popular' };

    var catBox = $('#filter-cat');
    var priceBox = $('#filter-price');
    var featBox = $('#filter-features');
    var sortSel = $('#sort');
    var searchInput = $('#search');
    var countEl = $('#results-count');
    var resetBtn = $('#reset-filters');
    var emptyBox = $('#catalog-empty');

    function chipHTML(id, label, pressed) {
      return '<button class="chip" type="button" data-value="' + esc(id) + '" aria-pressed="' + (pressed ? 'true' : 'false') + '">' + esc(label) + '</button>';
    }
    function renderControls() {
      if (catBox) catBox.innerHTML = CATEGORIES.map(function (c) { return chipHTML(c.id, c.label, state.cat === c.id); }).join('');
      if (priceBox) priceBox.innerHTML = PRICE_RANGES.map(function (r) { return chipHTML(r.id, r.label, state.price === r.id); }).join('');
      if (featBox) featBox.innerHTML = FEATURES.map(function (f) { return chipHTML(f.id, f.label, state.features.indexOf(f.id) > -1); }).join('');
      if (sortSel) sortSel.innerHTML = SORTS.map(function (s) {
        return '<option value="' + esc(s.id) + '"' + (state.sort === s.id ? ' selected' : '') + '>' + esc(s.label) + '</option>';
      }).join('');
    }

    function filtered() {
      var q = state.q.trim().toLowerCase();
      var range = PRICE_RANGES.filter(function (r) { return r.id === state.price; })[0] || PRICE_RANGES[0];
      var list = PRODUCTS.filter(function (p) {
        if (state.cat !== 'all' && p.tags.indexOf(state.cat) === -1) return false;
        if (p.price < range.min || p.price > range.max) return false;
        if (state.features.length && !state.features.every(function (f) { return p.features.indexOf(f) > -1; })) return false;
        if (q) {
          var hay = (p.name + ' ' + p.desc + ' ' + p.format + ' ' + p.tags.join(' ')).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });
      if (state.sort === 'cheap') list.sort(function (a, b) { return a.price - b.price; });
      else if (state.sort === 'expensive') list.sort(function (a, b) { return b.price - a.price; });
      else list.sort(function (a, b) { return a.popular - b.popular; });
      return list;
    }

    function render() {
      var list = filtered();
      grid.innerHTML = list.map(cardHTML).join('');
      if (countEl) {
        countEl.innerHTML = 'Нашли <strong>' + list.length + '</strong> ' + plural(list.length, 'торт', 'торта', 'тортов') + ' из ' + PRODUCTS.length;
      }
      if (emptyBox) emptyBox.hidden = list.length !== 0;
      grid.hidden = list.length === 0;
      initReveal();
    }

    function onClickChips(container, multi) {
      if (!container) return;
      container.addEventListener('click', function (e) {
        var chip = e.target.closest ? e.target.closest('.chip') : null;
        if (!chip || !container.contains(chip)) return;
        var val = chip.getAttribute('data-value');
        if (multi) {
          var i = state.features.indexOf(val);
          if (i > -1) state.features.splice(i, 1); else state.features.push(val);
        } else if (container === catBox) {
          state.cat = val;
        } else {
          state.price = val;
        }
        renderControls();
        render();
      });
    }
    onClickChips(catBox, false);
    onClickChips(priceBox, false);
    onClickChips(featBox, true);

    if (sortSel) sortSel.addEventListener('change', function () { state.sort = sortSel.value; render(); });
    if (searchInput) {
      searchInput.addEventListener('input', function () { state.q = searchInput.value; render(); });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        state = { q: '', cat: 'all', price: 'any', features: [], sort: 'popular' };
        if (searchInput) searchInput.value = '';
        renderControls();
        render();
        toast('Фильтры убрали, показываем всё');
      });
      var resetEmpty = $('#reset-filters-empty');
      if (resetEmpty) resetEmpty.addEventListener('click', function () { resetBtn.click(); });
    }
    grid.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-add]') : null;
      if (!btn) return;
      var p = productById(btn.getAttribute('data-add'));
      if (!p) return;
      addToCart({ id: p.id }, 1);
      toast('Положили «' + p.name + '» в корзину');
    });

    renderControls();
    render();

    /* быстрые ссылки с главной: catalog.html#kids и т.п. */
    var hash = (location.hash || '').replace('#', '');
    if (hash && CATEGORIES.some(function (c) { return c.id === hash; })) {
      state.cat = hash;
      renderControls();
      render();
    }
  }

  /* ============================================================
     5. Главная: популярное + калькулятор заказа
     ============================================================ */
  function initPopular() {
    var box = $('#popular');
    if (!box) return;
    var list = PRODUCTS.slice().sort(function (a, b) { return a.popular - b.popular; }).slice(0, 3);
    box.innerHTML = list.map(cardHTML).join('');
    box.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-add]') : null;
      if (!btn) return;
      var p = productById(btn.getAttribute('data-add'));
      if (!p) return;
      addToCart({ id: p.id }, 1);
      toast('Положили «' + p.name + '» в корзину');
    });
    initReveal();
  }

  function calcPrep(weight, decor) {
    var prep = SHOP_LEAD_DAYS(weight) + (decor ? decor.prep : 0);
    return prep;
  }
  function SHOP_LEAD_DAYS(weight) {
    if (weight >= 4) return 4;
    if (weight >= 3) return 3;
    return 2;
  }
  function calcPrice(weight, flavor, decor) {
    var perKg = PRICE_PER_KG[weight] !== undefined ? PRICE_PER_KG[weight] : 84;
    var base = perKg * weight;
    var flavorExtra = flavor ? flavor.extra * weight : 0;
    var decorExtra = decor ? decor.extra : 0;
    return Math.round(base + flavorExtra + decorExtra);
  }

  function initCalculator() {
    var root = $('#calc');
    if (!root) return;

    var state = {
      weight: 2,
      flavor: FLAVORS[0],
      decor: DECORS[0],
      date: ''
    };

    var weightBox = $('#calc-weight');
    var flavorBox = $('#calc-flavor');
    var decorBox = $('#calc-decor');
    var dateInput = $('#calc-date');
    var outPrice = $('#calc-price');
    var outTerms = $('#calc-terms');
    var outList = $('#calc-list');
    var warn = $('#calc-warning');
    var addBtn = $('#calc-add');

    if (weightBox) {
      weightBox.innerHTML = WEIGHTS.map(function (w) {
        return '<button class="chip chip--lg" type="button" data-kg="' + w.kg + '" aria-pressed="' + (state.weight === w.kg ? 'true' : 'false') + '">' +
          '<span class="chip__title">' + esc(w.label) + '</span><span class="chip__note">' + esc(w.note) + '</span></button>';
      }).join('');
    }
    if (flavorBox) {
      flavorBox.innerHTML = FLAVORS.map(function (f) {
        return '<button class="chip chip--lg" type="button" data-flavor="' + esc(f.id) + '" aria-pressed="' + (state.flavor.id === f.id ? 'true' : 'false') + '">' +
          '<span class="chip__title">' + esc(f.name) + '</span><span class="chip__note">' + esc(f.note) + (f.extra ? ' · +' + f.extra + ' BYN/кг' : '') + '</span></button>';
      }).join('');
    }
    if (decorBox) {
      decorBox.innerHTML = DECORS.map(function (d) {
        return '<button class="chip chip--lg" type="button" data-decor="' + esc(d.id) + '" aria-pressed="' + (state.decor.id === d.id ? 'true' : 'false') + '">' +
          '<span class="chip__title">' + esc(d.name) + '</span><span class="chip__note">' + esc(d.note) + (d.extra ? ' · +' + d.extra + ' BYN' : '') + '</span></button>';
      }).join('');
    }

    function minDate() { return addDays(todayISO(), calcPrep(state.weight, state.decor)); }

    /* вес и декор меняют срок: если дата стала слишком ранней, ставим ближайшую возможную
       и не показываем предупреждение — человек его не заслужил, он просто выбрал торт побольше */
    function resetDate() {
      state.date = '';
      if (dateInput) dateInput.value = '';
    }

    function render() {
      $$('[data-kg]', weightBox).forEach(function (b) {
        b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-kg')) === state.weight));
      });
      $$('[data-flavor]', flavorBox).forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-flavor') === state.flavor.id));
      });
      $$('[data-decor]', decorBox).forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-decor') === state.decor.id));
      });

      var prep = calcPrep(state.weight, state.decor);
      var min = minDate();
      if (dateInput) {
        dateInput.min = min;
        if (!dateInput.value) dateInput.value = min;
        state.date = dateInput.value;
      }
      if (outPrice) outPrice.textContent = money(calcPrice(state.weight, state.flavor, state.decor));
      if (outTerms) {
        outTerms.innerHTML = 'К <strong>' + esc(dateRu(min)) + '</strong> успеваем: работы на ' + prep + ' ' + plural(prep, 'день', 'дня', 'дней');
      }
      if (outList) {
        var perKg = PRICE_PER_KG[state.weight];
        var rows = [
          ['Вес', state.weight + ' кг · ' + WEIGHTS.filter(function (w) { return w.kg === state.weight; })[0].note],
          ['Начинка', state.flavor.name + (state.flavor.extra ? ' (+' + state.flavor.extra + ' BYN/кг)' : '')],
          ['Декор', state.decor.name + (state.decor.extra ? ' (+' + state.decor.extra + ' BYN)' : '')],
          ['Цена за кг', money(perKg)],
          ['Дата', dateRu(state.date || min)]
        ];
        outList.innerHTML = rows.map(function (r) {
          return '<div class="calc__row"><span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></div>';
        }).join('');
      }
      var tooEarly = !!(state.date && state.date < min);
      if (warn) {
        warn.hidden = !tooEarly;
        warn.textContent = tooEarly
          ? 'С таким декором раньше ' + dateRu(min) + ' не получится. Возьмите эту дату или декор попроще.'
          : '';
      }
      if (addBtn) addBtn.disabled = tooEarly;
    }

    if (weightBox) weightBox.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-kg]') : null;
      if (!b) return;
      state.weight = Number(b.getAttribute('data-kg'));
      resetDate();
      render();
    });
    if (flavorBox) flavorBox.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-flavor]') : null;
      if (!b) return;
      var id = b.getAttribute('data-flavor');
      state.flavor = FLAVORS.filter(function (f) { return f.id === id; })[0] || state.flavor;
      render();
    });
    if (decorBox) decorBox.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-decor]') : null;
      if (!b) return;
      var id = b.getAttribute('data-decor');
      state.decor = DECORS.filter(function (d) { return d.id === id; })[0] || state.decor;
      resetDate();
      render();
    });
    if (dateInput) dateInput.addEventListener('change', function () { state.date = dateInput.value; render(); });

    if (addBtn) addBtn.addEventListener('click', function () {
      var price = calcPrice(state.weight, state.flavor, state.decor);
      var title = 'Торт на заказ · ' + state.weight + ' кг · ' + state.flavor.name + ' · ' + state.decor.name;
      addToCart({
        id: 'custom-cake',
        title: title,
        price: price,
        meta: 'готов к ' + dateRu(state.date || minDate()),
        img: 'assets/img/berry.jpg'
      }, 1);
      toast('Торт на заказ в корзине: ' + money(price));
    });

    render();
  }

  /* ============================================================
     6. Корзина и оформление заказа
     ============================================================ */
  function cartLineHTML(l, removable) {
    return '' +
      '<li class="cart-line" data-id="' + esc(l.id) + '">' +
        '<div class="cart-line__media"><img src="' + esc(l.img) + '" alt="' + esc(l.alt) + '" width="160" height="120"></div>' +
        '<div class="cart-line__body">' +
          '<h3 class="cart-line__title">' + esc(l.title) + '</h3>' +
          '<p class="small muted">' + esc(l.meta) + '</p>' +
          '<p class="cart-line__price price">' + money(l.price) + '</p>' +
        '</div>' +
        '<div class="cart-line__controls">' +
          '<div class="stepper" role="group" aria-label="Количество: ' + esc(l.title) + '">' +
            '<button class="stepper__btn" type="button" data-dec="' + esc(l.id) + '" aria-label="Уменьшить количество">' + icon('minus', 'icon icon--sm') + '</button>' +
            '<span class="stepper__value js-qty">' + l.qty + '</span>' +
            '<button class="stepper__btn" type="button" data-inc="' + esc(l.id) + '" aria-label="Увеличить количество">' + icon('plus', 'icon icon--sm') + '</button>' +
          '</div>' +
          '<span class="cart-line__sum">' + money(l.price * l.qty) + '</span>' +
          (removable ? '<button class="icon-btn icon-btn--sm" type="button" data-del="' + esc(l.id) + '" aria-label="Удалить «' + esc(l.title) + '»">' + icon('trash-2', 'icon icon--sm') + '</button>' : '') +
        '</div>' +
      '</li>';
  }

  function initCartPage() {
    var listBox = $('#cart-lines');
    if (!listBox) return;

    var emptyBox = $('#cart-empty');
    var contentBox = $('#cart-content');
    var checkoutBox = $('#checkout');
    var successBox = $('#order-success');
    var sumSub = $('#sum-subtotal');
    var sumDelivery = $('#sum-delivery');
    var sumTotal = $('#sum-total');
    var shipNote = $('#ship-note');
    var shipBar = $('#ship-bar');
    var form = $('#order-form');
    var phoneInput = $('#f-phone');
    var addrField = $('#field-address');
    var addrInput = $('#f-address');
    var dateInput = $('#f-date');
    if (dateInput) {
      dateInput.min = addDays(todayISO(), 1);
      dateInput.value = addDays(todayISO(), 2);
    }

    function method() {
      var checked = form ? form.querySelector('input[name="method"]:checked') : null;
      return checked ? checked.value : 'pickup';
    }

    function render() {
      var lines = cartLines();
      var has = lines.length > 0;
      if (emptyBox) emptyBox.hidden = has;
      if (contentBox) contentBox.hidden = !has;
      if (checkoutBox) checkoutBox.hidden = !has;
      if (!has) return;

      listBox.innerHTML = lines.map(function (l) { return cartLineHTML(l, true); }).join('');

      var subtotal = cartSubtotal();
      var del = deliveryFor(subtotal, method());
      if (sumSub) sumSub.textContent = money(subtotal);
      if (sumDelivery) {
        sumDelivery.textContent = method() === 'pickup'
          ? 'самовывоз — 0 BYN'
          : (del === 0 ? 'бесплатно' : money(del));
      }
      if (sumTotal) sumTotal.textContent = money(subtotal + del);
      if (shipNote) {
        var left = SHOP.freeFrom - subtotal;
        shipNote.textContent = left > 0
          ? 'До бесплатной доставки не хватает ' + money(left)
          : 'Доставим по Минску бесплатно';
      }
      if (shipBar) {
        var pct = Math.max(0, Math.min(100, (subtotal / SHOP.freeFrom) * 100));
        shipBar.style.width = pct.toFixed(1) + '%';
      }
      if (addrField) addrField.hidden = method() !== 'delivery';
      updateCartBadges();
    }

    listBox.addEventListener('click', function (e) {
      var t = e.target;
      var inc = t.closest ? t.closest('[data-inc]') : null;
      var dec = t.closest ? t.closest('[data-dec]') : null;
      var del = t.closest ? t.closest('[data-del]') : null;
      if (inc) {
        var id = inc.getAttribute('data-inc');
        var line = getCart().filter(function (i) { return i.id === id; })[0];
        if (line) { setQty(id, line.qty + 1); render(); }
      } else if (dec) {
        var id2 = dec.getAttribute('data-dec');
        var line2 = getCart().filter(function (i) { return i.id === id2; })[0];
        if (line2) {
          if (line2.qty <= 1) { removeFromCart(id2); } else { setQty(id2, line2.qty - 1); }
          render();
        }
      } else if (del) {
        removeFromCart(del.getAttribute('data-del'));
        toast('Убрали из корзины');
        render();
      }
    });

    if (form) {
      $$('input[name="method"]', form).forEach(function (r) { r.addEventListener('change', render); });
    }

    /* маска телефона +375 (29) 123-45-67*/
    if (phoneInput) {
      phoneInput.addEventListener('input', function () {
        var digits = phoneInput.value.replace(/\D/g, '');
        if (digits.indexOf('375') === 0) digits = digits.slice(3);
        else if (digits.indexOf('80') === 0) digits = digits.slice(2);
        digits = digits.slice(0, 9);
        var out = '+375';
        if (digits.length) out += ' (' + digits.slice(0, 2);
        if (digits.length >= 2) out += ')';
        if (digits.length > 2) out += ' ' + digits.slice(2, 5);
        if (digits.length > 5) out += '-' + digits.slice(5, 7);
        if (digits.length > 7) out += '-' + digits.slice(7, 9);
        phoneInput.value = out;
      });
    }

    function setError(fieldId, message) {
      var field = document.getElementById(fieldId);
      var err = document.getElementById(fieldId + '-error');
      if (field) field.classList.toggle('is-invalid', !!message);
      if (err) err.textContent = message || '';
      return !message;
    }

    function validate() {
      var ok = true;
      var name = $('#f-name');
      ok = setError('f-name', name.value.trim().length < 2 ? 'Как к вам обращаться?' : '') && ok;
      var digits = phoneInput.value.replace(/\D/g, '');
      ok = setError('f-phone', digits.length < 12 ? 'Наберите номер целиком: +375 (29) 123-45-67' : '') && ok;
      if (method() === 'delivery') {
        ok = setError('f-address', addrInput.value.trim().length < 5 ? 'Напишите адрес: улица, дом, квартира' : '') && ok;
      } else {
        setError('f-address', '');
      }
      var d = $('#f-date').value;
      ok = setError('f-date', !d ? 'Без даты не испечём: выберите день' : (d < addDays(todayISO(), 1) ? 'Эта дата уже прошла, возьмите другую' : '')) && ok;
      return ok;
    }

    function nextOrderNo() {
      return String(Date.now() % 10000).padStart(4, '0');
    }

    function renderSuccess(order) {
      if (checkoutBox) checkoutBox.hidden = true;
      if (contentBox) contentBox.hidden = true;
      if (emptyBox) emptyBox.hidden = true;
      if (!successBox) return;
      successBox.hidden = false;
      var items = order.items.map(function (i) {
        return '<li><span>' + esc(i.title) + ' × ' + i.qty + '</span><span>' + money(i.price * i.qty) + '</span></li>';
      }).join('');
      successBox.innerHTML = '' +
        '<div class="success">' +
          '<div class="success__icon">' + icon('check', 'icon icon--xl') + '</div>' +
          '<p class="eyebrow">заказ принят</p>' +
          '<h2>Заказ №' + esc(order.no) + ' записан</h2>' +
          '<p class="lead">' + esc(order.name) + ', позвоним на ' + esc(order.phone) + ' в течение рабочего дня и уточним детали.</p>' +
          '<ul class="success__list">' + items + '</ul>' +
          '<div class="success__rows">' +
            '<div class="calc__row"><span>Получение</span><span>' + (order.method === 'delivery' ? 'доставка · ' + esc(order.address) : 'самовывоз · ' + esc(SHOP.address)) + '</span></div>' +
            '<div class="calc__row"><span>Дата</span><span>' + esc(dateRu(order.date)) + '</span></div>' +
            '<div class="calc__row"><span>Доставка</span><span>' + (order.delivery ? money(order.delivery) : 'бесплатно') + '</span></div>' +
            '<div class="calc__row calc__row--total"><span>Итого</span><span>' + money(order.total) + '</span></div>' +
          '</div>' +
          '<div class="row">' +
            '<a class="btn" href="catalog.html">' + icon('cake-box', 'icon icon--sm') + 'Вернуться в каталог</a>' +
            '<a class="btn btn--ghost" href="admin.html">Посмотреть в панели владельца' + icon('arrow-right', 'icon icon--sm') + '</a>' +
          '</div>' +
          '<p class="small muted">Это демо-сайт. Заказ остался в вашем браузере (localStorage, ключ <code>igdemo_cakes_orders_v1</code>) и никуда не ушёл.</p>' +
        '</div>';
      updateCartBadges();
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validate()) {
          toast('Подсветили поля, которые надо поправить');
          var bad = $('.is-invalid', form);
          if (bad) bad.focus();
          return;
        }
        var subtotal = cartSubtotal();
        var del = deliveryFor(subtotal, method());
        var order = {
          no: nextOrderNo(),
          created: new Date().toISOString(),
          name: $('#f-name').value.trim(),
          phone: phoneInput.value.trim(),
          method: method(),
          address: method() === 'delivery' ? addrInput.value.trim() : '',
          date: $('#f-date').value,
          comment: $('#f-comment').value.trim(),
          items: cartLines().map(function (l) { return { title: l.title, qty: l.qty, price: l.price, meta: l.meta }; }),
          subtotal: subtotal,
          delivery: del,
          total: subtotal + del,
          status: 'new'
        };
        var orders = getOrders();
        orders.unshift(order);
        saveOrders(orders);
        clearCart();
        renderSuccess(order);
        toast('Заказ №' + order.no + ' записан');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    render();
  }

  /* ============================================================
     7. Панель владельца
     ============================================================ */
  function initAdmin() {
    var listBox = $('#orders');
    if (!listBox) return;

    var state = { status: 'all' };
    var counters = {
      today: $('#c-today'), revenue: $('#c-revenue'), active: $('#c-active'), avg: $('#c-avg')
    };
    var filterBox = $('#order-filters');
    var emptyBox = $('#admin-empty');
    var toolbarNote = $('#admin-note');

    function ordersToday(list) {
      var t = todayISO();
      return list.filter(function (o) { return (o.created || '').slice(0, 10) === t; });
    }

    function renderFilters() {
      if (!filterBox) return;
      var options = [{ id: 'all', label: 'Все заказы' }].concat(STATUSES.map(function (s) { return { id: s.id, label: s.label }; }));
      filterBox.innerHTML = options.map(function (o) {
        return '<button class="chip" type="button" data-status="' + esc(o.id) + '" aria-pressed="' + (state.status === o.id ? 'true' : 'false') + '">' + esc(o.label) + '</button>';
      }).join('');
    }

    function orderHTML(o) {
      var st = statusInfo(o.status);
      var items = (o.items || []).map(function (i) {
        return '<li><span>' + esc(i.title) + ' × ' + i.qty + '</span><span>' + money(i.price * i.qty) + '</span></li>';
      }).join('');
      var buttons = STATUSES.map(function (s) {
        return '<button class="btn btn--sm ' + (o.status === s.id ? '' : 'btn--ghost') + '" type="button" data-set="' + esc(o.no) + '" data-status="' + s.id + '"' +
          (o.status === s.id ? ' aria-current="true"' : '') + '>' + esc(s.label) + '</button>';
      }).join('');
      return '' +
        '<article class="order" data-no="' + esc(o.no) + '">' +
          '<header class="order__head">' +
            '<div>' +
              '<h3 class="order__no">Заказ №' + esc(o.no) + '</h3>' +
              '<p class="small muted">' + esc(dateTimeRu(o.created)) + '</p>' +
            '</div>' +
            '<span class="status status--' + esc(o.status) + '">' + esc(st.label) + '</span>' +
          '</header>' +
          '<div class="order__grid">' +
            '<div class="order__block">' +
              '<h4>Клиент</h4>' +
              '<p>' + icon('user', 'icon icon--sm') + esc(o.name) + '</p>' +
              '<p>' + icon('phone', 'icon icon--sm') + '<a href="' + esc(SHOP.phoneHref) + '">' + esc(o.phone) + '</a></p>' +
            '</div>' +
            '<div class="order__block">' +
              '<h4>Получение</h4>' +
              '<p>' + icon(o.method === 'delivery' ? 'truck' : 'map-pin', 'icon icon--sm') + (o.method === 'delivery' ? 'доставка' : 'самовывоз') + '</p>' +
              (o.address ? '<p class="small muted">' + esc(o.address) + '</p>' : '<p class="small muted">' + esc(SHOP.address) + '</p>') +
            '</div>' +
            '<div class="order__block">' +
              '<h4>Готовность</h4>' +
              '<p>' + icon('calendar', 'icon icon--sm') + esc(dateRu(o.date)) + '</p>' +
              (o.comment ? '<p class="small muted">«' + esc(o.comment) + '»</p>' : '') +
            '</div>' +
          '</div>' +
          '<ul class="order__items">' + items + '</ul>' +
          '<div class="order__foot">' +
            '<div class="order__total">' +
              '<span class="small muted">Доставка: ' + (o.delivery ? money(o.delivery) : '0 BYN') + '</span>' +
              '<span class="price">' + money(o.total) + '</span>' +
            '</div>' +
            '<div class="order__actions" role="group" aria-label="Статус заказа №' + esc(o.no) + '">' + buttons + '</div>' +
          '</div>' +
        '</article>';
    }

    function render() {
      var all = getOrders();
      var list = state.status === 'all' ? all : all.filter(function (o) { return o.status === state.status; });

      var today = ordersToday(all);
      var sum = all.reduce(function (n, o) { return n + (o.total || 0); }, 0);
      var active = all.filter(function (o) { return o.status === 'new' || o.status === 'accepted'; }).length;
      if (counters.today) counters.today.textContent = String(today.length);
      if (counters.revenue) counters.revenue.textContent = money(sum);
      if (counters.active) counters.active.textContent = String(active);
      if (counters.avg) counters.avg.textContent = all.length ? money(sum / all.length) : '0 BYN';

      if (toolbarNote) {
        toolbarNote.textContent = all.length
          ? 'Всего заказов: ' + all.length + ', сейчас видно ' + list.length
          : 'Пока ни одного заказа';
      }

      listBox.innerHTML = list.map(orderHTML).join('');
      if (emptyBox) emptyBox.hidden = list.length !== 0;
      listBox.hidden = list.length === 0;

      var csvBtn = $('#export-csv');
      if (csvBtn) csvBtn.disabled = all.length === 0;
      var clearBtn = $('#clear-orders');
      if (clearBtn) clearBtn.disabled = all.length === 0;
      renderFilters();
    }

    listBox.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-set]') : null;
      if (!btn) return;
      var no = btn.getAttribute('data-set');
      var status = btn.getAttribute('data-status');
      var orders = getOrders().map(function (o) {
        if (o.no === no) o.status = status;
        return o;
      });
      saveOrders(orders);
      render();
      toast('Заказ №' + no + ' теперь «' + statusInfo(status).label + '»');
    });

    if (filterBox) {
      filterBox.addEventListener('click', function (e) {
        var chip = e.target.closest ? e.target.closest('[data-status]') : null;
        if (!chip) return;
        state.status = chip.getAttribute('data-status');
        render();
      });
    }

    /* CSV: Blob + createObjectURL, разделитель «;» и BOM — чтобы Excel открыл русский текст */
    var csvBtn = $('#export-csv');
    if (csvBtn) {
      csvBtn.addEventListener('click', function () {
        var orders = getOrders();
        if (!orders.length) return;
        var head = ['Номер', 'Создан', 'Клиент', 'Телефон', 'Получение', 'Адрес', 'Дата готовности', 'Состав', 'Доставка', 'Итого', 'Статус'];
        function cell(v) { return '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"'; }
        var rows = [head.map(cell).join(';')];
        orders.forEach(function (o) {
          rows.push([
            '№' + o.no,
            dateTimeRu(o.created),
            o.name,
            o.phone,
            o.method === 'delivery' ? 'доставка' : 'самовывоз',
            o.address || '',
            dateRu(o.date),
            (o.items || []).map(function (i) { return i.title + ' × ' + i.qty; }).join(' | '),
            o.delivery || 0,
            o.total || 0,
            statusInfo(o.status).label
          ].map(cell).join(';'));
        });
        var blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'melnitsa-orders-' + todayISO() + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        toast('Файл CSV готов, внутри ' + orders.length + ' ' + plural(orders.length, 'заказ', 'заказа', 'заказов'));
      });
    }

    /* тестовый заказ — чтобы показать панель без покупки (честно помечен как тест) */
    var demoBtn = $('#demo-order');
    var demoEmptyBtn = $('#demo-empty-btn');
    if (demoEmptyBtn && demoBtn) {
      demoEmptyBtn.addEventListener('click', function () { demoBtn.click(); });
    }
    if (demoBtn) {
      demoBtn.addEventListener('click', function () {
        var p = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
        var no = String(Date.now() % 10000).padStart(4, '0');
        var order = {
          no: no,
          created: new Date().toISOString(),
          name: 'Тестовый заказ',
          phone: SHOP.phone,
          method: 'pickup',
          address: '',
          date: addDays(todayISO(), 2),
          comment: 'Нажали кнопку в панели — это образец, а не настоящий заказ',
          items: [{ title: p.name, qty: 1, price: p.price, meta: p.format }],
          subtotal: p.price,
          delivery: 0,
          total: p.price,
          status: 'new'
        };
        var orders = getOrders();
        orders.unshift(order);
        saveOrders(orders);
        render();
        toast('Добавили образец заказа №' + no);
      });
    }

    /* очистка — в два шага, без системных окон */
    var clearBtn = $('#clear-orders');
    if (clearBtn) {
      var armed = false, armTimer = null;
      clearBtn.addEventListener('click', function () {
        if (!armed) {
          armed = true;
          clearBtn.textContent = 'Точно стираем?';
          clearBtn.classList.add('btn--danger');
          armTimer = setTimeout(function () {
            armed = false;
            clearBtn.textContent = 'Очистить список';
            clearBtn.classList.remove('btn--danger');
          }, 4000);
          return;
        }
        clearTimeout(armTimer);
        armed = false;
        clearBtn.textContent = 'Очистить список';
        clearBtn.classList.remove('btn--danger');
        saveOrders([]);
        render();
        toast('Список пустой');
      });
    }

    render();
    window.addEventListener('storage', function (e) {
      if (e.key === ORDERS_KEY) render();
    });
  }

  /* ============================================================
     8. Запуск
     ============================================================ */
  function boot() {
    updateCartBadges();
    initDrawer();
    initReveal();
    initYear();
    initPopular();
    initCalculator();
    initCatalog();
    initCartPage();
    initAdmin();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* наружу — только то, что нужно для отладки */
  window.Melnitsa = {
    money: money, cartCount: cartCount, cartSubtotal: cartSubtotal,
    getOrders: getOrders, products: PRODUCTS
  };
})();
