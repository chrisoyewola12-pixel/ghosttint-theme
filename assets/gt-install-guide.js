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

    function setActive(index) {
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
    }

    // Track which card is closest to centre as the shopper scrolls/swipes.
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setActive(cards.indexOf(entry.target));
          }
        });
      }, { root: track, threshold: [0, 0.6, 1] });
      cards.forEach(function (c) { io.observe(c); });
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () {
        cards[i].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
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

  function initWritten(root) {
    var toggle = root.querySelector('[data-gt-ig-written-toggle]');
    var panel = root.querySelector('[data-gt-ig-written-panel]');
    if (!toggle || !panel || !once(toggle)) return;

    toggle.addEventListener('click', function () {
      var open = panel.hasAttribute('data-open');
      if (open) {
        panel.removeAttribute('data-open');
        panel.hidden = false; // let the max-height transition finish, then hide
        window.setTimeout(function () {
          if (!panel.hasAttribute('data-open')) panel.hidden = true;
        }, 380);
      } else {
        panel.hidden = false;
        // Force layout so the max-height transition runs from 0.
        void panel.offsetHeight;
        panel.setAttribute('data-open', '');
      }
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
  }

  function boot() {
    document.querySelectorAll('[data-gt-ig]').forEach(function (root) {
      initCarousel(root);
      initWritten(root.closest('.gt') || document);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', boot);
})();
