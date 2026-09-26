/* app.js — вся логика демо-сайта «Линия» (магазин женской одежды, Минск).
   Работает по file:// без сборки и без сети: данные из assets/data.js, состояние в localStorage.
   Ключи уникальны для этого сайта (демо-сайты могут жить на одном origin):
   igdemo_fashion_cart_v1 (корзина), igdemo_fashion_orders_v1 (заказы для панели владельца). */

(function () {
  'use strict';

  /* ============================ данные и константы ============================ */

  var DATA = window.LINIA_DATA || {};
  var SHOP = DATA.shop || {};
  var PRODUCTS = DATA.products || [];
  var CATEGORIES = DATA.categories || [];
  var COLORS = DATA.colors || [];
  var POINTS = DATA.points || [];
  var SERVICES = DATA.services || [];
  var FAQ = DATA.faq || [];

  var CART_KEY = 'igdemo_fashion_cart_v1';
  var ORDERS_KEY = 'igdemo_fashion_orders_v1';
  var DELIVERY_FEE = (DATA.delivery && DATA.delivery.fee) || 8;
  var FREE_FROM = (DATA.delivery && DATA.delivery.freeFrom) || 200;

  var STATUSES = [
    { id: 'new', title: 'Новый' },
    { id: 'accepted', title: 'Принят' },
    { id: 'done', title: 'Выполнен' },
    { id: 'canceled', title: 'Отменён' }
  ];

  var ICONS = {
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    filter: '<path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/>',
    ruler: '<path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0L2.7 16.7a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4Z"/><path d="m7.5 10.5 2 2"/><path d="m10.5 7.5 2 2"/><path d="m13.5 4.5 2 2"/><path d="m4.5 13.5 2 2"/>',
    'map-pin': '<path d="M20 10c0 4.4-6.1 10.3-7.4 11.5a1 1 0 0 1-1.2 0C10.1 20.3 4 14.4 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.6a1 1 0 0 0-.2-.6l-3.5-4.4A1 1 0 0 0 17.5 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    package: '<path d="M11 21.7a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    'trash-2': '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'shopping-bag': '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>',
    instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4Z"/><path d="M17.5 6.5h.01"/>',
    sparkles: '<path d="M9.9 15.5a2 2 0 0 0-1.4-1.44L2.36 12.5a.5.5 0 0 1 0-.96l6.14-1.6A2 2 0 0 0 9.9 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    star: '<path d="M11.5 3.6a.6.6 0 0 1 1 0l2.4 4.9 5.4.8a.6.6 0 0 1 .3 1l-3.9 3.8.9 5.3a.6.6 0 0 1-.9.7l-4.8-2.5-4.8 2.5a.6.6 0 0 1-.9-.7l.9-5.3L3.4 10.3a.6.6 0 0 1 .3-1l5.4-.8z"/>'
  };

  function icon(name, cls) {
    var body = ICONS[name] || ICONS.sparkles;
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" stroke="currentColor" ' +
      'stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
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

  function getProduct(id) {
    for (var i = 0; i < PRODUCTS.length; i++) { if (PRODUCTS[i].id === id) { return PRODUCTS[i]; } }
    return null;
  }

  function catTitle(id) {
    for (var i = 0; i < CATEGORIES.length; i++) { if (CATEGORIES[i].id === id) { return CATEGORIES[i].title; } }
    return id;
  }

  function colorTitle(id) {
    for (var i = 0; i < COLORS.length; i++) { if (COLORS[i].id === id) { return COLORS[i].title; } }
    return id;
  }

  function colorHex(id) {
    for (var i = 0; i < COLORS.length; i++) { if (COLORS[i].id === id) { return COLORS[i].hex; } }
    return '#dcdcdc';
  }

  function getPoint(id) {
    for (var i = 0; i < POINTS.length; i++) { if (POINTS[i].id === id) { return POINTS[i]; } }
    return null;
  }

  function pointShort(id) {
    var point = getPoint(id);
    return point ? point.short : 'точке';
  }

  /* предложный падеж: «есть в Призме», «нет в МОМО» */
  function pointPrep(id) {
    var point = getPoint(id);
    if (!point) { return 'точке'; }
    return point.prep || point.short;
  }

  function dayKey(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function todayISO() { return dayKey(new Date()); }

  function dateLabel(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return '—'; }
    return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ', ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function productStock(product, pointId) {
    if (!product || !product.stock) { return 0; }
    return Number(product.stock[pointId] || 0);
  }

  function stockTotal(product) {
    var sum = 0;
    POINTS.forEach(function (point) { sum += productStock(product, point.id); });
    return sum;
  }

  /* ============================ хранилище ============================ */

  var memory = {};

  var store = (function () {
    try {
      var probe = '__linia_probe__';
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

  function lineKey(id, size, color) {
    return String(id) + '|' + String(size || '') + '|' + String(color || '');
  }

  function readCart() {
    var list = lsGet(CART_KEY, []);
    if (!Array.isArray(list)) { return []; }
    return list.filter(function (item) {
      return item && item.id && Number(item.price) >= 0;
    }).map(function (item) {
      var size = String(item.size || '');
      var color = String(item.color || '');
      return {
        key: String(item.key || lineKey(item.id, size, color)),
        id: String(item.id),
        name: String(item.name || 'Товар'),
        price: Math.round(Number(item.price) || 0),
        qty: Math.max(1, Math.round(Number(item.qty) || 1)),
        size: size,
        color: color,
        img: item.img || 'assets/img/hero.jpg'
      };
    });
  }

  function writeCart(items) {
    lsSet(CART_KEY, items);
    document.dispatchEvent(new CustomEvent('linia:cart', { detail: { count: cartCount() } }));
    updateCartBadges();
  }

  function cartCount() {
    return readCart().reduce(function (sum, item) { return sum + item.qty; }, 0);
  }

  function cartSubtotal() {
    return readCart().reduce(function (sum, item) { return sum + item.price * item.qty; }, 0);
  }

  function deliveryFor(subtotal, method) {
    if (method === 'delivery' && subtotal > 0) { return subtotal >= FREE_FROM ? 0 : DELIVERY_FEE; }
    return 0;
  }

  function addToCart(item, qty) {
    var list = readCart();
    var add = Math.max(1, Math.round(Number(qty) || 1));
    var key = lineKey(item.id, item.size, item.color);
    var found = null;
    for (var i = 0; i < list.length; i++) { if (list[i].key === key) { found = list[i]; } }
    if (found) {
      found.qty = Math.min(99, found.qty + add);
    } else {
      list.push({
        key: key,
        id: String(item.id),
        name: String(item.name || 'Товар'),
        price: Math.round(Number(item.price) || 0),
        qty: add,
        size: String(item.size || ''),
        color: String(item.color || ''),
        img: item.img || 'assets/img/hero.jpg'
      });
    }
    writeCart(list);
    return cartCount();
  }

  function setQty(key, qty) {
    var list = readCart();
    var next = [];
    list.forEach(function (item) {
      if (item.key === key) {
        var value = Math.round(Number(qty) || 0);
        if (value > 0) { item.qty = Math.min(99, value); next.push(item); }
      } else {
        next.push(item);
      }
    });
    writeCart(next);
  }

  function removeFromCart(key) {
    writeCart(readCart().filter(function (item) { return item.key !== key; }));
  }

  function clearCart() { writeCart([]); }

  /* наличие всей корзины в точке */
  function availabilityFor(pointId) {
    var missing = [];
    readCart().forEach(function (item) {
      var product = getProduct(item.id);
      if (product && productStock(product, pointId) <= 0) { missing.push(item.name); }
    });
    return { missing: missing, ok: missing.length === 0 };
  }

  /* ============================ заказы ============================ */

  function readOrders() {
    var list = lsGet(ORDERS_KEY, []);
    if (!Array.isArray(list)) { return []; }
    return list.filter(function (o) { return o && o.number; }).sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  function saveOrders(list) { lsSet(ORDERS_KEY, list); }

  function nextOrderNumber() {
    var list = readOrders();
    var used = {};
    list.forEach(function (o) { used[String(o.number)] = true; });
    var candidate = Number(String(Date.now()).slice(-4));
    var guard = 0;
    while (used[String(candidate)] && guard < 60) {
      candidate = candidate + 1 > 9999 ? 1000 : candidate + 1;
      guard++;
    }
    return candidate;
  }

  function createOrder(payload) {
    var order = {
      number: nextOrderNumber(),
      createdAt: new Date().toISOString(),
      status: 'new',
      name: payload.name,
      phone: payload.phone,
      method: payload.method,
      point: payload.point || '',
      address: payload.address || '',
      date: payload.date || '',
      slot: payload.slot || '',
      comment: payload.comment || '',
      items: payload.items.map(function (item) {
        return {
          name: item.name,
          size: item.size || '',
          color: item.color || '',
          price: item.price,
          qty: item.qty
        };
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

  function methodLabel(order) {
    if (order.method === 'pickup') { return 'Самовывоз · ' + pointShort(order.point); }
    return 'Доставка: ' + (order.address || 'адрес не указан');
  }

  function ordersToCsv(list) {
    var head = ['Номер', 'Дата', 'Статус', 'Имя', 'Телефон', 'Получение', 'Точка', 'Адрес',
      'Дата получения', 'Время', 'Состав', 'Сумма', 'Доставка', 'Итого', 'Комментарий'];
    function cell(value) {
      var text = String(value == null ? '' : value).replace(/"/g, '""');
      return '"' + text + '"';
    }
    var rows = [head.map(cell).join(';')];
    list.forEach(function (o) {
      var composition = (o.items || []).map(function (item) {
        var opts = [];
        if (item.size) { opts.push('размер ' + item.size); }
        if (item.color) { opts.push(item.color); }
        return item.name + (opts.length ? ' (' + opts.join(', ') + ')' : '') + ' × ' + item.qty;
      }).join(' | ');
      rows.push([
        '№' + o.number,
        dateLabel(o.createdAt),
        statusTitle(o.status),
        o.name,
        o.phone,
        o.method === 'pickup' ? 'Самовывоз' : 'Доставка по Минску',
        o.method === 'pickup' ? pointShort(o.point) : '—',
        o.method === 'delivery' ? (o.address || '—') : '—',
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
    toast._timer = window.setTimeout(function () { el.classList.remove('is-visible'); }, 2800);
  }

  function imageMarkup(src, alt, cls) {
    return '<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async"' +
      (cls ? ' class="' + cls + '"' : '') + '>';
  }

  function swatch(id) {
    return '<span class="swatch" style="background:' + esc(colorHex(id)) + '" title="' + esc(colorTitle(id)) + '"></span>';
  }

  function stockMarkup(product) {
    return '<div class="stock">' + POINTS.map(function (point) {
      var count = productStock(product, point.id);
      return '<p class="stock__line">' +
        '<span class="stock__dot' + (count > 0 ? '' : ' stock__dot--none') + '"></span>' +
        (count > 0
          ? 'Есть в ' + esc(pointPrep(point.id)) + ' — <b>' + count + ' ' + plural(count, 'шт.', 'шт.', 'шт.') + '</b>'
          : 'Нет в ' + esc(pointPrep(point.id))) +
        '</p>';
    }).join('') + '</div>';
  }

  function productCard(product, chosen) {
    var sizes = product.sizes || [];
    var selected = chosen && sizes.indexOf(chosen) !== -1 ? chosen : (sizes.length ? sizes[0] : '');
    var sizeHtml = sizes.map(function (size) {
      return '<button class="size-chip" type="button" data-action="pick-size" data-id="' + esc(product.id) +
        '" data-size="' + esc(size) + '" aria-pressed="' + (size === selected ? 'true' : 'false') + '">' +
        esc(size) + '</button>';
    }).join('');
    var badge = product.badge
      ? '<span class="badge card__badge">' + esc(product.badge) + '</span>'
      : '';
    var swatches = (product.colors || []).map(function (id) { return swatch(id); }).join('');

    return '' +
      '<article class="card reveal" data-product="' + esc(product.id) + '">' +
        '<div class="card__media">' + badge + imageMarkup(product.img, product.alt) + '</div>' +
        '<div class="card__body">' +
          '<div class="card__top">' +
            '<p class="tiny muted">' + esc(catTitle(product.cat)) + '</p>' +
            '<span class="price">' + byn(product.price) +
              (product.oldPrice ? '<s>' + byn(product.oldPrice) + '</s>' : '') + '</span>' +
          '</div>' +
          stockMarkup(product) +
          '<h3 class="card__title">' + esc(product.name) + '</h3>' +
          '<p class="card__desc">' + esc(product.short) + '</p>' +
          '<p class="card__fabric">' + esc(product.fabric) + '</p>' +
          '<div class="size-row" role="group" aria-label="Размер для ' + esc(product.name) + '">' + sizeHtml + '</div>' +
          '<div class="swatches">' + swatches +
            '<span class="swatch-label">' + esc((product.colors || []).map(colorTitle).join(' · ')) + '</span>' +
          '</div>' +
          '<div class="card__foot">' +
            '<button class="btn btn--sm" type="button" data-action="add" data-id="' + esc(product.id) + '">' +
              icon('plus') + 'В корзину</button>' +
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

  /* ============================ шапка, меню, появление ============================ */

  function initHeader() {
    var burger = $('[data-action="menu"]');
    var panel = $('#mobile-nav');
    if (!burger || !panel) { return; }
    function close() {
      panel.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      panel.setAttribute('aria-hidden', 'true');
    }
    burger.addEventListener('click', function () {
      var open = panel.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    });
    $$('a', panel).forEach(function (link) { link.addEventListener('click', close); });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { close(); }
    });
  }

  function initReveal() {
    var nodes = $$('.reveal:not(.is-visible)');
    if (!nodes.length) { return; }
    var viewport = window.innerHeight || 0;

    /* То, что уже видно на первом экране, показываем сразу, без анимации:
       иначе первый кадр выглядит полупрозрачным. */
    function instantly(node) {
      node.classList.add('reveal--instant');
      node.classList.add('is-visible');
    }

    if (!('IntersectionObserver' in window)) {
      nodes.forEach(instantly);
      return;
    }

    var pending = [];
    nodes.forEach(function (node) {
      var rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
      if (!rect || !viewport || rect.top < viewport) { instantly(node); } else { pending.push(node); }
    });
    if (!pending.length) { return; }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    pending.forEach(function (n) { observer.observe(n); });
  }

  function initFooterYear() {
    $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
  }

  /* выбор размера в карточке: запоминаем в памяти страницы */
  var pickedSizes = {};

  function initCardActions() {
    document.addEventListener('click', function (event) {
      if (!event.target.closest) { return; }
      var pick = event.target.closest('[data-action="pick-size"]');
      if (pick) {
        var card = pick.closest('.card');
        var id = pick.getAttribute('data-id');
        pickedSizes[id] = pick.getAttribute('data-size');
        if (card) {
          $$('[data-action="pick-size"]', card).forEach(function (el) {
            el.setAttribute('aria-pressed', el === pick ? 'true' : 'false');
          });
        }
        return;
      }
      var btn = event.target.closest('[data-action="add"]');
      if (!btn) { return; }
      var product = getProduct(btn.getAttribute('data-id'));
      if (!product) { return; }
      var size = pickedSizes[product.id] || (product.sizes || [])[0] || '';
      var color = (product.colors || [])[0] || '';
      var count = addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        size: size,
        color: color,
        img: product.img
      }, 1);
      toast('«' + product.name + '», размер ' + size + ' — в корзине, ' + count + ' ' +
        plural(count, 'позиция', 'позиции', 'позиций'));
    });
  }

  /* ============================ главная ============================ */

  function initFeatured() {
    var grid = $('#featured');
    if (!grid) { return; }
    var picked = PRODUCTS.slice().sort(function (a, b) { return (b.pop || 0) - (a.pop || 0); }).slice(0, 4);
    grid.innerHTML = picked.map(function (product) { return productCard(product); }).join('');
    initReveal();
  }

  function initServices() {
    var host = $('#services');
    if (!host) { return; }
    host.innerHTML = SERVICES.map(function (service) {
      return '' +
        '<article class="feature reveal">' +
          '<span class="feature__icon" aria-hidden="true">' + icon(service.icon, 'icon--lg') + '</span>' +
          '<div>' +
            '<h3>' + esc(service.title) + '</h3>' +
            '<p class="small muted">' + esc(service.text) + '</p>' +
          '</div>' +
        '</article>';
    }).join('');
    initReveal();
  }

  function initPoints() {
    var host = $('#points');
    if (!host) { return; }
    host.innerHTML = POINTS.map(function (point) {
      return '' +
        '<article class="point-card reveal">' +
          '<div class="point-card__top">' +
            '<span class="point-card__tag" aria-hidden="true">' + esc(point.short.slice(0, 3).toUpperCase()) + '</span>' +
            '<div>' +
              '<h3>' + esc(point.title) + '</h3>' +
              '<p class="tiny muted">' + esc(point.mall) + '</p>' +
            '</div>' +
          '</div>' +
          '<dl>' +
            '<div><dt>Адрес</dt><dd>' + esc(point.address) + '</dd></div>' +
            '<div><dt>Часы</dt><dd>' + esc(point.hours) + '</dd></div>' +
            '<div><dt>Телефон</dt><dd><a href="' + esc(SHOP.phoneHref) + '">' + esc(point.phone) + '</a></dd></div>' +
          '</dl>' +
          '<p class="small muted">' + esc(point.note) + '</p>' +
          '<div class="point-card__foot">' +
            '<a class="btn btn--ghost btn--sm" href="catalog.html?point=' + esc(point.id) + '">' +
              icon('arrow-right') + 'Товары этой точки</a>' +
          '</div>' +
        '</article>';
    }).join('');
    initReveal();
  }

  function initFaq() {
    var host = $('#faq');
    if (!host) { return; }
    host.innerHTML = FAQ.map(function (item) {
      return '<details><summary>' + esc(item.q) + '</summary><p>' + esc(item.a) + '</p></details>';
    }).join('');
  }

  /* ============================ размерная сетка (модальное окно) ============================ */

  function initSizeModal() {
    var modal = $('#size-modal');
    if (!modal) { return; }
    var chart = DATA.sizeChart || { head: [], rows: [], tips: [] };
    var body = $('#size-modal-body');
    if (body) {
      body.innerHTML = '' +
        '<div>' +
          '<table class="size-table">' +
            '<thead><tr>' + (chart.head || []).map(function (cell) {
              return '<th scope="col">' + esc(cell) + '</th>';
            }).join('') + '</tr></thead>' +
            '<tbody>' + (chart.rows || []).map(function (row) {
              return '<tr>' + row.map(function (cell) { return '<td>' + esc(cell) + '</td>'; }).join('') + '</tr>';
            }).join('') + '</tbody>' +
          '</table>' +
        '</div>' +
        '<ul class="size-tips">' + (chart.tips || []).map(function (tip) {
          return '<li>' + icon('check') + '<span>' + esc(tip) + '</span></li>';
        }).join('') + '</ul>';
    }

    var lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      var close = $('[data-action="close-modal"]', modal);
      if (close) { close.focus(); }
    }

    function close() {
      modal.hidden = true;
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
    }

    document.addEventListener('click', function (event) {
      if (!event.target.closest) { return; }
      if (event.target.closest('[data-action="size-chart"]')) {
        event.preventDefault();
        open();
        return;
      }
      if (event.target.closest('[data-action="close-modal"]') || event.target === modal) {
        close();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !modal.hidden) { close(); }
    });
  }

  /* ============================ каталог ============================ */

  function initCatalog() {
    var grid = $('#catalog-grid');
    if (!grid) { return; }

    var params = {};
    try {
      var query = String(window.location.search || '').replace(/^\?/, '');
      query.split('&').forEach(function (pair) {
        var parts = pair.split('=');
        if (parts[0]) { params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || ''); }
      });
    } catch (err) { params = {}; }

    var state = {
      cat: 'all',
      size: 'all',
      color: 'all',
      price: 'all',
      point: params.point && getPoint(params.point) ? params.point : 'all',
      q: '',
      sort: 'pop'
    };

    var priceBuckets = [
      { id: 'low', title: 'до 150 BYN' },
      { id: 'mid', title: '150–250 BYN' },
      { id: 'high', title: 'от 250 BYN' }
    ];

    var pointBuckets = [].concat(POINTS.map(function (point) {
      return { id: point.id, title: 'Есть в ' + (point.prep || point.short) };
    }));

    var sortOptions = [
      { id: 'pop', title: 'Сначала популярные' },
      { id: 'cheap', title: 'Сначала дешёвые' },
      { id: 'expensive', title: 'Сначала дорогие' },
      { id: 'name', title: 'По названию' }
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

    function sizeChips() {
      var host = $('#filter-size');
      if (!host) { return; }
      var html = '<button class="chip" type="button" data-filter="size" data-value="all" aria-pressed="' +
        (state.size === 'all' ? 'true' : 'false') + '">Любой размер</button>';
      html += (DATA.sizes || []).concat(['OS']).map(function (size) {
        return '<button class="chip" type="button" data-filter="size" data-value="' + esc(size) +
          '" aria-pressed="' + (state.size === size ? 'true' : 'false') + '">' + esc(size) + '</button>';
      }).join('');
      host.innerHTML = html;
    }

    function colorChips() {
      var host = $('#filter-color');
      if (!host) { return; }
      var html = '<button class="chip" type="button" data-filter="color" data-value="all" aria-pressed="' +
        (state.color === 'all' ? 'true' : 'false') + '">Любой цвет</button>';
      html += COLORS.map(function (color) {
        return '<button class="chip chip--color" type="button" data-filter="color" data-value="' + esc(color.id) +
          '" aria-pressed="' + (state.color === color.id ? 'true' : 'false') + '">' +
          '<span class="swatch swatch--chip" style="background:' + esc(color.hex) + '"></span>' +
          esc(color.title) + '</button>';
      }).join('');
      host.innerHTML = html;
    }

    function renderChips() {
      chips($('#filter-cat'), CATEGORIES, 'cat', 'Всё');
      chips($('#filter-price'), priceBuckets, 'price', 'Любая цена');
      chips($('#filter-point'), pointBuckets, 'point', 'Обе точки');
      sizeChips();
      colorChips();
    }

    function match(product) {
      if (state.cat !== 'all' && product.cat !== state.cat) { return false; }
      if (state.size !== 'all' && (product.sizes || []).indexOf(state.size) === -1) { return false; }
      if (state.color !== 'all' && (product.colors || []).indexOf(state.color) === -1) { return false; }
      if (state.point !== 'all' && productStock(product, state.point) <= 0) { return false; }
      if (state.price === 'low' && product.price >= 150) { return false; }
      if (state.price === 'mid' && (product.price < 150 || product.price > 250)) { return false; }
      if (state.price === 'high' && product.price <= 250) { return false; }
      if (state.q) {
        var haystack = (product.name + ' ' + product.short + ' ' + product.fabric + ' ' +
          (product.sizes || []).join(' ') + ' ' + catTitle(product.cat) + ' ' +
          (product.colors || []).map(colorTitle).join(' ')).toLowerCase();
        if (haystack.indexOf(state.q.toLowerCase()) === -1) { return false; }
      }
      return true;
    }

    function sortList(list) {
      var copy = list.slice();
      if (state.sort === 'cheap') { copy.sort(function (a, b) { return a.price - b.price; }); }
      else if (state.sort === 'expensive') { copy.sort(function (a, b) { return b.price - a.price; }); }
      else if (state.sort === 'name') { copy.sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); }); }
      else { copy.sort(function (a, b) { return (b.pop || 0) - (a.pop || 0); }); }
      return copy;
    }

    function activeSummary() {
      var parts = [];
      if (state.cat !== 'all') { parts.push(catTitle(state.cat)); }
      if (state.size !== 'all') { parts.push('размер ' + state.size); }
      if (state.color !== 'all') { parts.push(colorTitle(state.color).toLowerCase()); }
      if (state.point !== 'all') { parts.push('есть в ' + pointPrep(state.point)); }
      if (state.price !== 'all') {
        for (var i = 0; i < priceBuckets.length; i++) {
          if (priceBuckets[i].id === state.price) { parts.push(priceBuckets[i].title.toLowerCase()); }
        }
      }
      if (state.q) { parts.push('поиск: «' + state.q + '»'); }
      return parts;
    }

    function render() {
      var found = sortList(PRODUCTS.filter(match));
      var counter = $('#catalog-count');
      if (counter) {
        counter.textContent = found.length
          ? 'Найдено ' + found.length + ' ' + plural(found.length, 'модель', 'модели', 'моделей') +
            ' из ' + PRODUCTS.length
          : 'Ничего не найдено';
      }

      var summary = $('#active-filters');
      if (summary) {
        var parts = activeSummary();
        summary.innerHTML = parts.length
          ? '<span>Фильтры:</span> ' + parts.map(function (part) {
              return '<span class="badge">' + esc(part) + '</span>';
            }).join('') +
            '<button class="filter-reset" type="button" data-action="reset-filters">Сбросить</button>'
          : '<span>Фильтры не выбраны — показан весь каталог.</span>';
      }

      if (!found.length) {
        grid.innerHTML = '' +
          '<div class="empty grid-empty">' +
            icon('search', 'icon--xl') +
            '<h3>Ничего не найдено</h3>' +
            '<p class="small">Попробуйте другой размер, цвет или точку — или сбросьте фильтры: ' +
              'в зале обычно висит больше, чем попало в подборку.</p>' +
            '<button class="btn btn--sm" type="button" data-action="reset-filters">Сбросить фильтры</button>' +
          '</div>';
        return;
      }
      grid.innerHTML = found.map(function (product) { return productCard(product, pickedSizes[product.id]); }).join('');
      initReveal();
    }

    renderChips();
    render();

    $$('#filter-cat, #filter-price, #filter-point, #filter-size, #filter-color').forEach(function (host) {
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
      sortOptions.forEach(function (option) {
        var el = document.createElement('option');
        el.value = option.id;
        el.textContent = option.title;
        sort.appendChild(el);
      });
      sort.value = state.sort;
      sort.addEventListener('change', function () {
        state.sort = sort.value;
        render();
      });
    }

    function reset() {
      state.cat = 'all';
      state.size = 'all';
      state.color = 'all';
      state.price = 'all';
      state.point = 'all';
      state.q = '';
      state.sort = 'pop';
      if (search) { search.value = ''; }
      if (sort) { sort.value = 'pop'; }
      renderChips();
      render();
    }

    var resetBtn = $('#catalog-reset');
    if (resetBtn) { resetBtn.addEventListener('click', reset); }

    document.addEventListener('click', function (event) {
      var btn = event.target.closest ? event.target.closest('[data-action="reset-filters"]') : null;
      if (btn) { reset(); }
    });
  }

  /* ============================ корзина и оформление ============================ */

  function initCartPage() {
    var root = $('#cart-page');
    if (!root) { return; }

    var method = 'pickup';
    var point = POINTS.length ? POINTS[0].id : '';

    function renderMethodFields() {
      var pointWrap = $('#field-point');
      var addressWrap = $('#field-address');
      var slotWrap = $('#field-slot');
      if (pointWrap) { pointWrap.hidden = method !== 'pickup'; }
      if (addressWrap) { addressWrap.hidden = method !== 'delivery'; }
      if (slotWrap) { slotWrap.hidden = method !== 'delivery'; }
    }

    function renderAvailability() {
      var host = $('#cart-availability');
      if (!host) { return; }
      if (method !== 'pickup' || !point) { host.innerHTML = ''; host.hidden = true; return; }
      host.hidden = false;
      var info = availabilityFor(point);
      var pointObj = getPoint(point) || { short: 'точке', prep: 'точке', hours: '', address: '' };
      if (info.ok) {
        host.innerHTML = '<p class="small">' + icon('check') + ' Все позиции есть в ' + esc(pointPrep(point)) +
          '. Соберём за 2 часа: ' + esc(pointObj.address) + '.</p>';
      } else {
        host.innerHTML = '<p class="small">' + icon('clock') + ' В ' + esc(pointPrep(point)) + ' нет: ' +
          esc(info.missing.join(', ')) + '. Привезём из второй точки за 1 день или заменим на похожее — ' +
          'напишем после заказа.</p>';
      }
    }

    function render() {
      var items = readCart();
      var layout = $('#cart-layout');
      var emptyBox = $('#cart-empty');
      var success = $('#order-success');

      if (!items.length) {
        if (layout) { layout.hidden = true; }
        if (emptyBox) { emptyBox.hidden = false; }
        updateCartBadges();
        return;
      }
      if (layout) { layout.hidden = false; }
      if (emptyBox) { emptyBox.hidden = true; }
      if (success && !success.hidden) { success.hidden = true; }

      var sub = cartSubtotal();
      var fee = deliveryFor(sub, method);

      var list = $('#cart-items');
      if (list) {
        list.innerHTML = items.map(function (item) {
          return '' +
            '<li class="cart-line" data-key="' + esc(item.key) + '">' +
              '<div class="cart-line__media">' + imageMarkup(item.img, item.name) + '</div>' +
              '<div class="cart-line__body">' +
                '<h3 class="card__title">' + esc(item.name) + '</h3>' +
                '<p class="cart-line__opts">' +
                  (item.size ? '<span>Размер: <b>' + esc(item.size) + '</b></span>' : '') +
                  (item.color ? '<span>Цвет: ' + swatch(item.color) + ' ' + esc(colorTitle(item.color)) + '</span>' : '') +
                  '<span>' + byn(item.price) + ' за штуку</span>' +
                '</p>' +
                '<div class="cart-line__controls">' +
                  '<button class="icon-btn icon-btn--sm" type="button" data-action="dec" data-key="' + esc(item.key) + '" aria-label="Убрать одну штуку">' +
                    icon('minus') + '</button>' +
                  '<span class="qty" aria-live="polite">' + item.qty + '</span>' +
                  '<button class="icon-btn icon-btn--sm" type="button" data-action="inc" data-key="' + esc(item.key) + '" aria-label="Добавить одну штуку">' +
                    icon('plus') + '</button>' +
                  '<button class="icon-btn icon-btn--sm" type="button" data-action="remove" data-key="' + esc(item.key) + '" aria-label="Удалить ' + esc(item.name) + ' из корзины">' +
                    icon('trash-2') + '</button>' +
                '</div>' +
              '</div>' +
              '<div class="cart-line__sum">' + byn(item.price * item.qty) + '</div>' +
            '</li>';
        }).join('');
      }

      var subEl = $('#sum-subtotal');
      var feeEl = $('#sum-delivery');
      var totalEl = $('#sum-total');
      if (subEl) { subEl.textContent = byn(sub); }
      if (feeEl) { feeEl.textContent = method !== 'delivery' ? 'самовывоз — бесплатно' : (fee === 0 ? 'бесплатно' : byn(fee)); }
      if (totalEl) { totalEl.textContent = byn(sub + fee); }

      var hint = $('#delivery-hint');
      if (hint) {
        if (method !== 'delivery') {
          hint.textContent = 'Самовывоз из точки — бесплатно, собираем за 2 часа.';
        } else if (fee === 0) {
          hint.textContent = 'Доставка по Минску бесплатная — заказ от ' + byn(FREE_FROM) + '.';
        } else {
          hint.textContent = 'До бесплатной доставки осталось ' + byn(FREE_FROM - sub) + '. Доставка по Минску — ' +
            byn(DELIVERY_FEE) + ', ' + (DATA.delivery && DATA.delivery.time ? DATA.delivery.time : '1–2 дня') + '.';
        }
      }
      var bar = $('#delivery-bar');
      if (bar) { bar.style.width = Math.min(100, Math.round((sub / FREE_FROM) * 100)) + '%'; }

      var submit = $('#checkout-submit');
      var label = submit ? submit.querySelector('[data-submit-label]') : null;
      if (label) { label.textContent = 'Оформить заказ · ' + byn(sub + fee); }

      renderAvailability();
      updateCartBadges();
    }

    root.addEventListener('click', function (event) {
      var btn = event.target.closest ? event.target.closest('[data-action]') : null;
      if (!btn) { return; }
      var action = btn.getAttribute('data-action');
      var key = btn.getAttribute('data-key');
      if (action === 'inc' || action === 'dec') {
        var current = 1;
        readCart().forEach(function (item) { if (item.key === key) { current = item.qty; } });
        setQty(key, action === 'inc' ? current + 1 : current - 1);
        render();
      } else if (action === 'remove') {
        removeFromCart(key);
        render();
        toast('Позиция удалена из корзины');
      } else if (action === 'clear-cart') {
        clearCart();
        render();
        toast('Корзина очищена');
      }
    });

    $$('input[name="method"]').forEach(function (input) {
      input.addEventListener('change', function () {
        method = input.value;
        renderMethodFields();
        render();
      });
    });

    var pointSelect = $('#field-point-select');
    if (pointSelect) {
      POINTS.forEach(function (item) {
        var option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.title + ' — ' + item.address;
        pointSelect.appendChild(option);
      });
      pointSelect.value = point;
      pointSelect.addEventListener('change', function () {
        point = pointSelect.value;
        render();
      });
    }

    var dateInput = $('#field-date');
    if (dateInput) {
      dateInput.min = todayISO();
      if (!dateInput.value) { dateInput.value = todayISO(); }
    }

    function showError(field, message) {
      var box = $('#error-' + field);
      if (!box) { return; }
      box.textContent = message;
      box.hidden = !message;
    }

    var form = $('#checkout-form');
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var items = readCart();
        if (!items.length) {
          toast('Сначала добавьте товар в корзину');
          return;
        }
        var name = (($('#field-name') || {}).value || '').trim();
        var phone = (($('#field-phone') || {}).value || '').trim();
        var address = method === 'delivery' ? ((($('#field-address-input') || {}).value || '').trim()) : '';
        var date = (($('#field-date') || {}).value || '');
        var slot = method === 'delivery' ? ((($('#field-slot-select') || {}).value || '')) : '';
        var comment = (($('#field-comment') || {}).value || '').trim();

        var ok = true;
        if (name.length < 2) { showError('name', 'Напишите, как к вам обращаться'); ok = false; }
        else { showError('name', ''); }

        var digits = phone.replace(/[^\d]/g, '');
        if (!/^375(17|25|29|33|44)\d{7}$/.test(digits)) {
          showError('phone', 'Телефон в формате +375 (29) 123-45-67'); ok = false;
        } else { showError('phone', ''); }

        if (method === 'delivery' && address.length < 5) {
          showError('address', 'Улица, дом и квартира — чтобы курьер не искал'); ok = false;
        } else { showError('address', ''); }

        if (!date) { showError('date', 'Выберите дату'); ok = false; } else { showError('date', ''); }
        if (!ok) { return; }

        var sub = cartSubtotal();
        var fee = deliveryFor(sub, method);
        var order = createOrder({
          name: name,
          phone: phone,
          method: method,
          point: method === 'pickup' ? point : '',
          address: address,
          date: date,
          slot: slot,
          comment: comment,
          items: items,
          subtotal: sub,
          delivery: fee,
          total: sub + fee
        });

        clearCart();
        updateCartBadges();
        form.reset();
        method = 'pickup';
        renderMethodFields();

        var success = $('#order-success');
        if (success) {
          success.hidden = false;
          var num = $('#success-number');
          if (num) { num.textContent = '№' + order.number; }
          var summary = $('#success-summary');
          if (summary) {
            summary.innerHTML = '' +
              '<li><span>Товары</span><strong>' + byn(order.subtotal) + '</strong></li>' +
              '<li><span>' + (order.method === 'pickup' ? 'Самовывоз' : 'Доставка') + '</span><strong>' +
                (order.delivery === 0 ? 'бесплатно' : byn(order.delivery)) + '</strong></li>' +
              '<li class="summary-total"><span>Итого</span><strong>' + byn(order.total) + '</strong></li>' +
              '<li><span>Получение</span><strong>' + esc(order.method === 'pickup'
                ? pointShort(order.point) + ', ' + ((getPoint(order.point) || {}).address || '')
                : order.address) + '</strong></li>' +
              '<li><span>Дата</span><strong>' + esc(order.date) + (order.slot ? ', ' + esc(order.slot) : '') + '</strong></li>';
          }
          success.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        toast('Заказ №' + order.number + ' принят — позвоним в течение 15 минут');
        render();
      });
    }

    document.addEventListener('linia:cart', render);
    window.addEventListener('storage', function (event) {
      if (event.key === CART_KEY) { render(); }
    });

    renderMethodFields();
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

      var el;
      el = $('#stat-today'); if (el) { el.textContent = String(todayOrders.length); }
      el = $('#stat-revenue'); if (el) { el.textContent = byn(revenue); }
      el = $('#stat-active'); if (el) { el.textContent = String(active); }
      el = $('#stat-total'); if (el) { el.textContent = String(orders.length); }
    }

    function renderOrders(orders) {
      var host = $('#orders-list');
      var empty = $('#orders-empty');
      if (!host) { return; }
      var shown = statusFilter === 'all' ? orders : orders.filter(function (o) { return o.status === statusFilter; });

      if (!orders.length) {
        host.innerHTML = '';
        if (empty) { empty.hidden = false; }
        return;
      }
      if (empty) { empty.hidden = true; }

      if (!shown.length) {
        host.innerHTML = '<div class="empty"><p class="small">Заказов с этим статусом пока нет. ' +
          'Выберите другой статус или «Все заказы».</p></div>';
        return;
      }

      host.innerHTML = shown.map(function (order) {
        var items = (order.items || []).map(function (item) {
          var opts = [];
          if (item.size) { opts.push('размер ' + item.size); }
          if (item.color) { opts.push(item.color); }
          return '<li>' +
            '<span>' + esc(item.name) + (opts.length ? ' <span class="tiny muted">(' + esc(opts.join(', ')) + ')</span>' : '') + '</span>' +
            '<span class="tiny muted">× ' + item.qty + '</span>' +
            '<span>' + byn(item.price * item.qty) + '</span>' +
          '</li>';
        }).join('');

        var buttons = STATUSES.map(function (status) {
          var active = order.status === status.id;
          return '<button class="chip chip--status" type="button" data-action="status" data-status="' + status.id +
            '" data-number="' + esc(order.number) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
            esc(status.title) + '</button>';
        }).join('');

        return '' +
          '<article class="order card reveal" data-number="' + esc(order.number) + '">' +
            '<header class="order__head">' +
              '<div>' +
                '<h3>Заказ №' + esc(order.number) + '</h3>' +
                '<p class="tiny muted">' + esc(dateLabel(order.createdAt)) + '</p>' +
              '</div>' +
              '<span class="badge ' + (order.status === 'done' ? 'badge--ok' : order.status === 'canceled' ? 'badge--warn' : '') + '">' +
                esc(statusTitle(order.status)) + '</span>' +
            '</header>' +
            '<ul class="order__items">' + items + '</ul>' +
            '<div class="order__meta">' +
              '<p><strong>' + esc(order.name) + '</strong> · ' + esc(order.phone) + '</p>' +
              '<p class="small muted">' + esc(methodLabel(order)) + '</p>' +
              '<p class="small muted">Дата: ' + esc(order.date || '—') + (order.slot ? ', ' + esc(order.slot) : '') + '</p>' +
              (order.comment ? '<p class="small muted">Комментарий: ' + esc(order.comment) + '</p>' : '') +
            '</div>' +
            '<div class="order__foot">' +
              '<div class="order__sum">' +
                '<span class="tiny muted">Товары ' + byn(order.subtotal) + ' · ' +
                  (order.method === 'pickup' ? 'самовывоз' : 'доставка ' + (order.delivery === 0 ? 'бесплатно' : byn(order.delivery))) +
                '</span>' +
                '<strong>' + byn(order.total) + '</strong>' +
              '</div>' +
              '<div class="order__status" role="group" aria-label="Статус заказа №' + esc(order.number) + '">' + buttons + '</div>' +
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
          ? 'Всего ' + orders.length + ' ' + plural(orders.length, 'заказ', 'заказа', 'заказов')
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
      toast('Заказ №' + number + ' — ' + statusTitle(status).toLowerCase());
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
        if (!orders.length) { toast('Пока нечего экспортировать'); return; }
        var csv = '\ufeff' + ordersToCsv(orders);
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'linia-orders-' + todayISO() + '.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast('Экспортировали ' + orders.length + ' ' + plural(orders.length, 'заказ', 'заказа', 'заказов') + ' в CSV');
      });
    }

    var wipe = $('#clear-orders');
    if (wipe) {
      wipe.addEventListener('click', function () {
        if (!readOrders().length) { toast('Список уже пустой'); return; }
        if (!window.confirm('Удалить все заказы из демо-панели? Это только локальные данные в браузере.')) { return; }
        saveOrders([]);
        render();
        toast('Панель очищена — оформите тестовый заказ на сайте');
      });
    }

    document.addEventListener('linia:cart', render);
    window.addEventListener('storage', function (event) {
      if (event.key === ORDERS_KEY) { render(); }
    });
    window.addEventListener('focus', render);

    render();
  }

  /* ============================ запуск ============================ */

  window.LiniaCore = {
    byn: byn,
    plural: plural,
    getProduct: getProduct,
    productStock: productStock,
    cartSubtotal: cartSubtotal,
    deliveryFor: deliveryFor,
    readCart: readCart,
    addToCart: addToCart,
    setQty: setQty,
    removeFromCart: removeFromCart,
    readOrders: readOrders,
    createOrder: createOrder,
    updateOrderStatus: updateOrderStatus,
    ordersToCsv: ordersToCsv,
    statusTitle: statusTitle,
    FREE_FROM: FREE_FROM,
    DELIVERY_FEE: DELIVERY_FEE,
    keys: { cart: CART_KEY, orders: ORDERS_KEY }
  };

  function boot() {
    updateCartBadges();
    initHeader();
    initFooterYear();
    initCardActions();
    initSizeModal();
    initFeatured();
    initServices();
    initPoints();
    initFaq();
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
