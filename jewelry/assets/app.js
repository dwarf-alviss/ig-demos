/* app.js — «Латунь», ювелирное ателье в Минске.
   Вся логика демо: витрина с фильтрами, лот с выбором материала и гравировкой,
   корзина, оформление заказа и панель мастерской. Без библиотек и внешних запросов.
   Данные — assets/data.js, состояние — localStorage
   (корзина: igdemo_jewelry_cart_v1, заказы: igdemo_jewelry_orders_v1). */

(function () {
  'use strict';

  /* ============================ 1. Свой набор иконок ============================ */

  /* Латунный штрих 1.35, круглые окончания, в части иконок точки-заклёпки заливкой.
     Набор авторский: корзина это витринная сумка с камушком на лицевой стороне,
     меню — три разной длины линии. С иконками других демо ничего не пересекается. */
  var ICONS = {
    'bag': '<path d="M5.4 7.8h13.2l.9 11.4a1.6 1.6 0 0 1-1.6 1.7H6.1a1.6 1.6 0 0 1-1.6-1.7Z"/><path d="M8.8 7.8V6.3a3.2 3.2 0 0 1 6.4 0v1.5"/><path d="M9.6 12.4h4.8L12 17.4Z"/>',
    'gem': '<path d="M12 3.6 19.4 9.6 12 20.4 4.6 9.6Z"/><path d="M4.6 9.6h14.8"/><path d="M12 3.6 8.8 9.6 12 20.4 15.2 9.6Z"/>',
    'ring': '<circle cx="12" cy="14.6" r="5.2"/><path d="M9.2 9.8 12 5.4 14.8 9.8Z"/><path d="M12 5.4 10.2 9.8 12 12.6 13.8 9.8Z"/>',
    'stud': '<path d="M8.4 6.6a3.6 3.6 0 0 1 7.2 0"/><path d="M12 6.6v4"/><path d="M8.8 10.6h6.4L12 18.6Z"/><path d="M12 10.6 10.2 14.6 12 18.6 13.8 14.6Z"/>',
    'chain': '<path d="M4.2 5.4c1.8 4.2 4.6 6.4 7.8 6.4s6-2.2 7.8-6.4"/><path d="M6.4 15.2h5a2.2 2.2 0 0 1 0 4.4h-5a2.2 2.2 0 0 1 0-4.4Z"/><path d="M12.6 15.2h5a2.2 2.2 0 0 1 0 4.4h-5a2.2 2.2 0 0 1 0-4.4Z"/>',
    'pendant': '<path d="M4.4 5.4c1.8 4.2 4.6 6.4 7.6 6.4s5.8-2.2 7.6-6.4"/><path d="M12 11.8v1.8"/><path d="M12 13.6c2.2 2.8 3.4 4.6 3.4 6.2a3.4 3.4 0 0 1-6.8 0c0-1.6 1.2-3.4 3.4-6.2Z"/>',
    'spool': '<path d="M6.6 5.4h10.8"/><path d="M6.6 18.6h10.8"/><path d="M6.6 5.4c0 2.4 10.8 3.6 10.8 6.6s-10.8 4.2-10.8 6.6"/>',
    'brooch': '<path d="M4.4 9.6 19.6 17.2"/><path d="M10.2 8.2h3.6l1.2 3.2-3 3.2-3-3.2Z"/><circle cx="19.6" cy="19.4" r="1.3"/>',
    'loupe': '<path d="M16.2 10 13.1 15.4 6.9 15.4 3.8 10 6.9 4.6 13.1 4.6Z"/><path d="m14.6 14.6 5 5"/><circle cx="10" cy="10" r="1" fill="currentColor" stroke="none"/>',
    'gauge': '<path d="M10.6 3.6h2.8l1.4 15.2a2.8 2.8 0 0 1-5.6 0Z"/><path d="M9.6 8.4h4.8"/><path d="M9.1 12.6h5.8"/><path d="M8.6 16.8h6.8"/>',
    'torch': '<path d="M4.6 19.4 9.4 14.6"/><path d="M9.4 14.6h3"/><path d="M17.6 4.4 19.2 8.2 23 9.8 19.2 11.4 17.6 15.2 16 11.4 12.2 9.8 16 8.2Z"/><path d="M12.4 14.6 14.8 12.2"/>',
    'pliers': '<path d="M6.8 3.6 12 11.6"/><path d="M17.2 3.6 12 11.6"/><path d="M12 11.6 8 20.4"/><path d="M12 11.6 16 20.4"/><circle cx="12" cy="11.6" r="1.1" fill="currentColor" stroke="none"/>',
    'bin': '<path d="M5.6 7.6h12.8"/><path d="M9.6 7.6V5.4h4.8v2.2"/><path d="M7.2 7.6 7.9 19.4h8.2l.7-11.8"/><path d="M10.6 10.8v5.6"/><path d="M13.4 10.8v5.6"/>',
    'shield': '<path d="M12 3.6 18.4 6v6.4c0 3.8-2.6 6.4-6.4 8-3.8-1.6-6.4-4.2-6.4-8V6Z"/><path d="M12 9.2 14 11.4 12 14.4 10 11.4Z"/>',
    'ribbon': '<path d="M4.8 9.6h14.4v9.8H4.8Z"/><path d="M12 9.6v9.8"/><path d="M9.4 9.6c-2.2 0-3.2-2.2-1.8-3.6 1.6-1.4 3.6 1.4 4.4 3.6"/><path d="M14.6 9.6c2.2 0 3.2-2.2 1.8-3.6-1.6-1.4-3.6 1.4-4.4 3.6"/>',
    'clock': '<circle cx="12" cy="12" r="8.6"/><path d="M12 6.8V12l3.6 2.2"/><circle cx="12" cy="12" r=".95" fill="currentColor" stroke="none"/>',
    'van': '<path d="M3.6 16.4V7.8h8.8v8.6"/><path d="M12.4 10.4h3.4l3.6 3.8v2.2"/><path d="M3.6 13.4h8.8"/><circle cx="7.4" cy="17.6" r="2.2"/><circle cx="17.4" cy="17.6" r="2.2"/><path d="M9.6 17.6h5.6"/>',
    'mark': '<path d="m4.8 12.4 4.6 4.6L19.2 6.8"/>',
    'chevron': '<path d="m10 6.2 6 5.8-6 5.8"/>',
    'arrow': '<path d="M4.6 12h14.6"/><path d="m13.4 6.2 5.8 5.8-5.8 5.8"/>',
    'x': '<path d="m6.8 6.8 10.4 10.4"/><path d="m17.2 6.8-10.4 10.4"/>',
    'menu': '<path d="M4.6 7.4h14.8"/><path d="M4.6 12h9.4"/><path d="M4.6 16.6h14.8"/>',
    'plus': '<path d="M12 5.4v13.2"/><path d="M5.4 12h13.2"/>',
    'minus': '<path d="M5.4 12h13.2"/>',
    'pin': '<path d="M12 3.8a6 6 0 0 1 6 6c0 4.4-6 10.4-6 10.4s-6-6-6-10.4a6 6 0 0 1 6-6Z"/><circle cx="12" cy="9.8" r="1.4" fill="currentColor" stroke="none"/>',
    'phone': '<path d="M8.6 4.4 6.2 3.6A2.2 2.2 0 0 0 3.6 5.6c.6 7.6 7.2 14.2 14.8 14.8a2.2 2.2 0 0 0 2-2.6l-.8-2.4-3.4.6a13.2 13.2 0 0 1-8.8-8.8Z"/>',
    'letter': '<path d="M3.6 6.4h16.8v11.2H3.6Z"/><path d="m4.4 7.2 7.6 5.6 7.6-5.6"/>',
    'camera': '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4.6"/><circle cx="12" cy="12" r="4.2"/><circle cx="16.9" cy="7.1" r=".95" fill="currentColor" stroke="none"/>',
    'calendar': '<path d="M4 5.6h16v14.4H4Z"/><path d="M8.6 3.4v4.2"/><path d="M15.4 3.4v4.2"/><path d="M4 10.6h16"/>',
    'card': '<path d="M3 6h18v12H3Z"/><path d="M3 10.6h18"/><path d="M6.6 14.8h3.4"/>',
    'download': '<path d="M12 3.8v11.6"/><path d="m7.6 11 4.4 4.4 4.4-4.4"/><path d="M5.2 20.4h13.6"/>',
    'burst': '<path d="M12 3.8 13.8 9 19 10.8 13.8 12.6 12 17.8 10.2 12.6 5 10.8 10.2 9Z"/><circle cx="18.4" cy="17.6" r="1" fill="currentColor" stroke="none"/>',
    'settings': '<circle cx="12" cy="12" r="3"/><path d="M12 3.2v2.4"/><path d="M12 18.4v2.4"/><path d="M3.2 12h2.4"/><path d="M18.4 12h2.4"/><path d="m5.8 5.8 1.7 1.7"/><path d="m16.5 16.5 1.7 1.7"/><path d="m5.8 18.2 1.7-1.7"/><path d="m16.5 7.5 1.7-1.7"/>',
    'funnel': '<path d="M20 4.4H4l6.6 7.6v6.2l2.8 1.8v-8Z"/>'
  };
  function icon(name, cls) {
    var body = ICONS[name] || ICONS.gem;
    return '<svg class="' + (cls || 'icon') + '" viewBox="0 0 24 24" stroke="currentColor"' +
      ' stroke-width="1.35" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
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
  /* Номер лота: у каждого украшения он свой и не меняется — как инвентарный номер */
  function lotNo(p) {
    var i = PRODUCTS.indexOf(p);
    return 'Лот ' + pad2(i < 0 ? 1 : i + 1);
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

  /* ============================ 4. Получение и статусы ============================ */

  var DELIVERY = {
    pickup:  { id: 'pickup',  name: 'Самовывоз из мастерской', cost: 0, note: SHOP.address },
    minsk:   { id: 'minsk',   name: 'Курьер по Минску',        cost: SHOP.deliveryMinsk,   note: '1–2 дня после готовности, курьер позвонит заранее' },
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

  /* ============================ 5. Тост и счётчик корзины ============================ */

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

  /* ============================ 6. Шапка: мобильное меню и появление блоков ============================ */

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
    $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

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

  /* ============================ 7. Лот: бирка, материал, гравировка ============================ */

  function flagFor(p) {
    if (!p.tags || !p.tags.length) return '';
    var t = TAGS[p.tags[0]];
    if (!t) return '';
    return '<span class="flag lot__flag">' + esc(t.label) + '</span>';
  }

  function productCard(p) {
    var mat = selectedMaterial(p);
    var opts = (p.materials || []).map(function (m) {
      var on = m.id === mat;
      return '<button type="button" class="gem-opt" data-mat="' + esc(m.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        esc(materialInfo(m.id).name) + ' <small>' + money(m.price) + '</small></button>';
    }).join('');
    var inputId = 'eng-' + p.id;
    return '' +
      '<article class="lot" data-id="' + esc(p.id) + '">' +
        '<div class="lot__media">' +
          '<img src="' + esc(p.img) + '" alt="' + esc(p.alt) + '" width="900" height="675" loading="lazy" decoding="async">' +
          flagFor(p) +
        '</div>' +
        '<div class="lot__tag">' +
          '<div class="lot__head">' +
            '<span class="stamp stamp--brass">' + esc(lotNo(p)) + '</span>' +
            '<span class="stamp">' + esc(p.cat) + (p.stone ? ' · камень' : '') + '</span>' +
          '</div>' +
          '<h3 class="lot__title">' + esc(p.title) + '</h3>' +
          '<p class="lot__desc">' + esc(p.desc) + '</p>' +
          '<p class="lot__spec">' + icon('gauge') + '<span>' + esc(p.size) + '</span></p>' +
          '<div class="gem-pick" role="group" aria-label="Материал: ' + esc(p.title) + '">' + opts + '</div>' +
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
          '<div class="lot__meta">' +
            '<span class="stamp" data-mat-label>' + esc(materialInfo(mat).name) + '</span>' +
            '<i class="lot__meta-rule" aria-hidden="true"></i>' +
            '<span class="stamp stamp--brass num" data-price>' + money(priceOf(p, mat)) + '</span>' +
          '</div>' +
          '<div class="lot__foot">' +
            '<span class="price-note">изготовление ' + SHOP.leadTime + '</span>' +
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
    var matLabel = $('[data-mat-label]', card);
    if (matLabel) matLabel.textContent = materialInfo(mat).name;
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
    toast(parts.join(' · ') + ': лежит в корзине');
  }

  function addFromCard(card, p) {
    var check = $('[data-eng-check]', card);
    var input = $('[data-eng-input]', card);
    var engraving = '';
    if (check && check.checked) {
      engraving = sanitizeEngraving(input ? input.value : '');
      if (!engraving) {
        toast('Букв нет: впишите текст или снимите галочку');
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
      var card = e.target.closest('.lot');
      if (!card) return;
      var p = findProduct(card.dataset.id);
      if (!p) return;
      var matBtn = e.target.closest('[data-mat]');
      if (matBtn) { sel[p.id] = matBtn.getAttribute('data-mat'); paintCard(card, p); return; }
      if (e.target.closest('[data-add]')) { addFromCard(card, p); }
    });
    function onField(e) {
      var card = e.target.closest('.lot');
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

  var HALL_ICONS = {
    'Серьги': 'stud',
    'Кольца': 'ring',
    'Колье': 'chain',
    'Подвески': 'pendant',
    'Браслеты': 'spool',
    'Броши': 'brooch'
  };

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
          '<div class="step__num num">' + pad2(i + 1) + '</div>' +
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
      cats.innerHTML = CATEGORIES.map(function (c) {
        var n = counts[c] || 0;
        return '<a class="hall" href="catalog.html?cat=' + encodeURIComponent(c) + '">' +
          '<span class="hall__icon">' + icon(HALL_ICONS[c] || 'gem', 'icon icon--lg') + '</span>' +
          '<span class="hall__name">' + esc(c) + '</span>' +
          '<span class="hall__meta">' + n + ' ' + plural(n, 'модель', 'модели', 'моделей') + '</span></a>';
      }).join('');
    }
    initBuilder();
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
    return '<div class="empty grid-empty">' +
      icon('loupe', 'icon icon--xl') +
      '<h2 class="display">Под такие условия у меня ничего нет</h2>' +
      '<p class="small empty__note">Часть вещей делаю на заказ и в витрину не выставляю. Сбросьте фильтры или позвоните: повторю похожую форму, если камень найдётся.</p>' +
      '<p style="margin-top:1.25rem"><button class="btn btn--ghost btn--sm" type="button" data-reset-filters>' +
      icon('x') + 'Сбросить фильтры</button></p></div>';
  }

  function renderCatalog() {
    var grid = $('[data-catalog]');
    if (!grid) return;
    var list = filterList();
    var countEl = $('[data-result-count]');
    if (countEl) {
      countEl.textContent = list.length
        ? 'Показываю ' + list.length + ' ' + plural(list.length, 'лот', 'лота', 'лотов')
        : 'Пусто, меняйте условия';
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
        toast('Фильтры сбросил, показываю всё');
      }
    });

    renderCatalog();
  }

  /* ============================ 10. Корзина и оформление ============================ */

  function cartLineHTML(it, i) {
    var p = findProduct(it.id);
    /* У позиции из конструктора своё название, снимок модельки и состав — они и главнее */
    var title = it.title || (p ? p.title : it.id);
    var img = it.img || (p ? p.img : (PRODUCTS[0] ? PRODUCTS[0].img : ''));
    var alt = it.alt || (p ? p.alt : '');
    var price = itemPrice(it);
    return '' +
      '<div class="cart-line" data-i="' + i + '">' +
        '<div class="cart-line__img"><img src="' + esc(img) + '" alt="' + esc(alt) + '" width="92" height="69" loading="lazy"></div>' +
        '<div>' +
          '<div class="cart-line__title">' + esc(title) + '</div>' +
          '<div class="cart-line__meta">' + esc(materialInfo(it.material).name) +
            (p ? ' · ' + esc(p.size) : '') + '</div>' +
          (it.note ? '<div class="cart-line__meta">' + esc(it.note) + '</div>' : '') +
          (it.engraving ? '<div class="cart-line__engrave">Гравировка: «' + esc(it.engraving) + '» (+' + SHOP.engravingPrice + ' BYN)</div>' : '') +
          '<div class="cart-line__meta">' + money(price) + ' / шт.</div>' +
          '<div class="row" style="margin-top:.6rem">' +
            '<span class="qty">' +
              '<button class="qty__btn" type="button" data-qty="-1" aria-label="Убрать одну штуку">' + icon('minus') + '</button>' +
              '<span class="qty__num num">' + (it.qty || 1) + '</span>' +
              '<button class="qty__btn" type="button" data-qty="1" aria-label="Добавить одну штуку">' + icon('plus') + '</button>' +
            '</span>' +
            '<button class="btn btn--ghost btn--sm" type="button" data-remove>' + icon('bin') + 'Удалить</button>' +
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
      if (cntEl) cntEl.textContent = cart.length + ' ' + plural(cart.length, 'лот', 'лота', 'лотов');
      var bar = $('[data-progress]');
      var note = $('[data-progress-note]');
      var left = Math.max(0, SHOP.freeDeliveryFrom - subtotal);
      if (bar) bar.style.width = Math.min(100, Math.round(subtotal / SHOP.freeDeliveryFrom * 100)) + '%';
      if (note) {
        note.textContent = cart.length === 0
          ? 'Доставка бесплатная от ' + SHOP.freeDeliveryFrom + ' BYN'
          : (left > 0
            ? 'До бесплатной доставки ещё ' + money(left)
            : 'Доставка за мой счёт, упаковка в подарок уже внутри');
      }
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
        toast('Убрала позицию из корзины');
        return;
      }
      var qBtn = e.target.closest('[data-qty]');
      if (qBtn) {
        var next = (cart[i].qty || 1) + parseInt(qBtn.getAttribute('data-qty'), 10);
        if (next <= 0) { cart.splice(i, 1); toast('Убрала позицию из корзины'); }
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
        if (!cart.length) { toast('Корзина пустая, выберите вещь в витрине'); return; }
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
        if (method !== 'pickup' && address.length < 5) errs.push(['address', 'Куда везти: улица, дом, квартира']);

        $$('.error', form).forEach(function (el) { el.textContent = ''; });
        if (errs.length) {
          errs.forEach(function (pair) {
            var box = $('[data-error="' + pair[0] + '"]', form);
            if (box) box.textContent = pair[1];
            var fld = $('[name="' + pair[0] + '"]', form);
            if (fld && pair === errs[0]) fld.focus();
          });
          toast('Поля ниже подсвечены, посмотрите');
          return;
        }

        var subtotal = cart.reduce(function (s, it) { return s + itemPrice(it) * (it.qty || 1); }, 0);
        var cost = deliveryCost(method, subtotal);
        var items = cart.map(function (it) {
          var p = findProduct(it.id);
          return {
            id: it.id,
            title: it.title || (p ? p.title : it.id),
            material: it.material,
            materialName: materialInfo(it.material).name,
            engraving: it.engraving || '',
            note: it.note || '',
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
              return '<li>' + esc(it.title) + ' · ' + esc(it.materialName) +
                (it.engraving ? ' · гравировка «' + esc(it.engraving) + '»' : '') + ' × ' + it.qty + ' — ' + money(it.price * it.qty) + '</li>';
            }).join('');
          }
          var dEl = $('[data-order-delivery]', box);
          if (dEl) dEl.textContent = DELIVERY[method].name + (cost ? ' (' + money(cost) + ')' : ' (бесплатно)') +
            (date ? ', на ' + date.split('-').reverse().join('.') : '');
          form.hidden = true;
          box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        toast('Заказ №' + order.no + ' принят, он уже в панели мастерской');
      });
    }

    renderCart();
  }

  /* ============================ 11. Панель мастерской ============================ */

  var astate = { status: 'all' };

  function orderCardHTML(o) {
    var items = (o.items || []).map(function (it) {
      return '<div class="order__item"><span>' + esc(it.title) +
        ' <small>· ' + esc(it.materialName || materialInfo(it.material).name) +
        (it.engraving ? ' · гравировка «' + esc(it.engraving) + '»' : '') + ' × ' + (it.qty || 1) +
        (it.note ? '<br>' + esc(it.note) : '') + '</small></span>' +
        '<span class="num">' + money((it.price || 0) * (it.qty || 1)) + '</span></div>';
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
            '<span class="order__when num">' + esc(fmtDateTime(o.createdAt)) + '</span></div>' +
          '<span class="status-pill" data-status="' + esc(o.status || 'new') + '">' + esc(STATUSES[o.status] || STATUSES.new) + '</span>' +
        '</div>' +
        '<div class="order__grid">' +
          '<div><div class="order__label">Клиент</div><div class="order__val">' + esc(o.customer && o.customer.name ? o.customer.name : '—') + '</div></div>' +
          '<div><div class="order__label">Телефон</div><div class="order__val num">' +
            (o.customer && o.customer.phone ? '<a href="tel:+375-29-123-45-67' + esc(String(o.customer.phone).replace(/[^\d+]/g, '')) + '">' + esc(o.customer.phone) + '</a>' : '—') + '</div></div>' +
          '<div><div class="order__label">Получение</div><div class="order__val">' + esc(d.name) + '</div>' +
            (addr ? '<div class="small muted">' + esc(addr) + '</div>' : '') + '</div>' +
          '<div><div class="order__label">Желаемая дата</div><div class="order__val num">' + esc(when) + '</div></div>' +
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
            ? icon('funnel', 'icon icon--xl') + '<h3 class="display">С этим статусом заказов нет</h3><p class="small empty__note">Выберите другой фильтр, заказы никуда не делись.</p>'
            : icon('bag', 'icon icon--xl') + '<h3 class="display">Заказов пока нет</h3>' +
              '<p class="small empty__note">Оформите тестовый заказ на сайте: он появится здесь сам, в этой же вкладке. Так механика и показывается.</p>' +
              '<p style="margin-top:1.25rem"><a class="btn btn--sm" href="catalog.html">' + icon('bag') + 'Открыть витрину</a></p>') +
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
      toast('Заказ №' + no + ': ' + STATUSES[status].toLowerCase());
    });

    $$('[data-status-chip]').forEach(function (b) {
      b.addEventListener('click', function () { astate.status = b.getAttribute('data-status-chip'); renderOrders(); });
    });

    var exp = $('[data-export]');
    if (exp) {
      exp.addEventListener('click', function () {
        var orders = getOrders();
        if (!orders.length) { toast('Выгружать нечего, заказов пока нет'); return; }
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
        if (!getOrders().length) { toast('Список и так пустой'); return; }
        if (!window.confirm('Удалить все заказы из этого браузера? Обратно их не вернуть.')) return;
        setOrders([]);
        renderOrders();
        paintStats();
        toast('Заказы удалены');
      });
    }

    paintStats();
    renderOrders();
  }

  /* ============================ 12. Конструктор: живое украшение ============================
     Модельки, камни и цены живут в assets/ring.js. Отсюда — только состояние,
     чипы выбора, перерисовка витрины и снимок собранной вещи в корзину. */

  var RING = window.LATUN_RING || null;

  /* Подсказки под шагами и приписка к размеру — словами с витрины, не новыми */
  var SIZE_HINTS = {
    ring: 'Размеры от 15 до 21, меньше не беру',
    studs: 'В витрине длина 3,5 см',
    pendant: 'В витрине цепочка 45 см',
    bracelet: 'Обхват 16–19 см, регулируется'
  };
  var SIZE_ASIDES = {
    ring: 'Мерить палец лучше вечером: к вечеру он на полразмера толще.',
    studs: 'Подвеска почти не чувствуется на мочке, дужка гнётся по уху.',
    pendant: 'Камень как есть, без огранки и подкраски.',
    bracelet: 'Обхват правлю бесплатно: растянуть или подтянуть можно в любой момент.'
  };

  function initBuilder() {
    var root = $('#builder');
    if (!root || !RING) { return; }

    var svg = $('#piece');
    var input = $('#builder-graving');
    var state = {
      form: RING.DEFAULT.form, metal: RING.DEFAULT.metal, stone: RING.DEFAULT.stone,
      size: RING.DEFAULT.size, graving: ''
    };
    var drawn = '', graveTimer = null;

    function key() {
      return [state.form, state.metal, state.stone, state.size, state.graving].join('|');
    }

    function chip(group, option) {
      var active = String(state[group.field]) === String(option.id);
      var lead = group.art ? '<span class="chip__art" aria-hidden="true">' + RING.icon(option.id, group.art) + '</span>' : '';
      return '<button class="chip" type="button" data-group="' + esc(group.field) + '" data-value="' + esc(String(option.id)) +
        '" aria-pressed="' + (active ? 'true' : 'false') + '">' + lead + esc(option.title) + '</button>';
    }

    function groups() {
      return [
        { field: 'form', list: RING.FORMS, art: 32 },
        { field: 'metal', list: RING.METALS, art: 28 },
        { field: 'stone', list: RING.STONES, art: 28 },
        { field: 'size', list: RING.sizesOf(state.form) }
      ];
    }

    /* У каждой формы свой набор размеров, поэтому чипы размера перерисовываем */
    function paintOptions() {
      groups().forEach(function (group) {
        var host = root.querySelector('[data-options="' + group.field + '"]');
        if (!host) { return; }
        host.innerHTML = group.list.map(function (option) { return chip(group, option); }).join('');
      });
    }

    /* Витрину перерисовываем, только когда меняется сам рисунок */
    function draw(force) {
      if (!svg) { return; }
      var k = key();
      if (!force && k === drawn) { return; }
      drawn = k;
      RING.render(svg, state, { animate: true });
      svg.setAttribute('aria-label', 'Модель: ' + RING.summary(state));
    }

    /* Гравировка: буквы проступают по одной, поэтому меняем только пластинку */
    function drawGraving() {
      if (!svg) { return; }
      drawn = key();
      RING.render(svg, state, { only: 'graving' });
      svg.setAttribute('aria-label', 'Модель: ' + RING.summary(state));
    }

    function render() {
      var form = RING.find(RING.FORMS, state.form);
      var metal = RING.find(RING.METALS, state.metal);
      var stone = RING.find(RING.STONES, state.stone);
      var size = RING.find(RING.sizesOf(state.form), state.size);
      var sum = RING.priceOf(state);
      var text = state.graving;

      $$('[data-group]', root).forEach(function (el) {
        var field = el.getAttribute('data-group');
        el.setAttribute('aria-pressed', String(el.getAttribute('data-value')) === String(state[field]) ? 'true' : 'false');
      });

      $('#builder-form-hint').textContent = form.hint;
      $('#builder-metal-hint').textContent = metal.note;
      $('#builder-stone-hint').textContent = stone.note;
      $('#builder-size-hint').textContent = SIZE_HINTS[form.id] || '';
      $('#builder-size-aside').textContent = (SIZE_ASIDES[form.id] || '') + ' ' +
        form.word.charAt(0).toUpperCase() + form.word.slice(1) + ' ' + size.title + ' — подгоняю по мерке.';
      $('#builder-price').textContent = money(sum);
      $('#builder-summary').textContent = RING.summary(state);
      $('#builder-formula').innerHTML = RING.lines(state).map(function (line) {
        return '<li' + (line.total ? ' class="is-total"' : '') + '><span>' + esc(line.label) + '</span>' +
          '<i class="builder__rule" aria-hidden="true"></i><b class="num">' + esc(line.value) + '</b></li>';
      }).join('');
      $('#builder-note').textContent = sum >= SHOP.freeDeliveryFrom
        ? 'Доставка за мой счёт: заказ перевалил за ' + money(SHOP.freeDeliveryFrom) + '. Упаковка и открытка уже в цене.'
        : 'До бесплатной доставки не хватает ' + money(SHOP.freeDeliveryFrom - sum) + '. Курьер по Минску — ' + money(SHOP.deliveryMinsk) + '.';
      $('#builder-stage-note').textContent = RING.summary(state) + '. Так выглядит форма: в жизни металл и камень лягут иначе.';
      $('#builder-graving-count').textContent = text
        ? text.length + ' из ' + RING.GRAVING.max + ' знаков · гравировка ' + money(RING.GRAVING.price)
        : 'Пока пусто. Буквы, цифры, точки, дефис, амперсанд.';
    }

    paintOptions();

    root.addEventListener('click', function (event) {
      var btn = event.target.closest ? event.target.closest('[data-group]') : null;
      if (!btn) { return; }
      var field = btn.getAttribute('data-group');
      if (!(field in state)) { return; }
      var value = btn.getAttribute('data-value');
      if (field === 'form') {
        state.form = value;
        state.size = RING.find(RING.FORMS, value).def;
        paintOptions();
      } else {
        state[field] = value;
      }
      draw(true);
      render();
    });

    if (input) {
      input.addEventListener('input', function () {
        state.graving = RING.normalize({ graving: input.value }).graving;
        if (graveTimer) { clearTimeout(graveTimer); }
        graveTimer = setTimeout(drawGraving, 160);
        render();
      });
      input.addEventListener('blur', function () {
        input.value = state.graving;
        if (graveTimer) { clearTimeout(graveTimer); }
        drawGraving();
      });
    }

    var add = $('#builder-add');
    if (add) {
      add.addEventListener('click', function () {
        var st = RING.normalize(state);
        var price = RING.priceOf(st);
        var form = RING.find(RING.FORMS, st.form);
        var text = st.graving;
        var id = ['builder', st.form, st.metal, st.stone, st.size].join('-');
        var title = form.title + ' по конструктору';
        var summary = RING.summary(st);
        /* В позицию кладём цену без гравировки: её прибавит itemPrice, как в бирке лота */
        addToCart({ id: id, title: title, materials: [{ id: st.metal, price: price - (text ? SHOP.engravingPrice : 0) }] },
          st.metal, text);
        var cart = getCart();
        for (var i = 0; i < cart.length; i++) {
          if (cart[i].key !== [id, st.metal, text || ''].join('|')) { continue; }
          cart[i].title = title;
          cart[i].img = RING.dataUrl(st, 480);
          cart[i].alt = 'Модель: ' + summary;
          cart[i].note = summary;
        }
        setCart(cart);
        if (input) { input.value = text; }
        toast('Собрали: ' + summary + ' — ' + money(price) + '. В корзине ' + getCart().length + ' ' +
          plural(getCart().length, 'позиция', 'позиции', 'позиций'));
      });
    }

    draw(true);
    render();
  }

  /* ============================ 13. Старт ============================ */

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
