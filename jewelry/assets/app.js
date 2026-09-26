/* app.js — «Латунь», украшения ручной работы (Минск).
   Вся логика демо: каталог с фильтрами, карточка с выбором материала и гравировкой,
   корзина, оформление заказа и панель владельца. Без библиотек и внешних запросов.
   Данные — из assets/data.js, состояние — localStorage
   (корзина: igdemo_jewelry_cart_v1, заказы: igdemo_jewelry_orders_v1). */

(function () {
  'use strict';

  /* ============================ 1. Иконки (inline SVG, Lucide-стиль) ============================ */

  var SVG = 'class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  var ICONS = {
    bag: '<svg ' + SVG + '><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    truck: '<svg ' + SVG + '><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>',
    clock: '<svg ' + SVG + '><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    shield: '<svg ' + SVG + '><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
    gift: '<svg ' + SVG + '><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C9.8 3 11 5.2 12 8c1-2.8 2.2-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>',
    search: '<svg ' + SVG + '><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    filter: '<svg ' + SVG + '><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>',
    plus: '<svg ' + SVG + '><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
    minus: '<svg ' + SVG + '><path d="M5 12h14"/></svg>',
    trash: '<svg ' + SVG + '><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
    check: '<svg ' + SVG + '><path d="M20 6 9 17l-5-5"/></svg>',
    chevron: '<svg ' + SVG + '><path d="m9 18 6-6-6-6"/></svg>',
    ruler: '<svg ' + SVG + '><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>',
    scissors: '<svg ' + SVG + '><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 8.12"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/><path d="M8.12 15.88 12 12"/></svg>',
    sparkles: '<svg ' + SVG + '><path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg>',
    pin: '<svg ' + SVG + '><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    phone: '<svg ' + SVG + '><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.94.36 1.86.7 2.74a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.34-1.27a2 2 0 0 1 2.11-.45c.88.34 1.8.57 2.74.7A2 2 0 0 1 22 16.92z"/></svg>',
    mail: '<svg ' + SVG + '><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
    insta: '<svg ' + SVG + '><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><path d="M17.5 6.5h.01"/></svg>',
    calendar: '<svg ' + SVG + '><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></svg>',
    x: '<svg ' + SVG + '><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    menu: '<svg ' + SVG + '><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>',
    package: '<svg ' + SVG + '><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
    star: '<svg ' + SVG + '><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01z"/></svg>',
    heart: '<svg ' + SVG + '><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    palette: '<svg ' + SVG + '><circle cx="13.5" cy="6.5" r=".6"/><circle cx="17.5" cy="10.5" r=".6"/><circle cx="8.5" cy="7.5" r=".6"/><circle cx="6.5" cy="12.5" r=".6"/><path d="M12 2a10 10 0 0 0 0 20c.93 0 1.65-.75 1.65-1.69a1.6 1.6 0 0 0-.44-1.12 1.6 1.6 0 0 1 1.24-2.79h2A5.55 5.55 0 0 0 22 10.85C21.97 6.01 17.46 2 12 2z"/></svg>',
    arrow: '<svg ' + SVG + '><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
    card: '<svg ' + SVG + '><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    settings: '<svg ' + SVG + '><circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M4.2 4.2l2.1 2.1"/><path d="M17.7 17.7l2.1 2.1"/><path d="M2 12h3"/><path d="M19 12h3"/><path d="M4.2 19.8l2.1-2.1"/><path d="M17.7 6.3l2.1-2.1"/></svg>'
  };
  function icon(name, cls) {
    var s = ICONS[name] || ICONS.sparkles;
    if (cls) s = s.replace('class="icon"', 'class="' + cls + '"');
    return s;
  }

  /* ============================ 2. Утилиты ============================ */

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  function money(n) { return Math.round(n) + ' BYN'; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(ts) {
    var d = new Date(ts);
    return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear();
  }
  function fmtDateTime(ts) {
    var d = new Date(ts);
    return fmtDate(ts) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  /* ============================ 3. Хранилище ============================ */

  var CART_KEY = 'igdemo_jewelry_cart_v1';
  var ORDER_KEY = 'igdemo_jewelry_orders_v1';

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var val = JSON.parse(raw);
      return val == null ? fallback : val;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }
  function getCart() { var c = readJSON(CART_KEY, []); return Array.isArray(c) ? c : []; }
  function setCart(cart) { writeJSON(CART_KEY, cart); paintBadges(); }
  function getOrders() { var o = readJSON(ORDER_KEY, []); return Array.isArray(o) ? o : []; }
  function setOrders(list) { writeJSON(ORDER_KEY, list); }
  function cartCount() { return getCart().reduce(function (s, i) { return s + (i.qty || 1); }, 0); }

  function findProduct(id) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i];
    return null;
  }
  function materialInfo(id) { return MATERIALS[id] || { id: id, name: String(id), note: '' }; }
  function priceOf(p, matId) {
    var list = p.materials || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === matId) return list[i].price;
    return list.length ? list[0].price : 0;
  }
  function basePrice(p) {
    var list = p.materials || [];
    var min = Infinity;
    for (var i = 0; i < list.length; i++) min = Math.min(min, list[i].price);
    return min === Infinity ? 0 : min;
  }
  function itemPrice(it) {
    var p = findProduct(it.id);
    var base = p ? priceOf(p, it.material) : (it.price || 0);
    return base + (it.engraving ? SHOP.engravingPrice : 0);
  }

  /* Выбранный материал — общий для витрины и каталога, в памяти страницы */
  var sel = {};
  function selectedMaterial(p) {
    return sel[p.id] || (p.materials && p.materials[0] ? p.materials[0].id : 'brass');
  }

  /* ============================ 4. Доставка и статусы ============================ */

  var DELIVERY = {
    pickup:  { id: 'pickup',  name: 'Самовывоз из мастерской', cost: 0, note: SHOP.address },
    minsk:   { id: 'minsk',   name: 'Курьер по Минску',        cost: SHOP.deliveryMinsk,   note: '1–2 дня после готовности, курьер позвонит' },
    belarus: { id: 'belarus', name: 'Почта по Беларуси',       cost: SHOP.deliveryBelarus, note: 'Европочта, 2–3 дня после готовности' }
  };
  function deliveryCost(methodId, subtotal) {
    var d = DELIVERY[methodId] || DELIVERY.pickup;
    return subtotal >= SHOP.freeDeliveryFrom ? 0 : d.cost;
  }
  var STATUSES = {
    new: 'Новый',
    accepted: 'Принят',
    done: 'Выполнен',
    cancelled: 'Отменён'
  };
  var STATUS_ORDER = ['new', 'accepted', 'done', 'cancelled'];

  /* ============================ 5. Toast и бейдж корзины ============================ */

  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 2800);
  }

  function paintBadges() {
    var n = cartCount();
    $$('[data-cart-count]').forEach(function (el) {
      el.textContent = String(n);
      el.hidden = n === 0;
    });
  }

  /* ============================ 6. Шапка: мобильное меню + reveal ============================ */

  function initChrome() {
    var burger = $('[data-burger]');
    var panel = $('[data-nav-panel]');
    if (burger && panel) {
      burger.addEventListener('click', function () {
        var open = panel.classList.toggle('is-open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        burger.innerHTML = open ? icon('x', 'icon icon--lg') : icon('menu', 'icon icon--lg');
      });
      $$('a', panel).forEach(function (a) {
        a.addEventListener('click', function () {
          panel.classList.remove('is-open');
          burger.setAttribute('aria-expanded', 'false');
          burger.innerHTML = icon('menu', 'icon icon--lg');
        });
      });
    }
    var yearEls = $$('[data-year]');
    yearEls.forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

    var targets = $$('.reveal');
    if (!targets.length) return;
    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (t) { t.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    targets.forEach(function (t) { io.observe(t); });
  }

  /* ============================ 7. Карточка товара ============================ */

  function badgeFor(p) {
    if (!p.tags || !p.tags.length) return '';
    var t = TAGS[p.tags[0]];
    if (!t) return '';
    return '<span class="badge card__badge">' + esc(t.label) + '</span>';
  }

  function productCard(p) {
    var mat = selectedMaterial(p);
    var price = priceOf(p, mat) + SHOP.engravingPrice;
    var opts = (p.materials || []).map(function (m) {
      var on = m.id === mat;
      return '<button type="button" class="mat-opt" data-mat="' + esc(m.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        esc(materialInfo(m.id).name) + ' <small>' + money(m.price) + '</small></button>';
    }).join('');
    var inputId = 'eng-' + p.id;
    return '' +
      '<article class="card card--product" data-id="' + esc(p.id) + '">' +
        '<div class="card__media">' +
          '<img src="' + esc(p.img) + '" alt="' + esc(p.alt) + '" width="900" height="675" loading="lazy" decoding="async">' +
          badgeFor(p) +
        '</div>' +
        '<div class="card__body">' +
          '<span class="tiny muted">' + esc(p.cat) + (p.stone ? ' · натуральный камень' : '') + '</span>' +
          '<h3 class="prod-title">' + esc(p.title) + '</h3>' +
          '<p class="prod-desc">' + esc(p.desc) + '</p>' +
          '<p class="prod-size">' + icon('ruler') + '<span>' + esc(p.size) + '</span></p>' +
          '<div class="mat-pick" role="group" aria-label="Материал: ' + esc(p.title) + '">' + opts + '</div>' +
          '<div class="engrave">' +
            '<label class="engrave__toggle"><input type="checkbox" data-eng-check> Гравировка ' +
              '<span class="engrave__price">+' + SHOP.engravingPrice + ' BYN</span></label>' +
            '<div class="engrave__body">' +
              '<label class="sr-only" for="' + inputId + '">Текст гравировки, ' + esc(p.title) + '</label>' +
              '<input class="input" type="text" id="' + inputId + '" data-eng-input maxlength="' + SHOP.engravingMax + '" ' +
                'placeholder="Например: А&amp;К 12.09.26" autocomplete="off">' +
              '<p class="hint">До ' + SHOP.engravingMax + ' знаков · <span data-eng-count>0</span>/' + SHOP.engravingMax + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="card__foot">' +
            '<div>' +
              '<div class="price price-lg" data-price>' + money(priceOf(p, mat)) + '</div>' +
              '<div class="price-note">изготовление ' + SHOP.leadTime + '</div>' +
            '</div>' +
            '<button class="btn btn--sm" type="button" data-add>' + icon('bag') + 'В корзину</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function paintCard(card, p) {
    var mat = selectedMaterial(p);
    $$('[data-mat]', card).forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-mat') === mat ? 'true' : 'false');
    });
    var check = $('[data-eng-check]', card);
    var eng = !!(check && check.checked);
    var priceEl = $('[data-price]', card);
    if (priceEl) priceEl.textContent = money(priceOf(p, mat) + (eng ? SHOP.engravingPrice : 0));
    var engBox = $('.engrave', card);
    if (engBox) engBox.classList.toggle('is-open', eng);
  }

  function sanitizeEngraving(s) {
    return String(s || '')
      .replace(/[^0-9A-Za-zА-Яа-яЁё .,\-&'\/]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, SHOP.engravingMax);
  }

  function addToCart(p, matId, engraving) {
    var key = [p.id, matId, engraving || ''].join('|');
    var cart = getCart();
    var found = null;
    for (var i = 0; i < cart.length; i++) if (cart[i].key === key) found = cart[i];
    if (found) { found.qty = (found.qty || 1) + 1; }
    else {
      cart.push({
        key: key,
        id: p.id,
        material: matId,
        engraving: engraving || '',
        qty: 1,
        price: priceOf(p, matId)
      });
    }
    setCart(cart);
    var parts = [p.title, materialInfo(matId).name];
    if (engraving) parts.push('гравировка «' + engraving + '»');
    toast(parts.join(' · ') + ' — в корзине');
  }

  function addFromCard(card, p) {
    var check = $('[data-eng-check]', card);
    var input = $('[data-eng-input]', card);
    var engraving = '';
    if (check && check.checked) {
      engraving = sanitizeEngraving(input ? input.value : '');
      if (!engraving) {
        toast('Впишите текст гравировки или снимите галочку');
        if (input) input.focus();
        return;
      }
      if (input) input.value = engraving;
    }
    addToCart(p, selectedMaterial(p), engraving);
  }

  function bindGrid(container) {
    if (!container || container.dataset.bound === '1') return;
    container.dataset.bound = '1';
    container.addEventListener('click', function (e) {
      var card = e.target.closest('.card--product');
      if (!card) return;
      var p = findProduct(card.dataset.id);
      if (!p) return;
      var matBtn = e.target.closest('[data-mat]');
      if (matBtn) { sel[p.id] = matBtn.getAttribute('data-mat'); paintCard(card, p); return; }
      if (e.target.closest('[data-add]')) { addFromCard(card, p); }
    });
    function onField(e) {
      var card = e.target.closest('.card--product');
      if (!card) return;
      var p = findProduct(card.dataset.id);
      if (!p) return;
      if (e.target.matches('[data-eng-check]')) { paintCard(card, p); }
      if (e.target.matches('[data-eng-input]')) {
        var c = $('[data-eng-count]', card);
        if (c) c.textContent = String(e.target.value.length);
      }
    }
    container.addEventListener('input', onField);
    container.addEventListener('change', onField);
  }

  function cardsHTML(list) {
    return list.map(productCard).join('');
  }

  /* ============================ 8. Главная ============================ */

  function initHome() {
    var grid = $('[data-featured]');
    if (grid) {
      var top = PRODUCTS.slice().sort(function (a, b) { return b.popular - a.popular; }).slice(0, 3);
      grid.innerHTML = cardsHTML(top);
      bindGrid(grid);
    }
    var promises = $('[data-promises]');
    if (promises) {
      promises.innerHTML = PROMISES.map(function (f) {
        return '<div class="feature">' +
          '<div class="feature__icon">' + icon(f.icon, 'icon icon--lg') + '</div>' +
          '<div><h3>' + esc(f.title) + '</h3><p>' + esc(f.text) + '</p></div></div>';
      }).join('');
    }
    var steps = $('[data-steps]');
    if (steps) {
      steps.innerHTML = STEPS.map(function (s, i) {
        return '<div class="step">' +
          '<div class="step__num">' + pad2(i + 1) + '</div>' +
          '<h3>' + icon(s.icon) + ' ' + esc(s.title) + '</h3>' +
          '<p>' + esc(s.text) + '</p></div>';
      }).join('');
    }
    var faq = $('[data-faq]');
    if (faq) {
      faq.innerHTML = FAQ.map(function (f) {
        return '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>';
      }).join('');
    }
    var cats = $('[data-cats]');
    if (cats) {
      var counts = {};
      PRODUCTS.forEach(function (p) { counts[p.cat] = (counts[p.cat] || 0) + 1; });
      var icons = { 'Серьги': 'sparkles', 'Кольца': 'star', 'Колье': 'heart', 'Подвески': 'pin', 'Браслеты': 'package', 'Броши': 'palette' };
      cats.innerHTML = CATEGORIES.map(function (c) {
        var n = counts[c] || 0;
        return '<a class="cat-tile" href="catalog.html?cat=' + encodeURIComponent(c) + '">' +
          '<span class="cat-tile__icon">' + icon(icons[c] || 'sparkles', 'icon icon--lg') + '</span>' +
          '<span class="cat-tile__name">' + esc(c) + '</span>' +
          '<span class="cat-tile__meta">' + n + ' ' + plural(n, 'модель', 'модели', 'моделей') + '</span></a>';
      }).join('');
    }
  }

  /* ============================ 9. Каталог ============================ */

  var cstate = { cat: 'all', price: 'all', tags: [], stone: false, q: '', sort: 'popular' };

  function filterList() {
    var q = cstate.q.trim().toLowerCase();
    var list = PRODUCTS.filter(function (p) {
      if (cstate.cat !== 'all' && p.cat !== cstate.cat) return false;
      if (cstate.stone && !p.stone) return false;
      if (cstate.tags.length) {
        var ok = cstate.tags.every(function (t) { return (p.tags || []).indexOf(t) !== -1; });
        if (!ok) return false;
      }
      var price = priceOf(p, selectedMaterial(p));
      if (cstate.price === 'low' && price > 80) return false;
      if (cstate.price === 'mid' && (price <= 80 || price > 150)) return false;
      if (cstate.price === 'high' && price <= 150) return false;
      if (q) {
        var hay = (p.title + ' ' + p.cat + ' ' + p.desc + ' ' + p.size + ' ' + (p.kw || '') + ' ' +
          (p.stone ? 'натуральный камень ' : '') +
          (p.materials || []).map(function (m) { return materialInfo(m.id).name; }).join(' ')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    if (cstate.sort === 'cheap') {
      list.sort(function (a, b) { return priceOf(a, selectedMaterial(a)) - priceOf(b, selectedMaterial(b)); });
    } else if (cstate.sort === 'expensive') {
      list.sort(function (a, b) { return priceOf(b, selectedMaterial(b)) - priceOf(a, selectedMaterial(a)); });
    } else {
      list.sort(function (a, b) { return b.popular - a.popular; });
    }
    return list;
  }

  function emptyCatalogHTML() {
    return '<div class="empty">' +
      '<p><strong>Ничего не найдено</strong></p>' +
      '<p class="small">Сбросьте фильтры или поищите иначе — в мастерской есть и то, чего нет в витрине.</p>' +
      '<p style="margin-top:1rem"><button class="btn btn--ghost btn--sm" type="button" data-reset-filters>' +
      icon('x') + 'Сбросить фильтры</button></p></div>';
  }

  function renderCatalog() {
    var grid = $('[data-catalog]');
    if (!grid) return;
    var list = filterList();
    var countEl = $('[data-result-count]');
    if (countEl) {
      countEl.textContent = list.length
        ? list.length + ' ' + plural(list.length, 'модель', 'модели', 'моделей') + ' в витрине'
        : 'Ничего не нашлось';
    }
    grid.innerHTML = list.length ? cardsHTML(list) : emptyCatalogHTML();
    bindGrid(grid);
    $$('[data-cat-chip]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-cat-chip') === cstate.cat ? 'true' : 'false');
    });
    $$('[data-price-chip]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-price-chip') === cstate.price ? 'true' : 'false');
    });
    $$('[data-tag-chip]').forEach(function (b) {
      var t = b.getAttribute('data-tag-chip');
      b.setAttribute('aria-pressed', cstate.tags.indexOf(t) !== -1 ? 'true' : 'false');
    });
    var stoneChip = $('[data-stone-chip]');
    if (stoneChip) stoneChip.setAttribute('aria-pressed', cstate.stone ? 'true' : 'false');
  }

  function initCatalog() {
    var grid = $('[data-catalog]');
    if (!grid) return;

    var params = new URLSearchParams(window.location.search);
    var catParam = params.get('cat');
    if (catParam && CATEGORIES.indexOf(catParam) !== -1) cstate.cat = catParam;

    $$('[data-cat-chip]').forEach(function (b) {
      b.addEventListener('click', function () { cstate.cat = b.getAttribute('data-cat-chip'); renderCatalog(); });
    });
    $$('[data-price-chip]').forEach(function (b) {
      b.addEventListener('click', function () { cstate.price = b.getAttribute('data-price-chip'); renderCatalog(); });
    });
    $$('[data-tag-chip]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-tag-chip');
        var i = cstate.tags.indexOf(t);
        if (i === -1) cstate.tags.push(t); else cstate.tags.splice(i, 1);
        renderCatalog();
      });
    });
    var stoneChip = $('[data-stone-chip]');
    if (stoneChip) stoneChip.addEventListener('click', function () { cstate.stone = !cstate.stone; renderCatalog(); });

    var search = $('[data-search]');
    if (search) {
      search.addEventListener('input', function () { cstate.q = search.value; renderCatalog(); });
      search.addEventListener('keydown', function (e) { if (e.key === 'Escape') { search.value = ''; cstate.q = ''; renderCatalog(); } });
    }
    var sort = $('[data-sort]');
    if (sort) sort.addEventListener('change', function () { cstate.sort = sort.value; renderCatalog(); });

    grid.addEventListener('click', function (e) {
      if (e.target.closest('[data-reset-filters]')) {
        cstate.cat = 'all'; cstate.price = 'all'; cstate.tags = []; cstate.stone = false; cstate.q = '';
        if (search) search.value = '';
        renderCatalog();
        toast('Фильтры сброшены');
      }
    });

    renderCatalog();
  }

  /* ============================ 10. Корзина и оформление ============================ */

  function cartLineHTML(it, i) {
    var p = findProduct(it.id);
    var title = p ? p.title : it.id;
    var img = p ? p.img : (PRODUCTS[0] ? PRODUCTS[0].img : '');
    var alt = p ? p.alt : '';
    var price = itemPrice(it);
    return '' +
      '<div class="cart-line" data-i="' + i + '">' +
        '<div class="cart-line__img"><img src="' + esc(img) + '" alt="' + esc(alt) + '" width="92" height="69" loading="lazy"></div>' +
        '<div>' +
          '<div class="cart-line__title">' + esc(title) + '</div>' +
          '<div class="cart-line__meta">Материал: ' + esc(materialInfo(it.material).name) +
            (p ? ' · ' + esc(p.size) : '') + '</div>' +
          (it.engraving ? '<div class="cart-line__engrave">Гравировка: «' + esc(it.engraving) + '» (+' + SHOP.engravingPrice + ' BYN)</div>' : '') +
          '<div class="cart-line__meta">' + money(price) + ' / шт.</div>' +
          '<div class="row" style="margin-top:.6rem">' +
            '<span class="qty">' +
              '<button class="qty__btn" type="button" data-qty="-1" aria-label="Убрать одну штуку">' + icon('minus') + '</button>' +
              '<span class="qty__num">' + (it.qty || 1) + '</span>' +
              '<button class="qty__btn" type="button" data-qty="1" aria-label="Добавить одну штуку">' + icon('plus') + '</button>' +
            '</span>' +
            '<button class="btn btn--ghost btn--sm" type="button" data-remove>' + icon('trash') + 'Удалить</button>' +
          '</div>' +
        '</div>' +
        '<div class="cart-line__right"><span class="price">' + money(price * (it.qty || 1)) + '</span></div>' +
      '</div>';
  }

  function initCart() {
    var listEl = $('[data-cart-list]');
    if (!listEl) return;

    var form = $('[data-order-form]');
    var successBox = $('[data-success]');
    var cartWrap = $('[data-cart-wrap]');
    var dateInput = form ? $('[name="date"]', form) : null;
    if (dateInput) dateInput.min = todayISO();

    function currentMethod() {
      if (!form) return 'pickup';
      var checked = $('input[name="delivery"]:checked', form);
      return checked ? checked.value : 'pickup';
    }

    function paintSummary() {
      var cart = getCart();
      var subtotal = cart.reduce(function (s, it) { return s + itemPrice(it) * (it.qty || 1); }, 0);
      var method = currentMethod();
      var cost = cart.length ? deliveryCost(method, subtotal) : 0;
      var total = subtotal + cost;
      var subEl = $('[data-sum-subtotal]');
      var delEl = $('[data-sum-delivery]');
      var totEl = $('[data-sum-total]');
      var cntEl = $('[data-sum-count]');
      if (subEl) subEl.textContent = money(subtotal);
      if (delEl) delEl.textContent = cart.length ? (cost === 0 ? 'бесплатно' : money(cost)) : '—';
      if (totEl) totEl.textContent = money(total);
      if (cntEl) cntEl.textContent = cart.length + ' ' + plural(cart.length, 'позиция', 'позиции', 'позиций');
      var bar = $('[data-progress]');
      var note = $('[data-progress-note]');
      var left = Math.max(0, SHOP.freeDeliveryFrom - subtotal);
      if (bar) bar.style.width = Math.min(100, Math.round(subtotal / SHOP.freeDeliveryFrom * 100)) + '%';
      if (note) {
        note.textContent = cart.length === 0
          ? 'Бесплатная доставка от ' + SHOP.freeDeliveryFrom + ' BYN'
          : (left > 0
            ? 'До бесплатной доставки ещё ' + money(left)
            : 'Доставка бесплатная — упаковка в подарок уже включена');
      }
      // адрес нужен только для доставки
      var addrWrap = $('[data-address-wrap]');
      if (addrWrap) addrWrap.hidden = method === 'pickup';
      var methodNote = $('[data-method-note]');
      if (methodNote) methodNote.textContent = (DELIVERY[method] || DELIVERY.pickup).note;
    }

    function renderCart() {
      var cart = getCart();
      var emptyEl = $('[data-cart-empty]');
      var hasItems = cart.length > 0;
      if (emptyEl) emptyEl.hidden = hasItems;
      listEl.hidden = !hasItems;
      if (cartWrap) cartWrap.hidden = !hasItems;
      listEl.innerHTML = cart.map(cartLineHTML).join('');
      paintSummary();
    }

    listEl.addEventListener('click', function (e) {
      var line = e.target.closest('.cart-line');
      if (!line) return;
      var i = parseInt(line.getAttribute('data-i'), 10);
      var cart = getCart();
      if (!cart[i]) return;
      if (e.target.closest('[data-remove]')) {
        cart.splice(i, 1);
        setCart(cart);
        renderCart();
        toast('Позиция удалена');
        return;
      }
      var qBtn = e.target.closest('[data-qty]');
      if (qBtn) {
        var next = (cart[i].qty || 1) + parseInt(qBtn.getAttribute('data-qty'), 10);
        if (next <= 0) { cart.splice(i, 1); toast('Позиция удалена'); }
        else cart[i].qty = next;
        setCart(cart);
        renderCart();
      }
    });

    if (form) {
      $$('input[name="delivery"]', form).forEach(function (r) {
        r.addEventListener('change', paintSummary);
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var cart = getCart();
        if (!cart.length) { toast('Корзина пуста'); return; }
        var errs = [];
        var name = ($('[name="name"]', form).value || '').trim();
        var phoneRaw = ($('[name="phone"]', form).value || '').trim();
        var digits = phoneRaw.replace(/\D/g, '');
        var method = currentMethod();
        var address = ($('[name="address"]', form) ? $('[name="address"]', form).value : '').trim();
        var date = dateInput ? dateInput.value : '';
        var comment = ($('[name="comment"]', form) ? $('[name="comment"]', form).value : '').trim();

        if (name.length < 2) errs.push(['name', 'Напишите, как к вам обращаться']);
        if (!(digits.length === 12 && digits.indexOf('375') === 0)) errs.push(['phone', 'Телефон в формате +375 (29) 123-45-67']);
        if (method !== 'pickup' && address.length < 5) errs.push(['address', 'Куда доставлять: улица, дом, квартира']);

        $$('.error', form).forEach(function (el) { el.textContent = ''; });
        if (errs.length) {
          errs.forEach(function (pair) {
            var box = $('[data-error="' + pair[0] + '"]', form);
            if (box) box.textContent = pair[1];
            var fld = $('[name="' + pair[0] + '"]', form);
            if (fld && pair === errs[0]) fld.focus();
          });
          toast('Проверьте выделенные поля');
          return;
        }

        var subtotal = cart.reduce(function (s, it) { return s + itemPrice(it) * (it.qty || 1); }, 0);
        var cost = deliveryCost(method, subtotal);
        var items = cart.map(function (it) {
          var p = findProduct(it.id);
          return {
            id: it.id,
            title: p ? p.title : it.id,
            material: it.material,
            materialName: materialInfo(it.material).name,
            engraving: it.engraving || '',
            price: itemPrice(it),
            qty: it.qty || 1
          };
        });
        var now = Date.now();
        var order = {
          no: String(now).slice(-4),
          createdAt: now,
          status: 'new',
          items: items,
          subtotal: subtotal,
          deliveryCost: cost,
          total: subtotal + cost,
          customer: { name: name, phone: phoneRaw },
          delivery: { method: method, address: method === 'pickup' ? '' : address, date: date, comment: comment }
        };
        setOrders([order].concat(getOrders()));
        setCart([]);
        renderCart();

        var box = successBox;
        if (box) {
          box.hidden = false;
          var noEl = $('[data-order-no]', box);
          if (noEl) noEl.textContent = '№' + order.no;
          var sumEl = $('[data-order-sum]', box);
          if (sumEl) sumEl.textContent = money(order.total);
          var listSum = $('[data-order-list]', box);
          if (listSum) {
            listSum.innerHTML = items.map(function (it) {
              return '<li class="small">' + esc(it.title) + ' · ' + esc(it.materialName) +
                (it.engraving ? ' · гравировка «' + esc(it.engraving) + '»' : '') + ' × ' + it.qty + ' — ' + money(it.price * it.qty) + '</li>';
            }).join('');
          }
          var dEl = $('[data-order-delivery]', box);
          if (dEl) dEl.textContent = DELIVERY[method].name + (cost ? ' (' + money(cost) + ')' : ' (бесплатно)') +
            (date ? ', на ' + date.split('-').reverse().join('.') : '');
          form.hidden = true;
          box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        toast('Заказ №' + order.no + ' принят — увидим его в панели');
      });
    }

    var adminLink = $('[data-admin-link]');
    if (adminLink) { /* ссылка статична, ничего не делаем */ }

    renderCart();
  }

  /* ============================ 11. Панель владельца ============================ */

  var astate = { status: 'all' };

  function orderCardHTML(o) {
    var items = (o.items || []).map(function (it) {
      return '<div class="order__item"><span>' + esc(it.title) +
        ' <small>· ' + esc(it.materialName || materialInfo(it.material).name) +
        (it.engraving ? ' · гравировка «' + esc(it.engraving) + '»' : '') + ' × ' + (it.qty || 1) + '</small></span>' +
        '<span>' + money((it.price || 0) * (it.qty || 1)) + '</span></div>';
    }).join('');
    var d = DELIVERY[o.delivery && o.delivery.method] || DELIVERY.pickup;
    var addr = o.delivery && o.delivery.address ? o.delivery.address : '';
    var comment = o.delivery && o.delivery.comment ? o.delivery.comment : '';
    var when = o.delivery && o.delivery.date ? o.delivery.date.split('-').reverse().join('.') : 'как будет готово';
    var actions = STATUS_ORDER.map(function (s) {
      var on = (o.status || 'new') === s;
      return '<button class="btn btn--ghost btn--sm" type="button" data-status="' + s + '" data-no="' + esc(o.no) + '"' +
        (on ? ' aria-pressed="true" disabled' : '') + '>' + esc(STATUSES[s]) + '</button>';
    }).join('');
    return '' +
      '<article class="order ' + (o.status === 'new' ? 'order--new ' : '') + (o.status === 'cancelled' ? 'order--cancelled' : '') + '">' +
        '<div class="order__top">' +
          '<div><span class="order__no">№' + esc(o.no) + '</span> ' +
            '<span class="order__when">' + esc(fmtDateTime(o.createdAt)) + '</span></div>' +
          '<span class="status-pill" data-status="' + esc(o.status || 'new') + '">' + esc(STATUSES[o.status] || STATUSES.new) + '</span>' +
        '</div>' +
        '<div class="order__grid">' +
          '<div><div class="order__label">Клиент</div><div class="order__val">' + esc(o.customer && o.customer.name ? o.customer.name : '—') + '</div></div>' +
          '<div><div class="order__label">Телефон</div><div class="order__val">' +
            (o.customer && o.customer.phone ? '<a href="tel:' + esc(String(o.customer.phone).replace(/[^\d+]/g, '')) + '">' + esc(o.customer.phone) + '</a>' : '—') + '</div></div>' +
          '<div><div class="order__label">Получение</div><div class="order__val">' + esc(d.name) + '</div>' +
            (addr ? '<div class="small muted">' + esc(addr) + '</div>' : '') + '</div>' +
          '<div><div class="order__label">Желаемая дата</div><div class="order__val">' + esc(when) + '</div></div>' +
        '</div>' +
        '<div class="order__items">' + items + '</div>' +
        (comment ? '<div><div class="order__label">Комментарий</div><div class="order__val">' + esc(comment) + '</div></div>' : '') +
        '<div class="order__foot">' +
          '<div><span class="order__label">Сумма</span> <span class="price price-lg">' + money(o.total || 0) + '</span>' +
            (o.deliveryCost ? ' <small class="muted">(доставка ' + money(o.deliveryCost) + ')</small>' : '') + '</div>' +
          '<div class="status-actions" role="group" aria-label="Статус заказа №' + esc(o.no) + '">' + actions + '</div>' +
        '</div>' +
      '</article>';
  }

  function initAdmin() {
    var listEl = $('[data-orders]');
    if (!listEl) return;

    function paintStats() {
      var orders = getOrders();
      var now = new Date();
      var today = orders.filter(function (o) {
        var d = new Date(o.createdAt);
        return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      var todaySum = today.reduce(function (s, o) { return s + (o.status === 'cancelled' ? 0 : (o.total || 0)); }, 0);
      var work = orders.filter(function (o) { return o.status === 'new' || o.status === 'accepted'; }).length;
      var sumAll = orders.reduce(function (s, o) { return s + (o.status === 'cancelled' ? 0 : (o.total || 0)); }, 0);
      var set = function (k, v) { var el = $('[data-stat="' + k + '"]'); if (el) el.textContent = v; };
      set('today', String(today.length));
      set('todaySum', money(todaySum));
      set('work', String(work));
      set('all', String(orders.length));
      set('allSum', money(sumAll));
    }

    function renderOrders() {
      var orders = getOrders();
      var shown = astate.status === 'all' ? orders : orders.filter(function (o) { return (o.status || 'new') === astate.status; });
      $$('[data-status-chip]').forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-status-chip') === astate.status ? 'true' : 'false');
      });
      if (!shown.length) {
        listEl.innerHTML = '<div class="empty">' +
          (orders.length
            ? '<p><strong>Заказов с таким статусом нет</strong></p><p class="small">Выберите другой фильтр.</p>'
            : '<p><strong>Заказов пока нет</strong></p>' +
              '<p class="small">Оформите тестовый заказ на сайте — он появится здесь автоматически, в этой же вкладке.</p>' +
              '<p style="margin-top:1rem"><a class="btn btn--sm" href="catalog.html">' + icon('bag') + 'Открыть каталог</a></p>') +
          '</div>';
        return;
      }
      listEl.innerHTML = shown.map(orderCardHTML).join('');
    }

    listEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-status]');
      if (!btn || btn.disabled) return;
      var no = btn.getAttribute('data-no');
      var status = btn.getAttribute('data-status');
      var orders = getOrders();
      for (var i = 0; i < orders.length; i++) {
        if (String(orders[i].no) === String(no)) { orders[i].status = status; orders[i].updatedAt = Date.now(); }
      }
      setOrders(orders);
      renderOrders();
      paintStats();
      toast('Заказ №' + no + ' — ' + STATUSES[status].toLowerCase());
    });

    $$('[data-status-chip]').forEach(function (b) {
      b.addEventListener('click', function () { astate.status = b.getAttribute('data-status-chip'); renderOrders(); });
    });

    var exp = $('[data-export]');
    if (exp) {
      exp.addEventListener('click', function () {
        var orders = getOrders();
        if (!orders.length) { toast('Пока нечего выгружать'); return; }
        function cell(v) {
          var s = String(v == null ? '' : v);
          return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }
        var head = ['Номер', 'Дата', 'Клиент', 'Телефон', 'Получение', 'Адрес', 'Желаемая дата',
                    'Состав', 'Сумма, BYN', 'Статус', 'Комментарий'];
        var rows = orders.map(function (o) {
          var d = DELIVERY[o.delivery && o.delivery.method] || DELIVERY.pickup;
          var items = (o.items || []).map(function (it) {
            return it.title + ' / ' + (it.materialName || materialInfo(it.material).name) +
              (it.engraving ? ' / гравировка: ' + it.engraving : '') + ' × ' + (it.qty || 1);
          }).join('; ');
          return [
            '№' + o.no, fmtDateTime(o.createdAt),
            o.customer && o.customer.name, o.customer && o.customer.phone,
            d.name, (o.delivery && o.delivery.address) || '',
            (o.delivery && o.delivery.date) || '',
            items, String(Math.round(o.total || 0)),
            STATUSES[o.status] || STATUSES.new,
            (o.delivery && o.delivery.comment) || ''
          ];
        });
        var csv = [head].concat(rows).map(function (r) { return r.map(cell).join(';'); }).join('\r\n');
        var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        var d2 = new Date();
        a.href = url;
        a.download = 'latun-orders-' + d2.getFullYear() + pad2(d2.getMonth() + 1) + pad2(d2.getDate()) + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        toast('Выгружено заказов: ' + orders.length);
      });
    }

    var clear = $('[data-clear-demo]');
    if (clear) {
      clear.addEventListener('click', function () {
        if (!getOrders().length) { toast('Уже пусто'); return; }
        if (!window.confirm('Удалить все заказы из этого браузера? Действие необратимо.')) return;
        setOrders([]);
        renderOrders();
        paintStats();
        toast('Заказы удалены');
      });
    }

    paintStats();
    renderOrders();
  }

  /* ============================ 12. Старт ============================ */

  function boot() {
    paintBadges();
    initChrome();
    var page = document.body.getAttribute('data-page');
    if (page === 'home') initHome();
    if (page === 'catalog') initCatalog();
    if (page === 'cart') initCart();
    if (page === 'admin') initAdmin();
    window.addEventListener('storage', function (e) {
      if (e.key === CART_KEY) paintBadges();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
