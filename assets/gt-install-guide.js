/* GT · Installation guide behaviour.
   Positioning algorithm (safe side-offset, mobile stack / desktop row,
   pointer drag) is ported directly from the site's own "Customer spotlight"
   carousel (assets/section-customer-spotlight.css + sections/customer-
   spotlight.liquid) so this carousel matches that proven, correctly-
   contained implementation instead of a hand-tuned approximation. Layered
   on top: lazy video-source loading and play/pause/mute/scrub controls,
   which that section doesn't need (its videos are short autoplay loops). */
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
    var active = 0;

    function isDesktop() {
      return window.matchMedia('(min-width: 750px)').matches;
    }

    function loadSource(card) {
      var video = card.querySelector('[data-gt-ig-video]');
      if (!video) return;
      var source = video.querySelector('source[data-src]');
      if (source) {
        source.src = source.dataset.src;
        source.removeAttribute('data-src');
        video.load();
      }
    }

    function playVideo(card) {
      var video = card.querySelector('[data-gt-ig-video]');
      if (!video) return;
      loadSource(card);
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
      var playBtn = card.querySelector('[data-gt-ig-play]');
      if (playBtn) playBtn.classList.add('is-playing');
    }

    function pauseVideo(card) {
      var video = card.querySelector('[data-gt-ig-video]');
      if (video && !video.paused) video.pause();
    }

    function renderDesktop() {
      cards.forEach(function (card, i) {
        card.style.zIndex = '';
        card.style.opacity = '';
        card.style.transform = '';
        card.style.pointerEvents = '';
        card.classList.toggle('is-active', i === active);
        playVideo(card);
      });
      dots.forEach(function (d) { d.classList.remove('is-active'); });
    }

    // Same computation as customer-spotlight: the side cards' offset is
    // capped so they can never push past the carousel's own half-width,
    // regardless of card width or viewport — this is what the previous
    // hand-tuned ratio kept getting wrong at narrow widths.
    function getSafeSideOffset() {
      var trackWidth = track.getBoundingClientRect().width;
      var sidePadding = 24;
      var sideScale = 0.8;
      var preferredOffset = 80;
      var maxOffset = (window.innerWidth / 2) - sidePadding - ((trackWidth * sideScale) / 2);
      return Math.max(0, Math.min(preferredOffset, maxOffset));
    }

    function renderMobile() {
      var safeOffset = getSafeSideOffset();
      var safeRotation = 1;
      var sideScale = 0.8;

      cards.forEach(function (card, index) {
        var offset = index - active;
        if (offset > cards.length / 2) offset -= cards.length;
        if (offset < -cards.length / 2) offset += cards.length;

        var distance = Math.abs(offset);
        card.classList.toggle('is-active', offset === 0);

        if (distance > 1) {
          card.style.opacity = '0';
          card.style.zIndex = '0';
          card.style.pointerEvents = 'none';
          card.style.transform = 'translate3d(0, 0, 0) scale(0.82) rotate(0deg)';
        } else {
          card.style.opacity = offset === 0 ? '1' : '.42';
          card.style.zIndex = String(50 - distance);
          card.style.pointerEvents = offset === 0 ? 'auto' : 'none';
          card.style.transform = 'translate3d(' + (offset * safeOffset).toFixed(1) + 'px, 0, 0) scale(' + (offset === 0 ? 1 : sideScale) + ') rotate(' + (offset * safeRotation) + 'deg)';
        }

        if (offset === 0) playVideo(card);
        else pauseVideo(card);
      });

      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === active); });
    }

    function render() {
      isDesktop() ? renderDesktop() : renderMobile();
    }

    function setActive(index) {
      if (index < 0) index = cards.length - 1;
      if (index >= cards.length) index = 0;
      active = index;
      render();
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { setActive(i); });
    });

    // Tapping a peeking (non-active) card brings it to the front, same as
    // clicking its dot — but ignore taps on the active card's own controls.
    cards.forEach(function (card, i) {
      card.addEventListener('click', function (e) {
        if (i === active) return;
        if (e.target.closest('[data-gt-ig-controls]')) return;
        setActive(i);
      });
    });

    // Pointer-based drag/swipe, ported from customer-spotlight (mobile only —
    // desktop lays every card out in a static row with nothing to drag).
    var startX = 0, currentX = 0, dragging = false, swiped = false;

    track.addEventListener('pointerdown', function (e) {
      if (isDesktop()) return;
      dragging = true;
      swiped = false;
      startX = e.clientX;
      currentX = e.clientX;
    });
    track.addEventListener('pointermove', function (e) {
      if (!dragging || isDesktop()) return;
      currentX = e.clientX;
    });
    window.addEventListener('pointerup', function () {
      if (!dragging || isDesktop()) { dragging = false; return; }
      var diff = currentX - startX;
      if (Math.abs(diff) > 40) {
        swiped = true;
        setActive(diff < 0 ? active + 1 : active - 1);
        window.setTimeout(function () { swiped = false; }, 0);
      }
      dragging = false;
    });
    track.addEventListener('pointercancel', function () { dragging = false; });

    window.addEventListener('resize', function () {
      window.clearTimeout(track._gtIgResizeT);
      track._gtIgResizeT = window.setTimeout(render, 120);
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) render();
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

    render();
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
