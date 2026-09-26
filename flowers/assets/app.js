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

  function nextOrderNumber() {
    var list = readOrders();
    var used = {};
    list.forEach(function (o) { used[String(o.number)] = true; });
    var base = Number(String(Date.now()).slice(-4));
    var candidate = base;
    var guard = 0;
    while (used[String(candidate)] && guard < 60) { candidate = candidate + 1 > 9999 ? 1000 : candidate + 1; guard++; }
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

  function productCard(product) {
    var badge = product.badge
      ? '<span class="badge card__badge">' + esc(product.badge) + '</span>'
      : '';
    var tagLine = tagTitles(product.tags).slice(0, 2).join(' · ');
    return '' +
      '<article class="card reveal" data-product="' + esc(product.id) + '">' +
        '<div class="card__media">' + badge + imageMarkup(product.img, product.alt) + '</div>' +
        '<div class="card__body">' +
          '<p class="tiny muted">' + esc(catTitle(product.cat)) + '</p>' +
          '<h3>' + esc(product.name) + '</h3>' +
          '<p class="small muted">' + esc(product.short) + '</p>' +
          '<p class="tiny muted">' + esc(product.size) + (tagLine ? ' · ' + esc(tagLine) : '') + '</p>' +
          '<div class="card__foot">' +
            '<span class="price">' + byn(product.price) + '</span>' +
            '<button class="btn btn--sm" type="button" data-action="add" data-id="' + esc(product.id) + '">' +
              '<svg class="icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7" fill="none" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>' +
              'В корзину' +
            '</button>' +
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
    burger.addEventListener('click', function () {
      var open = panel.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    });
    $$('a', panel).forEach(function (link) {
      link.addEventListener('click', function () {
        panel.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        panel.setAttribute('aria-hidden', 'true');
      });
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
      toast('«' + product.name + '» в корзине — ' + count + ' ' + plural(count, 'позиция', 'позиции', 'позиций'));
    });
  }

  /* ============================ главная: конструктор букета ============================ */

  var BUILDER = {
    occasions: [
      { id: 'none', title: 'Без повода', add: 0, hint: 'Просто потому что хочется' },
      { id: 'birthday', title: 'День рождения', add: 10, hint: 'Добавим ярких акцентов' },
      { id: 'anniversary', title: 'Годовщина', add: 15, hint: 'Больше бутонов и лента в тон' },
      { id: 'wedding', title: 'Свадьба', add: 40, hint: 'Плотная сборка, стойкие сорта' },
      { id: 'thanks', title: 'Сказать спасибо', add: 0, hint: 'Аккуратный небольшой букет' },
      { id: 'newhome', title: 'Новоселье', add: 5, hint: 'Композиция, которая долго стоит' }
    ],
    sizes: [
      { id: 's', title: 'S', add: 65, hint: 'до 9 бутонов' },
      { id: 'm', title: 'M', add: 95, hint: '11–15 бутонов' },
      { id: 'l', title: 'L', add: 135, hint: '17–25 бутонов' },
      { id: 'xl', title: 'XL', add: 180, hint: '25+ бутонов' }
    ],
    palettes: [
      { id: 'pudra', title: 'Пудровая', add: 0, swatch: '#e6c3c6' },
      { id: 'white', title: 'Белая', add: 10, swatch: '#f2ece0' },
      { id: 'green', title: 'Зелёная', add: 0, swatch: '#3f7d5d' },
      { id: 'terra', title: 'Терракотовая', add: 15, swatch: '#c97a4a' },
      { id: 'bright', title: 'Яркая', add: 10, swatch: '#e5b23c' }
    ],
    packs: [
      { id: 'craft', title: 'Крафт и лента', add: 0, hint: 'Классика, ничего лишнего' },
      { id: 'box', title: 'Шляпная коробка', add: 25, hint: 'С влажной губкой — не нужна ваза' },
      { id: 'vase', title: 'Стеклянная ваза', add: 35, hint: 'Можно подарить сразу с водой' }
    ]
  };

  function findOption(list, id) {
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
    return list[0];
  }

  /* Цена конструктора: размер + повод + палитра + упаковка. Чистая функция — её же проверяют тесты. */
  function builderPrice(state) {
    return findOption(BUILDER.sizes, state.size).add +
      findOption(BUILDER.occasions, state.occasion).add +
      findOption(BUILDER.palettes, state.palette).add +
      findOption(BUILDER.packs, state.pack).add;
  }

  function initBuilder() {
    var root = $('#builder');
    if (!root) { return; }

    var state = { occasion: 'none', size: 'm', palette: 'pudra', pack: 'craft' };

    var groups = [
      { key: 'occasion', field: 'occasion', list: BUILDER.occasions },
      { key: 'size', field: 'size', list: BUILDER.sizes },
      { key: 'palette', field: 'palette', list: BUILDER.palettes },
      { key: 'pack', field: 'pack', list: BUILDER.packs }
    ];

    function price() {
      return builderPrice(state);
    }

    function chip(group, option) {
      var active = state[group.field] === option.id;
      var swatch = option.swatch
        ? '<span class="swatch" style="background:' + esc(option.swatch) + '"></span>'
        : '';
      return '<button class="chip" type="button" data-group="' + esc(group.field) + '" data-value="' + esc(option.id) +
        '" aria-pressed="' + (active ? 'true' : 'false') + '">' + swatch + esc(option.title) + '</button>';
    }

    function render() {
      var occ = findOption(BUILDER.occasions, state.occasion);
      var size = findOption(BUILDER.sizes, state.size);
      var pal = findOption(BUILDER.palettes, state.palette);
      var pack = findOption(BUILDER.packs, state.pack);
      var sum = price();

      root.querySelectorAll('[data-group]').forEach(function (el) {
        el.setAttribute('aria-pressed', el.getAttribute('data-value') === state[el.getAttribute('data-group')] ? 'true' : 'false');
      });

      $('#builder-occasion-hint').textContent = occ.hint;
      $('#builder-size-hint').textContent = size.hint + ' · ' + size.title;
      $('#builder-pack-hint').textContent = pack.hint;
      $('#builder-price').textContent = byn(sum);
      $('#builder-summary').textContent = 'Букет ' + size.title + ' · ' + occ.title + ' · ' + pal.title.toLowerCase() +
        ' палитра · ' + pack.title.toLowerCase();
      $('#builder-note').textContent = sum >= FREE_FROM
        ? 'Доставка по Минску — бесплатно, сегодня за 2 часа.'
        : 'Доставка по Минску 12 BYN, сегодня за 2 часа. До бесплатной доставки — ' + byn(FREE_FROM - sum) + '.';
    }

    groups.forEach(function (group) {
      var host = root.querySelector('[data-options="' + group.field + '"]');
      if (!host) { return; }
      host.innerHTML = group.list.map(function (option) {
        return chip(group, option);
      }).join('');
    });

    root.addEventListener('click', function (event) {
      var btn = event.target.closest ? event.target.closest('[data-group]') : null;
      if (!btn) { return; }
      var field = btn.getAttribute('data-group');
      if (!(field in state)) { return; }
      state[field] = btn.getAttribute('data-value');
      render();
    });

    var add = $('#builder-add');
    if (add) {
      add.addEventListener('click', function () {
        var size = findOption(BUILDER.sizes, state.size);
        var occ = findOption(BUILDER.occasions, state.occasion);
        var pal = findOption(BUILDER.palettes, state.palette);
        var pack = findOption(BUILDER.packs, state.pack);
        var note = [size.title, occ.title, pal.title, pack.title].join(' · ');
        var count = addToCart({
          id: 'bouquet-' + size.id + '-' + occ.id + '-' + pal.id + '-' + pack.id,
          name: 'Букет по конструктору',
          price: price(),
          img: BUILDER_IMG,
          note: note
        }, 1);
        updateCartBadges();
        toast('Букет ' + size.title + ' в корзине — ' + count + ' ' + plural(count, 'позиция', 'позиции', 'позиций'));
      });
    }

    render();
  }

  function initFeatured() {
    var grid = $('#featured');
    if (!grid) { return; }
    var picked = PRODUCTS.slice().sort(function (a, b) { return (b.pop || 0) - (a.pop || 0); }).slice(0, 4);
    grid.innerHTML = picked.map(productCard).join('');
    initReveal();
  }

  function initServices() {
    var host = $('#services');
    if (!host) { return; }
    var icons = {
      scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88"/><path d="M14.47 14.48 20 20"/><path d="M8.12 8.12 12 12"/>',
      palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2a10 10 0 1 0 0 20 1 1 0 0 0 1-1v-1a2 2 0 0 1 2-2h2a3 3 0 0 0 3-3 10 10 0 0 0-10-10z"/>',
      package: '<path d="M11 21.7a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
      gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
      calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>',
      heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
      truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.6a1 1 0 0 0-.2-.6l-3.5-4.4A1 1 0 0 0 17.5 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
      clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
      shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
      sparkles: '<path d="M9.9 15.5a2 2 0 0 0-1.4-1.44L2.36 12.5a.5.5 0 0 1 0-.96l6.14-1.6A2 2 0 0 0 9.9 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/>'
    };
    host.innerHTML = SERVICES.map(function (service) {
      var icon = icons[service.icon] || icons.sparkles;
      return '' +
        '<article class="feature reveal">' +
          '<span class="feature__icon" aria-hidden="true">' +
            '<svg class="icon icon--lg" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7" fill="none">' + icon + '</svg>' +
          '</span>' +
          '<div>' +
            '<h3>' + esc(service.title) + '</h3>' +
            '<p class="small muted">' + esc(service.text) + '</p>' +
          '</div>' +
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
          ? 'Найдено ' + found.length + ' ' + plural(found.length, 'работа', 'работы', 'работ') + ' из ' + PRODUCTS.length
          : 'Ничего не найдено';
      }
      if (!found.length) {
        grid.innerHTML = '' +
          '<div class="empty grid-empty">' +
            '<svg class="icon icon--xl" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7" fill="none" aria-hidden="true">' +
              '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>' +
            '</svg>' +
            '<h3>Ничего не найдено</h3>' +
            '<p class="small">Попробуйте другой повод, цену или сбросьте фильтры — в мастерской всегда есть что собрать.</p>' +
            '<button class="btn btn--sm" type="button" data-action="reset-filters">Сбросить фильтры</button>' +
          '</div>';
        return;
      }
      grid.innerHTML = found.map(productCard).join('');
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
                  '<svg class="icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7" fill="none" aria-hidden="true"><path d="M5 12h14"/></svg>' +
                '</button>' +
                '<span class="qty" aria-live="polite">' + item.qty + '</span>' +
                '<button class="icon-btn icon-btn--sm" type="button" data-action="inc" data-id="' + esc(item.id) + '" aria-label="Добавить одну">' +
                  '<svg class="icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7" fill="none" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>' +
                '</button>' +
              '</div>' +
              '<div class="cart-line__sum">' + byn(item.price * item.qty) + '</div>' +
              '<button class="icon-btn icon-btn--sm cart-line__del" type="button" data-action="remove" data-id="' + esc(item.id) + '" aria-label="Удалить ' + esc(item.name) + '">' +
                '<svg class="icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7" fill="none" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>' +
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
          ? 'Доставка по Минску бесплатная — заказ от ' + byn(FREE_FROM) + '.'
          : 'До бесплатной доставки осталось ' + byn(FREE_FROM - sub) + '. Доставка по Минску — ' +
            byn(DELIVERY_FEE) + ', обычно за 2 часа.';
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
        toast('Позиция удалена из корзины');
      } else if (action === 'clear-cart') {
        clearCart();
        render();
        toast('Корзина очищена');
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
          toast('Сначала добавьте букет в корзину');
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
        if (name.length < 2) { showError('name', 'Напишите, как к вам обращаться'); ok = false; } else { showError('name', ''); }

        var digits = phone.replace(/[^\d]/g, '');
        if (!/^375(17|25|29|33|44)\d{7}$/.test(digits)) {
          showError('phone', 'Телефон в формате +375 (29) 123-45-67'); ok = false;
        } else { showError('phone', ''); }

        if (method === 'delivery') {
          if (address.trim().length < 5) { showError('address', 'Улица, дом и квартира — чтобы курьер не искал'); ok = false; } else { showError('address', ''); }
        } else {
          showError('address', '');
        }
        if (!date) { showError('date', 'Выберите дату'); ok = false; } else { showError('date', ''); }
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
        toast('Заказ №' + order.number + ' принят — мы позвоним в течение 15 минут');
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
        host.innerHTML = '<div class="empty"><p class="small">Заказов с этим статусом пока нет. Выберите другой статус ' +
          'или «Все заказы».</p></div>';
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
                ? 'Самовывоз из мастерской на Немиге'
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
        link.download = 'pion-orders-' + todayISO() + '.csv';
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
