/* GT · Header light/dark foreground swap controller.
   Confirmed against screen recordings of vusistudios.com (desktop,
   tablet, mobile — 2026-09-30): as each section's top edge crosses the
   header's bottom edge, the header inverts to whichever theme keeps it
   readable against that section (dark section -> light header,
   light section -> dark header). Classification reads each section's
   own real background colour at runtime rather than a hardcoded list,
   so it stays correct as sections are edited or reordered. */
(function () {
  function luminance(r, g, b) {
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  function parseRgb(value) {
    var match = value && value.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    var parts = match[1].split(',').map(function (n) {
      return parseFloat(n);
    });
    if (parts.length < 3) return null;
    var alpha = parts.length > 3 ? parts[3] : 1;
    if (alpha === 0) return null;
    return { r: parts[0], g: parts[1], b: parts[2] };
  }

  function effectiveBg(el) {
    var candidates = [el, el.firstElementChild].filter(Boolean);
    for (var i = 0; i < candidates.length; i++) {
      var rgb = parseRgb(window.getComputedStyle(candidates[i]).backgroundColor);
      if (rgb) return rgb;
    }
    return { r: 255, g: 255, b: 255 };
  }

  function classify(el) {
    var rgb = effectiveBg(el);
    return luminance(rgb.r, rgb.g, rgb.b) < 0.5 ? 'dark' : 'light';
  }

  function init() {
    var headerWrapper = document.querySelector('.header-wrapper');
    var header = document.querySelector('.section-header');
    var main = document.getElementById('MainContent');
    if (!headerWrapper || !header || !main) return;

    var sections = Array.prototype.slice.call(main.querySelectorAll(':scope > .shopify-section'));
    if (!sections.length) return;

    var themed = sections.map(function (section) {
      return { el: section, theme: classify(section) };
    });

    var current = null;
    function setTheme(theme) {
      if (theme === current) return;
      current = theme;
      headerWrapper.setAttribute('data-theme', theme);
    }

    function update() {
      var headerBottom = header.getBoundingClientRect().bottom;
      var active = themed[0];
      for (var i = 0; i < themed.length; i++) {
        if (themed[i].el.getBoundingClientRect().top <= headerBottom) {
          active = themed[i];
        } else {
          break;
        }
      }
      setTheme(active.theme);
    }

    update();

    var ticking = false;
    function onScrollOrResize() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        update();
        ticking = false;
      });
    }

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('shopify:section:load', function () {
      themed = Array.prototype.slice.call(main.querySelectorAll(':scope > .shopify-section')).map(function (section) {
        return { el: section, theme: classify(section) };
      });
      update();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
