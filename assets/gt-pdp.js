/* GhostTint PDP behaviour. No dependencies. */
(function () {
  'use strict';

  // Shopify money formats come in several placeholder flavours, and this
  // store uses the European {{amount_with_comma_separator}}. Handling only
  // {{amount}} left the raw template string sitting on the page.
  function money(cents, fmt) {
    fmt = (fmt || '€{{amount}}').replace(/<[^>]*>/g, '');

    function build(decimals, thousands, decimalSep) {
      var v = (cents / 100).toFixed(decimals).split('.');
      var whole = v[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
      return v[1] ? whole + decimalSep + v[1] : whole;
    }

    return fmt.replace(/\{\{\s*(\w+)\s*\}\}/g, function (_, name) {
      switch (name) {
        case 'amount_no_decimals': return build(0, ',', '');
        case 'amount_with_comma_separator': return build(2, '.', ',');
        case 'amount_no_decimals_with_comma_separator': return build(0, '.', '');
        case 'amount_with_apostrophe_separator': return build(2, "'", '.');
        case 'amount_with_space_separator': return build(2, ' ', ',');
        case 'amount_no_decimals_with_space_separator': return build(0, ' ', '');
        default: return build(2, ',', '.');
      }
    });
  }

  function findForm(scope) {
    return scope.querySelector('[data-gt-form]') ||
           scope.querySelector('form[action*="/cart/add"]');
  }

  // boot() runs again on shopify:section:load, so every initialiser is
  // guarded against binding its listeners twice.
  function once(el) {
    if (!el || el.dataset.gtInit) return false;
    el.dataset.gtInit = '1';
    return true;
  }

  /* ---------------------------------------------------------------
   * One tint level, shared by every control on the page.
   * ------------------------------------------------------------- */
  var Level = (function () {
    var value = null, subs = [];
    return {
      get: function () { return value; },
      set: function (v) {
        v = String(v);
        if (v === value) return;
        value = v;
        for (var i = 0; i < subs.length; i++) {
          try { subs[i](v); } catch (e) {}
        }
      },
      sub: function (fn) { subs.push(fn); if (value !== null) fn(value); }
    };
  })();

  var sinksReady = false;
  function initLevelSinks() {
    if (sinksReady) return;
    sinksReady = true;
    Level.sub(function (v) {
      document.querySelectorAll('[data-gt-vlt-out]').forEach(function (o) {
        o.textContent = v;
      });
      document.querySelectorAll('[data-gt-vlt-field]').forEach(function (f) {
        f.value = v + '% VLT';
      });
      var op = ((1 - parseFloat(v) / 100) * 0.82).toFixed(3);
      document.querySelectorAll('[data-gt-vlt-preview]').forEach(function (p) {
        p.style.opacity = op;
      });
    });
  }

  /* ---------------------------------------------------------------
   * Lazy video.
   * ------------------------------------------------------------- */
  function initVideo() {
    var vids = document.querySelectorAll('video[data-gt-lazy]');
    if (!vids.length) return;

    function load(v) {
      if (v.dataset.gtLoaded) return;
      v.dataset.gtLoaded = '1';
      v.querySelectorAll('source[data-src]').forEach(function (s) {
        s.src = s.dataset.src;
        s.removeAttribute('data-src');
      });
      v.load();
    }

    if (!('IntersectionObserver' in window)) {
      vids.forEach(function (v) { load(v); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          load(v);
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        } else if (!v.paused) {
          v.pause();
        }
      });
    }, { rootMargin: '300px 0px' });

    vids.forEach(function (v) { if (once(v)) io.observe(v); });
  }

  /* ---------------------------------------------------------------
   * VLT swatch strip (optional, off by default).
   * ------------------------------------------------------------- */
  function initVlt(root) {
    var track = root.querySelector('[data-gt-vlt]');
    if (!track || !once(track)) return;

    var steps = Array.prototype.slice.call(track.querySelectorAll('.gt-vlt__step'));
    if (!steps.length) return;

    Level.sub(function (v) {
      steps.forEach(function (s) {
        var on = s.dataset.vlt === v;
        s.setAttribute('aria-checked', on ? 'true' : 'false');
        s.tabIndex = on ? 0 : -1;
      });
    });

    steps.forEach(function (s, i) {
      s.addEventListener('click', function () { Level.set(s.dataset.vlt); });
      s.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = Math.min(steps.length - 1, Math.max(0, i + d));
        steps[n].focus();
        Level.set(steps[n].dataset.vlt);
      });
    });

    var preset = steps.filter(function (s) {
      return s.getAttribute('aria-checked') === 'true';
    })[0] || steps[0];
    if (Level.get() === null) Level.set(preset.dataset.vlt);
  }

  /* ---------------------------------------------------------------
   * Pack / variant picker. Writes the chosen variant into the form's
   * hidden id field and republishes the base price so the add-on total
   * recalculates against the new pack.
   * ------------------------------------------------------------- */
  function initVariants(root) {
    var group = root.querySelector('[data-gt-variants]');
    if (!group || !once(group)) return;

    var btns = Array.prototype.slice.call(group.querySelectorAll('[data-variant-id]'));
    var cfg = root.querySelector('[data-gt-buy]');
    var form = findForm(root);
    var idField = form ? form.querySelector('[name="id"]') : null;

    btns.forEach(function (b, i) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        btns.forEach(function (o) {
          o.setAttribute('aria-checked', o === b ? 'true' : 'false');
          o.tabIndex = o === b ? 0 : -1;
        });
        if (idField) idField.value = b.dataset.variantId;
        if (cfg) cfg.dataset.gtBase = b.dataset.price;
        document.dispatchEvent(new CustomEvent('gt:variant'));
      });

      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = Math.min(btns.length - 1, Math.max(0, i + d));
        btns[n].focus();
        btns[n].click();
      });
    });
  }

  /* ---------------------------------------------------------------
   * Interactive remote.
   * ------------------------------------------------------------- */
  function initRemote(root) {
    var panel = root.querySelector('[data-gt-remote]');
    if (!panel || !once(panel)) return;

    var levels = (panel.dataset.levels || '').split(',')
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length; });
    if (!levels.length) return;

    var ledMode = panel.dataset.ledMode || 'meter';
    var unit = panel.querySelector('.gt-remote__unit');
    var plates = Array.prototype.slice.call(panel.querySelectorAll('[data-gt-plate]'));
    var leds = Array.prototype.slice.call(panel.querySelectorAll('[data-gt-led]'));
    var keys = Array.prototype.slice.call(panel.querySelectorAll('[data-gt-key]'));
    var flashTimer = null;

    function indexOfLevel(v) {
      var i = levels.indexOf(String(v));
      return i < 0 ? 0 : i;
    }

    Level.sub(function (v) {
      var i = indexOfLevel(v);
      plates.forEach(function (p, n) { p.classList.toggle('is-on', n === i); });
      if (ledMode === 'meter') {
        leds.forEach(function (l, n) { l.classList.toggle('is-on', n <= i); });
      }
      keys.forEach(function (b) {
        if (b.dataset.gtKey === 'level') {
          b.setAttribute('aria-pressed', (+b.dataset.index === i) ? 'true' : 'false');
        }
      });
    });

    function flash() {
      if (!unit) return;
      unit.classList.add('is-transmitting');
      clearTimeout(flashTimer);
      flashTimer = setTimeout(function () {
        unit.classList.remove('is-transmitting');
      }, 420);
    }

    keys.forEach(function (b) {
      b.addEventListener('click', function () {
        var i = indexOfLevel(Level.get());
        var kind = b.dataset.gtKey;
        if (kind === 'level') i = +b.dataset.index;
        else if (kind === 'darker') i = Math.min(levels.length - 1, i + 1);
        else if (kind === 'lighter') i = Math.max(0, i - 1);
        else if (kind === 'toggle') i = (i === 0) ? levels.length - 1 : 0;
        Level.set(levels[i]);
        flash();
      });
    });

    if (Level.get() === null) Level.set(levels[0]);
  }

  /* ---------------------------------------------------------------
   * Add-ons.
   * ------------------------------------------------------------- */
  function initAddons(root) {
    var form = findForm(root);
    if (!form || !once(form)) return;

    var cfg = root.querySelector('[data-gt-buy]') || document.body;
    var boxes = Array.prototype.slice.call(root.querySelectorAll('[data-gt-addon]'));
    var totalEls = document.querySelectorAll('[data-gt-total]');
    var base = parseInt(cfg.dataset.gtBase || '0', 10);
    var fmt = cfg.dataset.gtFmt || '€{{amount}}';

    function total() {
      var sum = boxes.reduce(function (acc, b) {
        return acc + (b.checked ? parseInt(b.dataset.price || '0', 10) : 0);
      }, base);
      totalEls.forEach(function (t) { t.textContent = money(sum, fmt); });
    }

    boxes.forEach(function (b) { b.addEventListener('change', total); });

    // the pack picker rewrites data-gt-base, so pick the new figure up
    document.addEventListener('gt:variant', function () {
      base = parseInt(cfg.dataset.gtBase || '0', 10);
      total();
    });

    total();

    form.addEventListener('submit', function (e) {
      var extras = boxes.filter(function (b) { return b.checked && b.dataset.variant; });
      if (!extras.length) return; // plain form post

      e.preventDefault();
      var btn = form.querySelector('[data-gt-submit]');
      if (btn) { btn.disabled = true; }

      var items = [];
      var fd = new FormData(form);
      var main = { id: parseInt(fd.get('id'), 10), quantity: 1, properties: {} };
      fd.forEach(function (v, k) {
        var m = k.match(/^properties\[(.+)\]$/);
        if (m && v) main.properties[m[1]] = v;
      });
      items.push(main);
      extras.forEach(function (b) {
        items.push({ id: parseInt(b.dataset.variant, 10), quantity: 1 });
      });

      fetch(window.Shopify && window.Shopify.routes ? window.Shopify.routes.root + 'cart/add.js' : '/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: items })
      })
        .then(function (r) {
          if (!r.ok) throw new Error('cart');
          window.location.href = '/cart';
        })
        .catch(function () {
          if (btn) btn.disabled = false;
          form.submit();
        });
    });
  }

  /* ---------------------------------------------------------------
   * Sticky bar — floating pill that reveals once the shopper scrolls
   * past the buy box and hides again near the footer. Tapping it adds
   * the currently selected variant (read live from the main form) and
   * sends the shopper straight to checkout, falling back to the cart
   * page if the add fails.
   * ------------------------------------------------------------- */
  function initSticky() {
    var bar = document.querySelector('[data-gt-sticky]');
    if (!bar || !once(bar)) return;

    var cta = bar.querySelector('[data-gt-sticky-cta]');
    var labelEl = bar.querySelector('[data-gt-sticky-cta-label]');
    var defaultLabel = labelEl ? labelEl.textContent.trim() : 'Shop Now';
    var footer = document.querySelector('footer, #shopify-section-footer');

    var pastThreshold = false;
    var nearFooter = false;
    var raf = 0;

    function threshold() {
      return window.matchMedia('(max-width: 749px)').matches ? 600 : 900;
    }

    function apply() {
      bar.classList.toggle('is-on', pastThreshold && !nearFooter);
    }

    function evaluate() {
      raf = 0;
      pastThreshold = window.scrollY > threshold();
      apply();
    }

    function schedule() {
      if (raf) return;
      raf = window.requestAnimationFrame(evaluate);
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    evaluate();

    if (footer && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { nearFooter = e.isIntersecting; });
        apply();
      }, { rootMargin: '0px 0px -15% 0px' }).observe(footer);
    }

    if (!cta) return;

    cta.addEventListener('click', function () {
      if (cta.disabled) return;

      var form = findForm(document);
      var idField = form ? form.querySelector('[name="id"]') : null;
      var id = (idField && idField.value) || cta.dataset.variantFallback;
      if (!id) return;

      var qtyField = form ? form.querySelector('[name="quantity"]') : null;
      var quantity = (qtyField && parseInt(qtyField.value, 10)) || 1;

      cta.disabled = true;
      if (labelEl) labelEl.textContent = 'Adding…';

      fetch((window.Shopify && window.Shopify.routes ? window.Shopify.routes.root : '/') + 'cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id: parseInt(id, 10), quantity: quantity }] })
      })
        .then(function (r) { if (!r.ok) throw new Error('cart'); return r.json(); })
        .then(function () { window.location.href = '/checkout'; })
        .catch(function () {
          cta.disabled = false;
          if (labelEl) labelEl.textContent = defaultLabel;
          window.location.href = '/cart';
        });
    });
  }

  function boot() {
    var root = document;
    initLevelSinks();
    initVideo();
    initVlt(root);
    initVariants(root);
    initRemote(root);
    initAddons(root);
    initSticky();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', boot);
})();
