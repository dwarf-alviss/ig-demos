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

  /* Геометрический набор «Линии»: только прямые и ломаные линии, квадратные окончания,
     толщина 1.5, ни одного скругления. Корзина — плетёная, читается однозначно. */
  var ICONS = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 21 21"/>',
    filter: '<path d="M3 5h18"/><path d="M6 10h12"/><path d="M9 15h6"/><path d="M11 20h2"/>',
    ruler: '<path d="M2 9h20v6H2z"/><path d="M6 9v3"/><path d="M10 9v4"/><path d="M14 9v3"/><path d="M18 9v4"/>',
    pin: '<path d="M12 22 4.5 12.5H9V3h6v9.5h4.5z"/><path d="M9.5 6.5h5"/>',
    truck: '<path d="M2 5h11v11H2z"/><path d="M13 8.5h4.5L21 12.5v3.5h-8"/><circle cx="6.5" cy="18.5" r="1.9"/><circle cx="16.5" cy="18.5" r="1.9"/>',
    box: '<path d="M12 2.5 21 7v10l-9 4.5L3 17V7z"/><path d="M3 7l9 4.5L21 7"/><path d="M12 11.5V21.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6.5V12l4.5 2.5"/>',
    check: '<path d="M4 12.5 9.5 18 20 6.5"/>',
    plus: '<path d="M12 4v16"/><path d="M4 12h16"/>',
    minus: '<path d="M4 12h16"/>',
    trash: '<path d="M4 6.5h16"/><path d="M6.5 6.5V21h11V6.5"/><path d="M9 3h6v3.5H9z"/><path d="M10 10.5V17"/><path d="M14 10.5V17"/>',
    close: '<path d="M5 5 19 19"/><path d="M19 5 5 19"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    arrow: '<path d="M2.5 12h18"/><path d="M15 6.5 20.5 12 15 17.5"/>',
    basket: '<path d="M2.5 8h19l-2.2 12.5H4.7z"/><path d="M8.5 8 11 2.5"/><path d="M15.5 8 13 2.5"/><path d="M9 12v5"/><path d="M12 12v5"/><path d="M15 12v5"/>',
    menu: '<path d="M3 6h18"/><path d="M6 12h12"/><path d="M3 18h18"/>',
    phone: '<path d="M5 2.5h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 12.5l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 4.5a2 2 0 0 1 2-2Z"/>',
    mail: '<path d="M2 5h20v14H2z"/><path d="m2 5 10 7 10-7"/>',
    instagram: '<path d="M3 3h18v18H3z"/><circle cx="12" cy="12" r="4.2"/><path d="M17.5 6.5h.01"/>',
    calendar: '<path d="M3 5h18v16H3z"/><path d="M3 10h18"/><path d="M8 2.5v4"/><path d="M16 2.5v4"/>',
    hanger: '<path d="M12 8 2 17h20L12 8Z"/><path d="M12 8V4.5h3"/>',
    tag: '<path d="M3 3h9l9 9-9 9-9-9z"/><path d="M7.5 7.5h.01"/>'
  };

  function icon(name, cls) {
    var body = ICONS[name] || ICONS.tag;
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" stroke="currentColor" ' +
      'stroke-width="1.5" fill="none" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">' + body + '</svg>';
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
    if (order.method === 'pickup') { return 'Самовывоз, ' + pointShort(order.point); }
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
      el.setAttribute('id', 'toast');
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
      return '<p class="stock__line' + (count > 0 ? '' : ' stock__line--none') + '">' +
        '<span class="stock__point">' + esc(point.short) + '</span>' +
        '<span class="stock__qty">' + (count > 0 ? count + ' шт.' : 'нет в зале') + '</span>' +
        '</p>';
    }).join('') + '</div>';
  }

  /* Строка-позиция каталога: номер, фото, характеристики, цена с размерной линейкой.
     Плиток нет — на десктопе это табличная сетка, как разворот печатного каталога. */
  function productCard(product, chosen) {
    var sizes = product.sizes || [];
    var selected = chosen && sizes.indexOf(chosen) !== -1 ? chosen : (sizes.length ? sizes[0] : '');
    var sizeHtml = sizes.map(function (size) {
      return '<button class="size-chip" type="button" data-action="pick-size" data-id="' + esc(product.id) +
        '" data-size="' + esc(size) + '" aria-pressed="' + (size === selected ? 'true' : 'false') + '">' +
        esc(size) + '</button>';
    }).join('');
    var badge = product.badge ? '<span class="badge card__badge">' + esc(product.badge) + '</span>' : '';
    var swatches = (product.colors || []).map(function (id) { return swatch(id); }).join('');

    return '' +
      '<article class="card lookbook__item reveal" data-product="' + esc(product.id) + '">' +
        '<div class="card__media">' + badge + imageMarkup(product.img, product.alt) + '</div>' +
        '<div class="card__body">' +
          '<p class="card__cat">' + esc(catTitle(product.cat)) + '</p>' +
          '<h3 class="card__title">' + esc(product.name) + '</h3>' +
          '<p class="card__desc">' + esc(product.short) + '</p>' +
          '<p class="card__fabric">' + esc(product.fabric) + '</p>' +
          '<div class="swatches">' +
            '<span class="swatches__label">Цвета</span>' + swatches +
          '</div>' +
          stockMarkup(product) +
        '</div>' +
        '<div class="card__side">' +
          '<span class="price">' + byn(product.price) +
            (product.oldPrice ? '<s>' + byn(product.oldPrice) + '</s>' : '') + '</span>' +
          '<div class="size-row" role="group" aria-label="Размер: ' + esc(product.name) + '">' +
            '<span class="size-row__label">Размер</span>' + sizeHtml + '</div>' +
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
      toast(product.name + ', размер ' + size + '. В корзине ' + count + ' ' +
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
    var host = $('#points-list');
    if (!host) { return; }
    host.innerHTML = POINTS.map(function (point, index) {
      return '' +
        '<article class="point-card reveal">' +
          '<div class="point-card__top">' +
            '<span class="point-card__tag" aria-hidden="true">' + pad(index + 1) + '</span>' +
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
    var host = $('#faq-list');
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
      { id: 'pop', title: 'Что уходит первым' },
      { id: 'cheap', title: 'Сначала недорогие' },
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
        (state.size === 'all' ? 'true' : 'false') + '">Все размеры</button>';
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
        (state.color === 'all' ? 'true' : 'false') + '">Все цвета</button>';
      html += COLORS.map(function (color) {
        return '<button class="chip chip--color" type="button" data-filter="color" data-value="' + esc(color.id) +
          '" aria-pressed="' + (state.color === color.id ? 'true' : 'false') + '">' +
          '<span class="swatch swatch--chip" style="background:' + esc(color.hex) + '"></span>' +
          esc(color.title) + '</button>';
      }).join('');
      host.innerHTML = html;
    }

    function renderChips() {
      chips($('#filter-cat'), CATEGORIES, 'cat', 'Все категории');
      chips($('#filter-price'), priceBuckets, 'price', 'Любая');
      chips($('#filter-point'), pointBuckets, 'point', 'Все точки');
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
          ? (found.length === PRODUCTS.length
              ? 'В зале все ' + PRODUCTS.length + ' моделей'
              : 'Под фильтры подошло ' + found.length + ' из ' + PRODUCTS.length + ' ' +
                plural(found.length, 'модель', 'модели', 'моделей'))
          : 'Ничего не нашлось';
      }

      var summary = $('#active-filters');
      if (summary) {
        var parts = activeSummary();
        summary.innerHTML = parts.length
          ? '<span class="tiny muted">Отбор:</span> ' + parts.map(function (part) {
              return '<span class="badge">' + esc(part) + '</span>';
            }).join('') +
            '<button class="filter-reset" type="button" data-action="reset-filters">Снять всё</button>'
          : '<span class="tiny muted">Фильтры сняты, показываю весь зал.</span>';
      }

      if (!found.length) {
        grid.innerHTML = '' +
          '<div class="empty grid-empty lookbook-empty">' +
            icon('filter', 'icon--xl') +
            '<h3>С такими фильтрами пусто</h3>' +
            '<p class="small">Снимите размер или точку. В зале висит больше, чем попало в подборку: часть размеров я держу в подсобке.</p>' +
            '<button class="btn btn--sm" type="button" data-action="reset-filters">Снять фильтры</button>' +
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
        host.innerHTML = '<p class="small">' + icon('check') + ' ' + esc(pointObj.short || 'Точка') +
          ': все позиции в наличии. Соберу за 2 часа, ' + esc(pointObj.address) + '.</p>';
      } else {
        host.innerHTML = '<p class="small">' + icon('clock') + ' В ' + esc(pointPrep(point)) + ' нет: ' +
          esc(info.missing.join(', ')) + '. Привезу из второй за день и напишу перед отправкой.</p>';
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
                '<h3 class="cart-line__title">' + esc(item.name) + '</h3>' +
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
      if (feeEl) { feeEl.textContent = method !== 'delivery' ? 'самовывоз, бесплатно' : (fee === 0 ? 'бесплатно' : byn(fee)); }
      if (totalEl) { totalEl.textContent = byn(sub + fee); }

      var hint = $('#delivery-hint');
      if (hint) {
        if (method !== 'delivery') {
          hint.textContent = 'Самовывоз из точки: собираю за 2 часа и пишу, когда забирать.';
        } else if (fee === 0) {
          hint.textContent = 'Доставка бесплатная, заказ от ' + byn(FREE_FROM) + '. Толя приедет на второй день.';
        } else {
          hint.textContent = 'До бесплатной доставки не хватает ' + byn(FREE_FROM - sub) + '. Толя берёт ' +
            byn(DELIVERY_FEE) + ' и везёт ' + (DATA.delivery && DATA.delivery.time ? DATA.delivery.time : '1–2 дня') + '.';
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
        toast('Убрала позицию из корзины');
      } else if (action === 'clear-cart') {
        clearCart();
        render();
        toast('Корзину очистила');
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
        option.textContent = item.title + ', ' + item.address;
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
          toast('В корзине пусто, сначала отметьте вещь в каталоге');
          return;
        }
        var name = (($('#field-name') || {}).value || '').trim();
        var phone = (($('#field-phone') || {}).value || '').trim();
        var address = method === 'delivery' ? ((($('#field-address-input') || {}).value || '').trim()) : '';
        var date = (($('#field-date') || {}).value || '');
        var slot = method === 'delivery' ? ((($('#field-slot-select') || {}).value || '')) : '';
        var comment = (($('#field-comment') || {}).value || '').trim();

        var ok = true;
        if (name.length < 2) { showError('name', 'Напишите имя: мне нужно знать, кому звонить'); ok = false; }
        else { showError('name', ''); }

        var digits = phone.replace(/[^\d]/g, '');
        if (!/^375(17|25|29|33|44)\d{7}$/.test(digits)) {
          showError('phone', 'Телефон нужен в формате +375 (29) 123-45-67, иначе не дозвонюсь'); ok = false;
        } else { showError('phone', ''); }

        if (method === 'delivery' && address.length < 5) {
          showError('address', 'Улицу, дом и квартиру: Толя поедет по этому адресу'); ok = false;
        } else { showError('address', ''); }

        if (!date) { showError('date', 'Выберите дату, раньше сегодняшней не смогу'); ok = false; } else { showError('date', ''); }
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
        toast('Заказ №' + order.number + ' принят. Позвоню в течение пятнадцати минут и подтвержу размер');
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
        host.innerHTML = '<div class="empty orders-empty"><p class="small">С этим статусом заказов нет. ' +
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
          ? 'Всего в панели ' + orders.length + ' ' + plural(orders.length, 'заказ', 'заказа', 'заказов')
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
        if (!orders.length) { toast('Выгружать пока нечего'); return; }
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
        toast('Выгрузила ' + orders.length + ' ' + plural(orders.length, 'заказ', 'заказа', 'заказов') + ' в CSV, файл ушёл в загрузки');
      });
    }

    var wipe = $('#clear-orders');
    if (wipe) {
      wipe.addEventListener('click', function () {
        if (!readOrders().length) { toast('Список и так пустой'); return; }
        if (!window.confirm('Удалить все заказы из демонстрационной панели? Это только локальные данные в браузере, ' +
          'на сайте они не сохраняются.')) { return; }
        saveOrders([]);
        render();
        toast('Панель очищена. Сделайте тестовый заказ на сайте.');
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
