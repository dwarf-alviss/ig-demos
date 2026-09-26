/* app.js — вся логика демо-сайта «Пион».
   Работает по file:// без сборки и без сети: данные из assets/data.js, состояние в localStorage.
   Ключи: igdemo_flowers_cart_v1 (корзина), igdemo_flowers_orders_v1 (заказы для панели владельца). */

(function () {
  'use strict';

  /* ============================ константы и данные ============================ */

  var DATA = window.PION_DATA || {};
  var SHOP = DATA.shop || {};
  var PRODUCTS = DATA.products || [];
  var CATEGORIES = DATA.categories || [];
  var TAGS = DATA.tags || [];
  var SERVICES = DATA.services || [];

  var CART_KEY = 'igdemo_flowers_cart_v1';
  var ORDERS_KEY = 'igdemo_flowers_orders_v1';
  var DELIVERY_FEE = (DATA.delivery && DATA.delivery.fee) || 12;
  var FREE_FROM = (DATA.delivery && DATA.delivery.freeFrom) || 150;

  var STATUSES = [
    { id: 'new', title: 'Новый' },
    { id: 'accepted', title: 'Принят' },
    { id: 'done', title: 'Выполнен' },
    { id: 'canceled', title: 'Отменён' }
  ];

  var BUILDER_IMG = 'assets/img/hero.jpg';

  /* ============================ свой набор иконок ============================ */
  /* Тонкий контур: viewBox 24, штрих 1.2, круглые окончания, без заливки.
     Набор авторский — корзина это плетёное лукошко с дужкой, меню это две линии
     разной длины. Иконки не пересекаются с другими демо-сайтами серии. */
  var ICONS = {
    basket: '<path d="M3.6 9.4h16.8l-1.7 8.6a1.7 1.7 0 0 1-1.7 1.4H6.9a1.7 1.7 0 0 1-1.7-1.4Z"/><path d="M8.6 9.4a3.4 3.4 0 0 1 6.8 0"/><path d="M4.5 13.2h15"/><path d="M9.8 12.9v4.4"/><path d="M12 12.9v4.4"/><path d="M14.2 12.9v4.4"/>',
    menu: '<path d="M3.6 8.6h16.8"/><path d="M3.6 15.4h10"/>',
    search: '<circle cx="10.6" cy="10.6" r="6.1"/><path d="m15.2 15.2 4.4 4.4"/>',
    sort: '<path d="M3.6 6.8h9.8"/><path d="M3.6 11.8h6.6"/><path d="M3.6 16.8h3.4"/><path d="M18 4.6v13.6"/><path d="m15.4 15.6 2.6 2.7 2.6-2.7"/>',
    reset: '<path d="M4.4 4.8v5.4h5.4"/><path d="M4.9 10.2a7.3 7.3 0 1 1 1.8 6.1"/>',
    delivery: '<circle cx="6.4" cy="17.4" r="2.2"/><circle cx="17.4" cy="17.4" r="2.2"/><path d="M8.6 17.4h6.6"/><path d="M3.8 15.2V10.6h5.5l1.9 6.8"/><path d="M11.2 10.6h3.5l2.7 6.8"/><path d="M14.7 6.4c1.7.4 2.6 2 2.9 4.2"/>',
    clock: '<circle cx="12" cy="12" r="8.1"/><path d="M12 7.4V12l3.3 2"/>',
    shield: '<path d="M12 3.6c1.9 1.5 3.9 2.2 6 2.3v5.5c0 4.2-2.6 6.9-6 8.5-3.4-1.6-6-4.3-6-8.5V5.9c2.1-.1 4.1-.8 6-2.3Z"/><path d="m9.4 12 1.8 1.9 3.5-3.7"/>',
    drop: '<path d="M12 3.8c2.6 3.1 5.3 5.9 5.3 9a5.3 5.3 0 0 1-10.6 0c0-3.1 2.7-5.9 5.3-9Z"/><path d="M9.7 13.4a2.3 2.3 0 0 0 2.3 2.3"/>',
    envelope: '<rect x="3.4" y="6.3" width="17.2" height="11.4" rx="1.6"/><path d="m4.6 7.8 7.4 5.2 7.4-5.2"/>',
    plus: '<path d="M12 5.4v13.2"/><path d="M5.4 12h13.2"/>',
    minus: '<path d="M5.4 12h13.2"/>',
    trash: '<path d="M4.4 6.8h15.2"/><path d="M9.4 6.8V4.9h5.2v1.9"/><path d="M6.6 6.8l.9 12.3h9l.9-12.3"/><path d="M10.4 10.4v6"/><path d="M13.6 10.4v6"/>',
    check: '<path d="m5.4 12.6 4.2 4.3 9-9.4"/>',
    arrowRight: '<path d="M4.6 12h14.8"/><path d="m13.4 6.2 5.8 5.8-5.8 5.8"/>',
    arrowLeft: '<path d="M19.4 12H4.6"/><path d="m10.6 6.2-5.8 5.8 5.8 5.8"/>',
    phone: '<path d="M9 3.6H6.3A2.2 2.2 0 0 0 4.1 5.9c.4 7 6.2 12.8 13.2 13.2a2.2 2.2 0 0 0 2.3-2.2v-2.7a12 12 0 0 1-3.5-1l-1.9 1.9a14.6 14.6 0 0 1-4.3-4.3l1.9-1.9a12 12 0 0 1-1-3.5Z"/>',
    pin: '<path d="M12 3.6a5.9 5.9 0 0 1 5.9 5.9c0 4.2-5.9 10.9-5.9 10.9S6.1 13.7 6.1 9.5A5.9 5.9 0 0 1 12 3.6Z"/><circle cx="12" cy="9.5" r="2.2"/>',
    instagram: '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4.6"/><circle cx="12" cy="12" r="4"/><path d="M16.9 7.1h.01"/>',
    scissors: '<circle cx="6.4" cy="6.4" r="2.6"/><circle cx="6.4" cy="17.6" r="2.6"/><path d="M8.5 8.2 19.4 19"/><path d="M19.4 5 8.5 15.8"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.6-.7 1.6-1.5 0-.4-.2-.8-.4-1.1a1.5 1.5 0 0 1 1.2-2.4h1.9a3.2 3.2 0 0 0 3.2-3.2c0-4.8-3.9-8.8-8.5-8.8Z"/><circle cx="8.3" cy="9.4" r=".9"/><circle cx="12" cy="7.6" r=".9"/><circle cx="15.6" cy="9.4" r=".9"/><circle cx="7.6" cy="13.4" r=".9"/>',
    package: '<path d="M12 3.6 20.2 8v8L12 20.4 3.8 16V8Z"/><path d="m3.8 8 8.2 4.4L20.2 8"/><path d="M12 20.4v-8"/>',
    gift: '<rect x="3.4" y="8.4" width="17.2" height="4" rx="1"/><path d="M4.8 12.4v6.2a1.6 1.6 0 0 0 1.6 1.6h11.2a1.6 1.6 0 0 0 1.6-1.6v-6.2"/><path d="M12 8.4v11.8"/><path d="M8.2 8.4a2.3 2.3 0 0 1 0-4.6C10 3.8 12 8.4 12 8.4"/><path d="M15.8 8.4a2.3 2.3 0 0 0 0-4.6C14 3.8 12 8.4 12 8.4"/>',
    calendar: '<rect x="3.6" y="5.4" width="16.8" height="15" rx="1.8"/><path d="M8 3.6v3.6"/><path d="M16 3.6v3.6"/><path d="M3.6 10.6h16.8"/>',
    heart: '<path d="M12 19.6 4.9 12.5a4.2 4.2 0 0 1 5.9-5.9l1.2 1.2 1.2-1.2a4.2 4.2 0 0 1 5.9 5.9Z"/>',
    document: '<path d="M13.6 3.6H6.8a1.8 1.8 0 0 0-1.8 1.8v13.2a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8V8.6Z"/><path d="M13.6 3.6v5h5.4"/><path d="M8.8 13h6.4"/><path d="M8.8 16.4h4.2"/>',
    download: '<path d="M12 3.6v12.2"/><path d="m7.2 11 4.8 4.8L16.8 11"/><path d="M4.8 20.4h14.4"/>',
    sparkles: '<path d="M12 3.6 13.6 9 19 10.6 13.6 12.2 12 17.6 10.4 12.2 5 10.6 10.4 9Z"/><path d="M18.4 16.2 19 18l1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6Z"/>'
  };

  function icon(name, extraClass) {
    var body = ICONS[name] || ICONS.sparkles;
    return '<svg class="icon' + (extraClass ? ' ' + extraClass : '') + '" viewBox="0 0 24 24" stroke="currentColor"' +
      ' stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  /* ============================ утилиты ============================ */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function byn(value) {
    var n = Math.round(Number(value) || 0);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009') + ' BYN';
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function plural(n, one, few, many) {
    var mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) { return one; }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) { return few; }
    return many;
  }

  function statusTitle(id) {
    for (var i = 0; i < STATUSES.length; i++) { if (STATUSES[i].id === id) { return STATUSES[i].title; } }
    return 'Новый';
  }

  function dayKey(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function todayISO() { return dayKey(new Date()); }

  function dateLabel(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return '—'; }
    return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function getProduct(id) {
    for (var i = 0; i < PRODUCTS.length; i++) { if (PRODUCTS[i].id === id) { return PRODUCTS[i]; } }
    return null;
  }

  function tagTitles(ids) {
    return (ids || []).map(function (id) {
      for (var i = 0; i < TAGS.length; i++) { if (TAGS[i].id === id) { return TAGS[i].title; } }
      return id;
    });
  }

  function catTitle(id) {
    for (var i = 0; i < CATEGORIES.length; i++) { if (CATEGORIES[i].id === id) { return CATEGORIES[i].title; } }
    return id;
  }

  /* ============================ хранилище ============================ */

  var memory = {};

  var store = (function () {
    try {
      var probe = '__pion_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (err) {
      return null;
    }
  }());

  function lsGet(key, fallback) {
    var raw = null;
    try { raw = store ? store.getItem(key) : memory[key]; } catch (err) { raw = memory[key]; }
    if (raw == null) { return fallback; }
    try {
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (err) {
      return fallback;
    }
  }

  function lsSet(key, value) {
    var raw = JSON.stringify(value);
    try {
      if (store) { store.setItem(key, raw); } else { memory[key] = raw; }
    } catch (err) {
      memory[key] = raw;
    }
  }

  /* ============================ корзина ============================ */

  function readCart() {
    var list = lsGet(CART_KEY, []);
    if (!Array.isArray(list)) { return []; }
    return list.filter(function (item) {
      return item && item.id && Number(item.price) >= 0;
    }).map(function (item) {
      return {
        id: String(item.id),
        name: String(item.name || 'Букет'),
        price: Math.round(Number(item.price) || 0),
        qty: Math.max(1, Math.round(Number(item.qty) || 1)),
        img: item.img || BUILDER_IMG,
        note: item.note || ''
      };
    });
  }

  function writeCart(items) {
    lsSet(CART_KEY, items);
    document.dispatchEvent(new CustomEvent('pion:cart', { detail: { count: cartCount() } }));
  }

  function cartCount() {
    return readCart().reduce(function (sum, item) { return sum + item.qty; }, 0);
  }

  function cartSubtotal() {
    return readCart().reduce(function (sum, item) { return sum + item.price * item.qty; }, 0);
  }

  function deliveryFor(subtotal) {
    if (subtotal <= 0) { return 0; }
    return subtotal >= FREE_FROM ? 0 : DELIVERY_FEE;
  }

  function cartTotal() {
    var sub = cartSubtotal();
    return sub + deliveryFor(sub);
  }

  function addToCart(item, qty) {
    var list = readCart();
    var add = Math.max(1, Math.round(Number(qty) || 1));
    var found = null;
    for (var i = 0; i < list.length; i++) { if (list[i].id === item.id) { found = list[i]; } }
    if (found) {
      found.qty += add;
    } else {
      list.push({
        id: String(item.id),
        name: String(item.name || 'Букет'),
        price: Math.round(Number(item.price) || 0),
        qty: add,
        img: item.img || BUILDER_IMG,
        note: item.note || ''
      });
    }
    writeCart(list);
    return cartCount();
  }

  function setQty(id, qty) {
    var list = readCart();
    var next = [];
    list.forEach(function (item) {
      if (item.id === id) {
        var value = Math.round(Number(qty) || 0);
        if (value > 0) { item.qty = Math.min(99, value); next.push(item); }
      } else {
        next.push(item);
      }
    });
    writeCart(next);
  }

  function removeFromCart(id) {
    writeCart(readCart().filter(function (item) { return item.id !== id; }));
  }

  function clearCart() { writeCart([]); }

  /* ============================ заказы ============================ */

  function readOrders() {
    var list = lsGet(ORDERS_KEY, []);
    if (!Array.isArray(list)) { return []; }
    return list.filter(function (o) { return o && o.number; }).sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  function saveOrders(list) { lsSet(ORDERS_KEY, list); }

  function pad4(n) {
    var s = String(n);
    while (s.length < 4) { s = '0' + s; }
    return s;
  }

  /* Номер заказа — последние четыре цифры времени оформления, всегда четыре знака */
  function nextOrderNumber() {
    var list = readOrders();
    var used = {};
    list.forEach(function (o) { used[String(o.number)] = true; });
    var base = Number(String(Date.now()).slice(-4));
    var candidate = base;
    var guard = 0;
    while (used[pad4(candidate)] && guard < 60) {
      candidate = candidate + 1 > 9999 ? 0 : candidate + 1;
      guard++;
    }
    return pad4(candidate);
  }

  function createOrder(payload) {
    var order = {
      number: nextOrderNumber(),
      createdAt: new Date().toISOString(),
      status: 'new',
      name: payload.name,
      phone: payload.phone,
      method: payload.method,
      address: payload.address || '',
      date: payload.date || '',
      slot: payload.slot || '',
      comment: payload.comment || '',
      items: payload.items.map(function (item) {
        return { name: item.name, note: item.note || '', price: item.price, qty: item.qty };
      }),
      subtotal: payload.subtotal,
      delivery: payload.delivery,
      total: payload.total
    };
    var list = readOrders();
    list.push(order);
    saveOrders(list);
    return order;
  }

  function updateOrderStatus(number, status) {
    var list = readOrders();
    var touched = false;
    list.forEach(function (o) {
      if (String(o.number) === String(number)) { o.status = status; touched = true; }
    });
    saveOrders(list);
    return touched;
  }

  function ordersToCsv(list) {
    var head = ['Номер', 'Дата', 'Статус', 'Имя', 'Телефон', 'Получение', 'Адрес', 'Дата доставки',
      'Время', 'Состав', 'Сумма', 'Доставка', 'Итого', 'Комментарий'];
    function cell(value) {
      var text = String(value == null ? '' : value).replace(/"/g, '""');
      return '"' + text + '"';
    }
    var rows = [head.map(cell).join(';')];
    list.forEach(function (o) {
      var composition = (o.items || []).map(function (item) {
        return item.name + (item.note ? ' (' + item.note + ')' : '') + ' × ' + item.qty;
      }).join(' | ');
      rows.push([
        '№' + o.number,
        dateLabel(o.createdAt),
        statusTitle(o.status),
        o.name,
        o.phone,
        o.method === 'pickup' ? 'Самовывоз' : 'Доставка по Минску',
        o.address || '—',
        o.date || '—',
        o.slot || '—',
        composition,
        byn(o.subtotal),
        byn(o.delivery),
        byn(o.total),
        o.comment || ''
      ].map(cell).join(';'));
    });
    return rows.join('\r\n');
  }

  /* ============================ DOM-помощники ============================ */

  function toast(message) {
    var el = $('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('is-visible');
    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(function () { el.classList.remove('is-visible'); }, 2600);
  }

  function imageMarkup(src, alt, className) {
    return '<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async"' +
      (className ? ' class="' + className + '"' : '') + '>';
  }

  /* Карточка без рамок и теней: фото 4:5, название и цена с точечным заполнителем.
     Подробности показываем только на крупной карточке витрины. */
  function productCard(product, opts) {
    opts = opts || {};
    var feature = !!opts.feature;
    var index = opts.index || 0;
    var badge = product.badge
      ? '<span class="badge">' + esc(product.badge) + '</span>'
      : '';
    var tagLine = tagTitles(product.tags).join(' · ');

    if (!feature) {
      return '' +
        '<article class="card reveal" data-product="' + esc(product.id) + '">' +
          '<div class="card__media">' +
            badge +
            imageMarkup(product.img, product.alt) +
            '<span class="card__index num" aria-hidden="true">' + pad(index) + '</span>' +
          '</div>' +
          '<div class="card__body">' +
            '<h3 class="card__title">' + esc(product.name) + '</h3>' +
            '<div class="card__foot">' +
              '<div class="price-line">' +
                '<span class="price">' + byn(product.price) + '</span>' +
                '<span class="leader" aria-hidden="true"></span>' +
                '<button class="add-btn" type="button" data-action="add" data-id="' + esc(product.id) + '"' +
                  ' aria-label="В корзину: ' + esc(product.name) + '">' + icon('plus') + '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</article>';
    }

    return '' +
      '<article class="card card--feature reveal" data-product="' + esc(product.id) + '">' +
        '<div class="card__media">' +
          badge +
          imageMarkup(product.img, product.alt) +
          '<span class="card__index num" aria-hidden="true">' + pad(index) + '</span>' +
        '</div>' +
        '<div class="card__body">' +
          '<p class="card__kicker">' + esc(catTitle(product.cat)) + '</p>' +
          '<h3 class="card__title">' + esc(product.name) + '</h3>' +
          '<p class="card__text">' + esc(product.short) + '</p>' +
          '<p class="card__spec">' + esc(product.size) + (tagLine ? ' · ' + esc(tagLine) : '') + '</p>' +
          '<div class="card__foot">' +
            '<div class="price-line">' +
              '<span class="price">' + byn(product.price) + '</span>' +
              '<span class="leader" aria-hidden="true"></span>' +
              '<button class="btn btn--sm" type="button" data-action="add" data-id="' + esc(product.id) + '">' +
                icon('basket') + 'В корзину' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function updateCartBadges() {
    var count = cartCount();
    $$('[data-cart-count]').forEach(function (el) {
      el.textContent = count > 9 ? '9+' : String(count);
      el.hidden = count === 0;
    });
    $$('[data-cart-button]').forEach(function (el) {
      el.setAttribute('aria-label', 'Корзина: ' + count + ' ' + plural(count, 'позиция', 'позиции', 'позиций'));
    });
  }

  /* ============================ шапка: меню и мягкое появление ============================ */

  function initHeader() {
    var burger = $('[data-action="menu"]');
    var panel = $('#mobile-nav');
    if (!burger || !panel) { return; }

    function setOpen(open) {
      panel.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (document.body && document.body.classList) {
        document.body.classList.toggle('nav-open', open);
      }
    }

    burger.addEventListener('click', function () {
      setOpen(!panel.classList.contains('is-open'));
    });
    $$('a', panel).forEach(function (link) {
      link.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && panel.classList.contains('is-open')) { setOpen(false); }
    });
  }

  function initReveal() {
    var nodes = $$('.reveal');
    if (!nodes.length) { return; }
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('is-visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    nodes.forEach(function (n) { observer.observe(n); });
    // Страховка: если наблюдатель не сработал, всё, что на первом экране, всё равно показываем
    window.setTimeout(function () {
      nodes.forEach(function (n) {
        var r = n.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) { n.classList.add('is-visible'); }
      });
    }, 900);
  }

  function initFooterYear() {
    $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
  }

  /* Глобальный клик по «В корзину» из любой сетки */
  function initAddButtons() {
    document.addEventListener('click', function (event) {
      var btn = event.target.closest ? event.target.closest('[data-action="add"]') : null;
      if (!btn) { return; }
      var product = getProduct(btn.getAttribute('data-id'));
      if (!product) { return; }
      var count = addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        img: product.img,
        note: product.size
      }, 1);
      updateCartBadges();
      toast('«' + product.name + '» в корзине · ' + count + ' ' + plural(count, 'позиция', 'позиции', 'позиций'));
    });
  }

  /* ============================ главная: конструктор букета ============================ */

  /* ============================ конструктор: живой букет ============================
     Модельки, раскладка и цены живут в assets/bouquet.js. Отсюда — только состояние,
     чипы управления, перерисовка витрины и добавление в корзину. */

  var BQ = window.PION_BOUQUET || null;

  var BUILDER = {
    occasions: [
      { id: 'none', title: 'Без повода', add: 0, hint: 'Просто потому что хочется' },
      { id: 'birthday', title: 'День рождения', add: 10, hint: 'Подберу ярких акцентов' },
      { id: 'anniversary', title: 'Годовщина', add: 15, hint: 'Соберу плотнее, лента в тон' },
      { id: 'wedding', title: 'Свадьба', add: 40, hint: 'Стойкие сорта, плотная сборка' },
      { id: 'thanks', title: 'Сказать спасибо', add: 0, hint: 'Небольшой и аккуратный' },
      { id: 'newhome', title: 'Новоселье', add: 5, hint: 'Композиция, которая долго стоит' }
    ]
  };

  function findOption(list, id) {
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
    return list[0];
  }

  /* Цена букета: работа + бутоны + палитра + упаковка + лента + повод */
  function builderPrice(state) {
    if (!BQ) { return 0; }
    return BQ.priceOf(state) + findOption(BUILDER.occasions, state.occasion).add;
  }

  function initBuilder() {
    var root = $('#builder');
    if (!root || !BQ) { return; }

    var state = { occasion: 'none', flower: 'peony', count: 15, palette: 'pudra', pack: 'craft', ribbon: 'cream' };
    var svg = $('#bouquet');
    var drawn = '';

    var groups = [
      { field: 'flower', list: BQ.FLOWERS, art: true },
      { field: 'count', list: BQ.COUNTS.map(function (n) { return { id: String(n), title: String(n) }; }) },
      { field: 'palette', list: BQ.PALETTES },
      { field: 'pack', list: BQ.PACKS },
      { field: 'ribbon', list: BQ.RIBBONS },
      { field: 'occasion', list: BUILDER.occasions }
    ];

    function chip(group, option) {
      var active = String(state[group.field]) === String(option.id);
      var lead = '';
      if (group.art) {
        lead = '<span class="chip__art" aria-hidden="true">' + BQ.icon(option.id, 30) + '</span>';
      } else if (option.swatch) {
        lead = '<span class="swatch" style="background:' + esc(option.swatch) + '"></span>';
      }
      return '<button class="chip" type="button" data-group="' + esc(group.field) + '" data-value="' +
        esc(String(option.id)) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' + lead + esc(option.title) + '</button>';
    }

    /* Витрину перерисовываем только когда меняется сам рисунок: повод на букет не влияет */
    function draw() {
      if (!svg) { return; }
      var key = [state.flower, state.count, state.palette, state.pack, state.ribbon].join('|');
      if (key === drawn) { return; }
      drawn = key;
      BQ.render(svg, state, { animate: true });
      svg.setAttribute('aria-label', 'Букет: ' + BQ.summary(state));
    }

    function render() {
      var flower = BQ.find(BQ.FLOWERS, state.flower);
      var pal = BQ.find(BQ.PALETTES, state.palette);
      var pack = BQ.find(BQ.PACKS, state.pack);
      var ribbon = BQ.find(BQ.RIBBONS, state.ribbon);
      var occ = findOption(BUILDER.occasions, state.occasion);
      var sum = builderPrice(state);

      root.querySelectorAll('[data-group]').forEach(function (el) {
        var field = el.getAttribute('data-group');
        el.setAttribute('aria-pressed', String(el.getAttribute('data-value')) === String(state[field]) ? 'true' : 'false');
      });

      $('#builder-flower-hint').textContent = flower.hint;
      $('#builder-count-hint').textContent = state.count + ' × ' + flower.stem + ' BYN за бутон и ' + BQ.BASE + ' BYN за работу';
      $('#builder-count-aside').textContent = state.count <= BQ.COUNTS[0] ? BQ.COVER.min
        : (state.count >= BQ.COUNTS[BQ.COUNTS.length - 1] ? BQ.COVER.max : 'Чаще всего берут 15 или 21.');
      $('#builder-pack-hint').textContent = pack.hint;
      $('#builder-occasion-hint').textContent = occ.hint;
      $('#builder-price').textContent = byn(sum);
      $('#builder-summary').textContent = BQ.summary(state) + ' · ' + occ.title.toLowerCase();
      $('#builder-stage-note').textContent = flower.title + ' × ' + state.count + ' · ' + pack.title.toLowerCase() +
        ' · лента ' + ribbon.title.toLowerCase() + '. В жизни головы крупнее.';
      $('#builder-note').textContent = sum >= FREE_FROM
        ? 'Доставка по Минску бесплатная: заказ перевалил за ' + byn(FREE_FROM) + '.'
        : 'До бесплатной доставки не хватает ' + byn(FREE_FROM - sum) + '. По Минску возим за ' +
          byn(DELIVERY_FEE) + ', обычно за два часа.';
      draw();
    }

    groups.forEach(function (group) {
      var host = root.querySelector('[data-options="' + group.field + '"]');
      if (!host) { return; }
      host.innerHTML = group.list.map(function (option) { return chip(group, option); }).join('');
    });

    root.addEventListener('click', function (event) {
      var btn = event.target.closest ? event.target.closest('[data-group]') : null;
      if (!btn) { return; }
      var field = btn.getAttribute('data-group');
      if (!(field in state)) { return; }
      var raw = btn.getAttribute('data-value');
      state[field] = field === 'count' ? parseInt(raw, 10) : raw;
      render();
    });

    var add = $('#builder-add');
    if (add) {
      add.addEventListener('click', function () {
        var flower = BQ.find(BQ.FLOWERS, state.flower);
        var occ = findOption(BUILDER.occasions, state.occasion);
        var price = builderPrice(state);
        var title = state.count + ' ' + plural(state.count, flower.title.toLowerCase(),
          flower.title.toLowerCase() + 'а', flower.title.toLowerCase() + 'ов');
        var count = addToCart({
          id: 'bouquet-' + [state.flower, state.count, state.palette, state.pack, state.ribbon].join('-'),
          name: 'Букет по конструктору: ' + title,
          price: price,
          img: BQ.dataUrl(state, 480),
          note: BQ.summary(state) + ' · ' + occ.title.toLowerCase(),
          bouquet: { flower: state.flower, count: state.count, palette: state.palette, pack: state.pack, ribbon: state.ribbon }
        }, 1);
        updateCartBadges();
        toast('Собрали букет за ' + byn(price) + '. В корзине ' + count + ' ' + plural(count, 'позиция', 'позиции', 'позиций'));
      });
    }

    render();
  }

  function initFeatured() {
    var grid = $('#featured');
    if (!grid) { return; }
    var picked = PRODUCTS.slice().sort(function (a, b) { return (b.pop || 0) - (a.pop || 0); }).slice(0, 4);
    grid.innerHTML = picked.map(function (product, i) {
      return productCard(product, { index: i + 1, feature: i === 0 });
    }).join('');
    initReveal();
  }

  function initServices() {
    var host = $('#services');
    if (!host) { return; }
    host.innerHTML = SERVICES.map(function (service, i) {
      return '' +
        '<article class="feature reveal">' +
          '<span class="feature__icon" aria-hidden="true">' + icon(service.icon, 'icon--lg') + '</span>' +
          '<div>' +
            '<h3>' + esc(service.title) + '</h3>' +
            '<p>' + esc(service.text) + '</p>' +
          '</div>' +
          '<span class="feature__index num" aria-hidden="true">' + pad(i + 1) + '</span>' +
        '</article>';
    }).join('');
    initReveal();
  }

  /* ============================ каталог ============================ */

  function initCatalog() {
    var grid = $('#catalog-grid');
    if (!grid) { return; }

    var state = { cat: 'all', price: 'all', tag: 'all', q: '', sort: 'pop' };
    var priceBuckets = [
      { id: 'low', title: 'до 100 BYN' },
      { id: 'mid', title: '100–180 BYN' },
      { id: 'high', title: 'от 180 BYN' }
    ];

    function chips(host, items, field, allTitle) {
      if (!host) { return; }
      var html = '<button class="chip" type="button" data-filter="' + field + '" data-value="all" aria-pressed="' +
        (state[field] === 'all' ? 'true' : 'false') + '">' + esc(allTitle) + '</button>';
      html += items.map(function (item) {
        return '<button class="chip" type="button" data-filter="' + field + '" data-value="' + esc(item.id) +
          '" aria-pressed="' + (state[field] === item.id ? 'true' : 'false') + '">' + esc(item.title) + '</button>';
      }).join('');
      host.innerHTML = html;
    }

    function renderChips() {
      chips($('#filter-cat'), CATEGORIES, 'cat', 'Все работы');
      chips($('#filter-price'), priceBuckets, 'price', 'Любая цена');
      chips($('#filter-tag'), TAGS, 'tag', 'Без уточнений');
    }

    function match(product) {
      if (state.cat !== 'all' && product.cat !== state.cat) { return false; }
      if (state.tag !== 'all' && (product.tags || []).indexOf(state.tag) === -1) { return false; }
      if (state.price === 'low' && product.price > 100) { return false; }
      if (state.price === 'mid' && (product.price <= 100 || product.price > 180)) { return false; }
      if (state.price === 'high' && product.price <= 180) { return false; }
      if (state.q) {
        var haystack = (product.name + ' ' + product.short + ' ' + product.size + ' ' + catTitle(product.cat)).toLowerCase();
        if (haystack.indexOf(state.q.toLowerCase()) === -1) { return false; }
      }
      return true;
    }

    function sortList(list) {
      var copy = list.slice();
      if (state.sort === 'cheap') { copy.sort(function (a, b) { return a.price - b.price; }); }
      else if (state.sort === 'expensive') { copy.sort(function (a, b) { return b.price - a.price; }); }
      else { copy.sort(function (a, b) { return (b.pop || 0) - (a.pop || 0); }); }
      return copy;
    }

    function render() {
      var found = sortList(PRODUCTS.filter(match));
      var counter = $('#catalog-count');
      if (counter) {
        counter.textContent = found.length
          ? 'Нашлось ' + found.length + ' ' + plural(found.length, 'работа', 'работы', 'работ') + ' из ' + PRODUCTS.length
          : 'Ничего не нашлось';
      }
      if (!found.length) {
        grid.innerHTML = '' +
          '<div class="empty grid-empty">' +
            icon('search', 'icon--xl') +
            '<h3>Под эти условия ничего не нашлось</h3>' +
            '<p class="small">Снимите пару фильтров или напишите короче: например, «пион» или «подписка».</p>' +
            '<button class="btn btn--sm" type="button" data-action="reset-filters">' +
              icon('reset') + 'Сбросить фильтры' +
            '</button>' +
          '</div>';
        return;
      }
      grid.innerHTML = found.map(function (product, i) {
        return productCard(product, { index: i + 1, feature: found.length >= 4 && i === 0 });
      }).join('');
      initReveal();
    }

    renderChips();
    render();

    $$('#filter-cat, #filter-price, #filter-tag').forEach(function (host) {
      host.addEventListener('click', function (event) {
        var btn = event.target.closest ? event.target.closest('[data-filter]') : null;
        if (!btn) { return; }
        var field = btn.getAttribute('data-filter');
        state[field] = btn.getAttribute('data-value');
        $$('[data-filter="' + field + '"]').forEach(function (el) {
          el.setAttribute('aria-pressed', el === btn ? 'true' : 'false');
        });
        render();
      });
    });

    var search = $('#catalog-search');
    if (search) {
      search.addEventListener('input', function () {
        state.q = search.value.trim();
        render();
      });
    }

    var sort = $('#catalog-sort');
    if (sort) {
      sort.addEventListener('change', function () {
        state.sort = sort.value;
        render();
      });
    }

    var reset = $('#catalog-reset');
    if (reset) {
      reset.addEventListener('click', function () {
        state = { cat: 'all', price: 'all', tag: 'all', q: '', sort: 'pop' };
        if (search) { search.value = ''; }
        if (sort) { sort.value = 'pop'; }
        renderChips();
        render();
      });
    }

    document.addEventListener('click', function (event) {
      var btn = event.target.closest ? event.target.closest('[data-action="reset-filters"]') : null;
      if (!btn) { return; }
      state = { cat: 'all', price: 'all', tag: 'all', q: '', sort: 'pop' };
      if (search) { search.value = ''; }
      if (sort) { sort.value = 'pop'; }
      renderChips();
      render();
    });
  }

  /* ============================ корзина и оформление заказа ============================ */

  function initCartPage() {
    var root = $('#cart-page');
    if (!root) { return; }

    var method = 'delivery';

    function render() {
      var items = readCart();
      var layout = $('#cart-layout');
      var emptyBox = $('#cart-empty');
      var success = $('#order-success');
      var checkout = $('#checkout');

      if (!items.length) {
        if (layout) { layout.hidden = true; }
        if (checkout) { checkout.hidden = true; }
        if (emptyBox) { emptyBox.hidden = !!(success && !success.hidden); }
        return;
      }
      if (layout) { layout.hidden = false; }
      if (checkout) { checkout.hidden = false; }
      if (emptyBox) { emptyBox.hidden = true; }

      var sub = cartSubtotal();
      var fee = deliveryFor(sub);
      var list = $('#cart-items');
      if (list) {
        list.innerHTML = items.map(function (item) {
          return '' +
            '<li class="cart-line" data-id="' + esc(item.id) + '">' +
              '<div class="cart-line__media">' + imageMarkup(item.img, item.name) + '</div>' +
              '<div class="cart-line__body">' +
                '<h3>' + esc(item.name) + '</h3>' +
                (item.note ? '<p class="tiny muted">' + esc(item.note) + '</p>' : '') +
                '<p class="small muted">' + byn(item.price) + ' за штуку</p>' +
              '</div>' +
              '<div class="cart-line__qty">' +
                '<button class="icon-btn icon-btn--sm" type="button" data-action="dec" data-id="' + esc(item.id) + '" aria-label="Убрать одну">' +
                  icon('minus') +
                '</button>' +
                '<span class="qty" aria-live="polite">' + item.qty + '</span>' +
                '<button class="icon-btn icon-btn--sm" type="button" data-action="inc" data-id="' + esc(item.id) + '" aria-label="Добавить одну">' +
                  icon('plus') +
                '</button>' +
              '</div>' +
              '<div class="cart-line__sum">' + byn(item.price * item.qty) + '</div>' +
              '<button class="icon-btn icon-btn--sm cart-line__del" type="button" data-action="remove" data-id="' + esc(item.id) + '" aria-label="Удалить ' + esc(item.name) + '">' +
                icon('trash') +
              '</button>' +
            '</li>';
        }).join('');
      }

      var subEl = $('#sum-subtotal');
      var feeEl = $('#sum-delivery');
      var totalEl = $('#sum-total');
      if (subEl) { subEl.textContent = byn(sub); }
      if (feeEl) { feeEl.textContent = fee === 0 ? 'бесплатно' : byn(fee); }
      if (totalEl) { totalEl.textContent = byn(sub + fee); }

      var hint = $('#delivery-hint');
      if (hint) {
        hint.textContent = fee === 0
          ? 'Доставка бесплатная: заказ от ' + byn(FREE_FROM) + '.'
          : 'До бесплатной доставки осталось ' + byn(FREE_FROM - sub) + '. По Минску возим за ' +
            byn(DELIVERY_FEE) + ', обычно за два часа.';
      }
      var bar = $('#delivery-bar');
      if (bar) {
        bar.style.width = Math.min(100, Math.round((sub / FREE_FROM) * 100)) + '%';
      }

      var submit = $('#checkout-submit');
      var label = submit ? submit.querySelector('[data-submit-label]') : null;
      if (label) { label.textContent = 'Оформить заказ · ' + byn(sub + fee); }
      updateCartBadges();
      if (success) { success.hidden = true; }
    }

    root.addEventListener('click', function (event) {
      var btn = event.target.closest ? event.target.closest('[data-action]') : null;
      if (!btn) { return; }
      var action = btn.getAttribute('data-action');
      var id = btn.getAttribute('data-id');
      if (action === 'inc' || action === 'dec') {
        var items = readCart();
        var current = 1;
        items.forEach(function (item) { if (item.id === id) { current = item.qty; } });
        setQty(id, action === 'inc' ? current + 1 : current - 1);
        render();
      } else if (action === 'remove') {
        removeFromCart(id);
        render();
        toast('Убрали позицию из корзины');
      } else if (action === 'clear-cart') {
        clearCart();
        render();
        toast('Корзина пустая');
      }
    });

    /* способ получения: адрес и интервал нужны только для доставки */
    var addressWrap = $('#field-address');
    var slotWrap = $('#field-slot');
    $$('input[name="method"]').forEach(function (input) {
      input.addEventListener('change', function () {
        method = input.value;
        if (addressWrap) { addressWrap.hidden = method !== 'delivery'; }
        if (slotWrap) { slotWrap.hidden = method !== 'delivery'; }
      });
    });

    var dateInput = $('#field-date');
    if (dateInput) {
      dateInput.min = todayISO();
      if (!dateInput.value) { dateInput.value = todayISO(); }
    }

    function showError(field, message) {
      var box = $('#error-' + field);
      if (!box) { return; }
      box.textContent = message;
      if (message) { box.hidden = false; } else { box.hidden = true; }
    }

    var form = $('#checkout-form');
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var items = readCart();
        if (!items.length) {
          toast('Сначала выберите букет в каталоге');
          return;
        }
        var name = ($('#field-name') || {}).value || '';
        var phone = ($('#field-phone') || {}).value || '';
        var address = addressWrap && !addressWrap.hidden ? (($('#field-address-input') || {}).value || '') : '';
        var date = ($('#field-date') || {}).value || '';
        var slot = slotWrap && !slotWrap.hidden ? (($('#field-slot-select') || {}).value || '') : '';
        var comment = ($('#field-comment') || {}).value || '';

        var ok = true;
        name = name.trim();
        if (name.length < 2) { showError('name', 'Напишите имя, хотя бы пару букв'); ok = false; } else { showError('name', ''); }

        var digits = phone.replace(/[^\d]/g, '');
        if (!/^375(17|25|29|33|44)\d{7}$/.test(digits)) {
          showError('phone', 'Не похоже на номер. Формат: +375 (29) 123-45-67'); ok = false;
        } else { showError('phone', ''); }

        if (method === 'delivery') {
          if (address.trim().length < 5) { showError('address', 'Нужны улица, дом и квартира, иначе курьер будет звонить из машины'); ok = false; } else { showError('address', ''); }
        } else {
          showError('address', '');
        }
        if (!date) { showError('date', 'Без даты не поймём, когда везти'); ok = false; } else { showError('date', ''); }
        if (!ok) { return; }

        var sub = cartSubtotal();
        var fee = method === 'delivery' ? deliveryFor(sub) : 0;
        var order = createOrder({
          name: name,
          phone: phone.trim(),
          method: method,
          address: method === 'delivery' ? address.trim() : '',
          date: date,
          slot: slot,
          comment: comment.trim(),
          items: items,
          subtotal: sub,
          delivery: fee,
          total: sub + fee
        });

        clearCart();
        updateCartBadges();
        form.reset();
        method = 'delivery';

        var success = $('#order-success');
        if (success) {
          success.hidden = false;
          $('#success-number').textContent = '№' + order.number;
          $('#success-summary').innerHTML = '' +
            '<li><span>Заказ</span><strong>' + byn(order.subtotal) + '</strong></li>' +
            '<li><span>Доставка</span><strong>' + (order.delivery === 0 ? 'бесплатно' : byn(order.delivery)) + '</strong></li>' +
            '<li class="success-total"><span>Итого</span><strong>' + byn(order.total) + '</strong></li>' +
            '<li><span>Получение</span><strong>' + (order.method === 'pickup' ? 'самовывоз из мастерской' : 'доставка: ' + esc(order.address)) + '</strong></li>' +
            '<li><span>Дата</span><strong>' + esc(order.date) + (order.slot ? ', ' + esc(order.slot) : '') + '</strong></li>';
          success.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        toast('Заказ №' + order.number + ' у нас. Позвоним в течение 15 минут.');
        render();
      });
    }

    document.addEventListener('pion:cart', render);
    window.addEventListener('storage', function (event) {
      if (event.key === CART_KEY) { render(); }
    });

    render();
  }

  /* ============================ панель владельца ============================ */

  function initAdmin() {
    var root = $('#admin-page');
    if (!root) { return; }

    var statusFilter = 'all';

    function renderStats(orders) {
      var today = todayISO();
      var todayOrders = orders.filter(function (o) { return dayKey(new Date(o.createdAt)) === today; });
      var revenue = todayOrders.reduce(function (sum, o) {
        return o.status === 'canceled' ? sum : sum + Number(o.total || 0);
      }, 0);
      var active = orders.filter(function (o) { return o.status === 'new' || o.status === 'accepted'; }).length;

      $('#stat-today').textContent = String(todayOrders.length);
      $('#stat-revenue').textContent = byn(revenue);
      $('#stat-active').textContent = String(active);
      $('#stat-total').textContent = String(orders.length);
    }

    function renderOrders(orders) {
      var host = $('#orders-list');
      var empty = $('#orders-empty');
      var shown = statusFilter === 'all' ? orders : orders.filter(function (o) { return o.status === statusFilter; });

      if (!orders.length) {
        if (host) { host.innerHTML = ''; }
        if (empty) { empty.hidden = false; }
        return;
      }
      if (empty) { empty.hidden = true; }

      if (!shown.length) {
        host.innerHTML = '<div class="empty"><p class="small">В этом статусе пока пусто. Посмотрите другой или вернитесь ко всем заказам.</p></div>';
        return;
      }

      host.innerHTML = shown.map(function (order) {
        var items = (order.items || []).map(function (item) {
          return '<li><span class="order-item__name">' + esc(item.name) +
            (item.note ? ' <span class="tiny muted">' + esc(item.note) + '</span>' : '') +
            '</span><span class="order-item__qty">× ' + item.qty + '</span><span class="order-item__price">' + byn(item.price * item.qty) + '</span></li>';
        }).join('');

        var buttons = STATUSES.map(function (status) {
          var active = order.status === status.id;
          return '<button class="chip chip--status" type="button" data-action="status" data-status="' + status.id +
            '" data-number="' + order.number + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
            esc(status.title) + '</button>';
        }).join('');

        return '' +
          '<article class="order card reveal" data-number="' + order.number + '">' +
            '<header class="order__head">' +
              '<div>' +
                '<h3>Заказ №' + order.number + '</h3>' +
                '<p class="tiny muted">' + esc(dateLabel(order.createdAt)) + '</p>' +
              '</div>' +
              '<span class="badge ' + (order.status === 'done' ? 'badge--ok' : order.status === 'canceled' ? 'badge--warn' : '') + '">' +
                esc(statusTitle(order.status)) + '</span>' +
            '</header>' +
            '<ul class="order__items">' + items + '</ul>' +
            '<div class="order__meta">' +
              '<p><strong>' + esc(order.name) + '</strong> · ' + esc(order.phone) + '</p>' +
              '<p class="small muted">' + (order.method === 'pickup'
                ? 'Самовывоз с Немиги, 12'
                : 'Доставка: ' + esc(order.address || 'адрес не указан')) + '</p>' +
              '<p class="small muted">Дата: ' + esc(order.date || '—') + (order.slot ? ', ' + esc(order.slot) : '') + '</p>' +
              (order.comment ? '<p class="small muted">Комментарий: ' + esc(order.comment) + '</p>' : '') +
            '</div>' +
            '<div class="order__foot">' +
              '<div class="order__sum">' +
                '<span class="tiny muted">Букеты ' + byn(order.subtotal) + ' · доставка ' +
                  (order.delivery === 0 ? 'бесплатно' : byn(order.delivery)) + '</span>' +
                '<strong>' + byn(order.total) + '</strong>' +
              '</div>' +
              '<div class="order__status" role="group" aria-label="Статус заказа №' + order.number + '">' + buttons + '</div>' +
            '</div>' +
          '</article>';
      }).join('');
      initReveal();
    }

    function render() {
      var orders = readOrders();
      renderStats(orders);
      renderOrders(orders);
      var counter = $('#admin-count');
      if (counter) {
        counter.textContent = orders.length
          ? 'В списке ' + orders.length + ' ' + plural(orders.length, 'заказ', 'заказа', 'заказов')
          : 'Заказов пока нет';
      }
    }

    root.addEventListener('click', function (event) {
      var btn = event.target.closest ? event.target.closest('[data-action="status"]') : null;
      if (!btn) { return; }
      var number = btn.getAttribute('data-number');
      var status = btn.getAttribute('data-status');
      updateOrderStatus(number, status);
      render();
      toast('Заказ №' + number + ': ' + statusTitle(status).toLowerCase());
    });

    $$('[data-status-filter]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        statusFilter = chip.getAttribute('data-status-filter');
        $$('[data-status-filter]').forEach(function (el) {
          el.setAttribute('aria-pressed', el === chip ? 'true' : 'false');
        });
        renderOrders(readOrders());
      });
    });

    var exportBtn = $('#export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        var orders = readOrders();
        if (!orders.length) { toast('В списке пусто, выгружать нечего'); return; }
        var csv = '\ufeff' + ordersToCsv(orders);
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'pion-orders-' + todayISO() + '.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast('Выгрузили ' + orders.length + ' ' + plural(orders.length, 'заказ', 'заказа', 'заказов') + ' в CSV');
      });
    }

    var wipe = $('#clear-orders');
    if (wipe) {
      wipe.addEventListener('click', function () {
        if (!readOrders().length) { toast('Тут и так пусто'); return; }
        if (!window.confirm('Стереть все заказы? Это данные только в этом браузере, вернуть их будет нельзя.')) { return; }
        saveOrders([]);
        render();
        toast('Панель чистая. Оформите тестовый заказ, чтобы проверить снова.');
      });
    }

    document.addEventListener('pion:cart', render);
    window.addEventListener('storage', function (event) {
      if (event.key === ORDERS_KEY) { render(); }
    });
    window.addEventListener('focus', render);

    render();
  }

  /* ============================ запуск ============================ */

  window.PionCore = {
    byn: byn,
    plural: plural,
    deliveryFor: deliveryFor,
    cartSubtotal: cartSubtotal,
    cartTotal: cartTotal,
    readCart: readCart,
    addToCart: addToCart,
    setQty: setQty,
    removeFromCart: removeFromCart,
    createOrder: createOrder,
    readOrders: readOrders,
    saveOrders: saveOrders,
    updateOrderStatus: updateOrderStatus,
    nextOrderNumber: nextOrderNumber,
    ordersToCsv: ordersToCsv,
    statusTitle: statusTitle,
    builderPrice: builderPrice,
    builder: BUILDER,
    FREE_FROM: FREE_FROM,
    DELIVERY_FEE: DELIVERY_FEE,
    keys: { cart: CART_KEY, orders: ORDERS_KEY }
  };

  function boot() {
    updateCartBadges();
    initHeader();
    initFooterYear();
    initAddButtons();
    initBuilder();
    initFeatured();
    initServices();
    initCatalog();
    initCartPage();
    initAdmin();
    initReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
