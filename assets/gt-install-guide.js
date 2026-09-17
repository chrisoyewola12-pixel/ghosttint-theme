/* GT · Installation guide behaviour. No dependencies. */
(function () {
  'use strict';

  function once(el) {
    if (!el || el.dataset.gtIgInit) return false;
    el.dataset.gtIgInit = '1';
    return true;
  }

  function initCarousel(root) {
    var track = root.querySelector('[data-gt-ig-track]');
    if (!track || !once(track)) return;

    var cards = Array.prototype.slice.call(track.querySelectorAll('[data-gt-ig-card]'));
    if (!cards.length) return;

    var dotsWrap = root.querySelector('[data-gt-ig-dots]');
    var dots = dotsWrap ? Array.prototype.slice.call(dotsWrap.querySelectorAll('[data-gt-ig-dot]')) : [];
    var activeIndex = 0;

    // Cards are stacked on the same center point (see gt-install-guide.css)
    // and pulled apart here with per-card custom properties, the same
    // transform-based technique VUSI's own carousel uses instead of a
    // scrolling strip — offset ratio (.177 of card width), scale (.8) and
    // opacity (.42) for neighbours are matched to VUSI's measured values.
    function positionCards() {
      var cardW = cards[0] ? cards[0].getBoundingClientRect().width : 0;
      cards.forEach(function (card, i) {
        var diff = i - activeIndex;
        if (Math.abs(diff) > 1) {
          card.style.setProperty('--gt-ig-opacity', 0);
          card.style.setProperty('--gt-ig-offset', diff > 0 ? cardW : -cardW);
          return;
        }
        var offset = diff * cardW * 0.177;
        card.style.setProperty('--gt-ig-offset', offset.toFixed(2));
        card.style.setProperty('--gt-ig-scale', diff === 0 ? 1 : 0.8);
        card.style.setProperty('--gt-ig-opacity', diff === 0 ? 1 : 0.42);
      });
    }

    function setActive(index) {
      if (index < 0 || index >= cards.length) return;
      if (index === activeIndex && cards[index].classList.contains('is-active')) return;
      activeIndex = index;

      cards.forEach(function (card, i) {
        var isActive = i === index;
        card.classList.toggle('is-active', isActive);

        var video = card.querySelector('[data-gt-ig-video]');
        if (!video) return;

        if (isActive) {
          var source = video.querySelector('source[data-src]');
          if (source) {
            source.src = source.dataset.src;
            source.removeAttribute('data-src');
            video.load();
          }
          var p = video.play();
          if (p && p.catch) p.catch(function () {});
          var playBtn = card.querySelector('[data-gt-ig-play]');
          if (playBtn) playBtn.classList.add('is-playing');
        } else if (!video.paused) {
          video.pause();
        }
      });

      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === index); });
      positionCards();
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { setActive(i); });
    });

    // Tapping a peeking (non-active) card brings it to the front, same as
    // clicking its dot — but ignore taps on the active card's own controls.
    cards.forEach(function (card, i) {
      card.addEventListener('click', function (e) {
        if (i === activeIndex) return;
        if (e.target.closest('[data-gt-ig-controls]')) return;
        setActive(i);
      });
    });

    // Basic drag/swipe: works for touch and mouse via pointer events.
    var dragState = null;
    track.addEventListener('pointerdown', function (e) {
      dragState = { startX: e.clientX, moved: false };
    });
    track.addEventListener('pointermove', function (e) {
      if (!dragState) return;
      if (Math.abs(e.clientX - dragState.startX) > 8) dragState.moved = true;
    });
    window.addEventListener('pointerup', function (e) {
      if (!dragState) return;
      var dx = e.clientX - dragState.startX;
      if (dragState.moved && Math.abs(dx) > 40) {
        setActive(dx < 0 ? activeIndex + 1 : activeIndex - 1);
      }
      dragState = null;
    });

    window.addEventListener('resize', function () {
      window.clearTimeout(track._gtIgResizeT);
      track._gtIgResizeT = window.setTimeout(positionCards, 120);
    });

    cards.forEach(function (card) {
      var video = card.querySelector('[data-gt-ig-video]');
      if (!video) return;

      var playBtn = card.querySelector('[data-gt-ig-play]');
      var muteBtn = card.querySelector('[data-gt-ig-mute]');
      var scrub = card.querySelector('[data-gt-ig-scrub]');
      var scrubbing = false;

      if (playBtn) {
        playBtn.addEventListener('click', function () {
          if (video.paused) {
            var p = video.play();
            if (p && p.catch) p.catch(function () {});
          } else {
            video.pause();
          }
        });
        video.addEventListener('play', function () { playBtn.classList.add('is-playing'); });
        video.addEventListener('pause', function () { playBtn.classList.remove('is-playing'); });
      }

      if (muteBtn) {
        muteBtn.addEventListener('click', function () {
          video.muted = !video.muted;
          muteBtn.classList.toggle('is-unmuted', !video.muted);
        });
      }

      if (scrub) {
        video.addEventListener('timeupdate', function () {
          if (scrubbing || !video.duration) return;
          scrub.value = (video.currentTime / video.duration) * 100;
        });
        scrub.addEventListener('pointerdown', function () { scrubbing = true; });
        scrub.addEventListener('pointerup', function () { scrubbing = false; });
        scrub.addEventListener('input', function () {
          if (!video.duration) return;
          video.currentTime = (scrub.value / 100) * video.duration;
        });
      }
    });

    setActive(0);
  }

  function boot() {
    document.querySelectorAll('[data-gt-ig]').forEach(function (root) {
      initCarousel(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', boot);
})();
