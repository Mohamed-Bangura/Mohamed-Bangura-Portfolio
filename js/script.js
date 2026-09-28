/* ==========================================================================
   Mohamed Bangura - portfolio behaviour
   Vanilla ES2018. No dependencies. Loaded with `defer`.

   Modules
   01  Utilities
   02  Signature intro
   03  Header + mobile navigation
   04  Active section tracking
   05  Scroll reveals
   06  Back to top
   07  Contact form (Web3Forms)
   08  Footer year
   09  Boot

   Hard rules honoured here
   - Every module is optional: one failure never blocks the page.
   - The intro's decorative layer is aria-hidden; its skip control is not,
     and it is always reachable by keyboard.
   - The intro is always removed from the DOM, and never traps focus.
   - No fake loading percentage is ever displayed.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- 01 */
  var REDUCED = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  var STORE_KEY = 'mb-intro-seen';
  var DESKTOP_NAV = '(min-width: 56rem)';

  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }
  function $$(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

  /* sessionStorage can throw in private mode / sandboxed frames. */
  function readSeen() {
    try {
      return window.sessionStorage.getItem(STORE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }
  function writeSeen() {
    try {
      window.sessionStorage.setItem(STORE_KEY, '1');
    } catch (e) {
      /* non-fatal: the intro simply replays on the next visit */
    }
  }

  function once(fn) {
    try {
      fn();
    } catch (e) {
      if (window.console && console.error) console.error('[mb] module failed:', e);
    }
  }

  /* Scroll lock, reference counted.
     The intro and the mobile menu both lock the page, and they overlap during
     the first second, so releasing one must not unlock the other. */
  var Lock = (function () {
    var holders = [];

    function apply() {
      if (holders.length) document.body.classList.add('is-locked');
      else document.body.classList.remove('is-locked');
    }

    return {
      hold: function (name) {
        if (holders.indexOf(name) === -1) holders.push(name);
        apply();
      },
      release: function (name) {
        var i = holders.indexOf(name);
        if (i !== -1) holders.splice(i, 1);
        apply();
      }
    };
  })();

  /* ---------------------------------------------------------------- 02 */
  /* Cinematic brand intro, roughly five seconds.
     Timeline: 0-1s monogram, 1-2s name and role, 2-4s statement,
     4-5s transition out. The decorative layer is aria-hidden in the markup;
     the skip control sits outside it, so it stays in the tab order.
     The markup is display:none unless <html class="js">, so a script failure
     can never leave a blank screen.                                     */
  var Intro = {
    EXIT_AT: 4300,     /* ms before the transition out starts          */
    LIFETIME: 6000,    /* failsafe: force-remove no matter what        */
    FADE_MS: 700,      /* ms the transition out lasts                  */
    STILL_MS: 900,     /* reduced-motion static hold                   */

    run: function () {
      var el = $('#intro');
      if (!el) return;

      /* Already seen this browsing session, or the visitor asked to land
         directly on a section: do not interrupt them. */
      var skip = readSeen() || window.location.hash.length > 1;
      writeSeen();

      el._failsafe = setTimeout(function () {
        Intro.destroy(el);
      }, Intro.LIFETIME);

      if (skip) {
        Intro.destroy(el);
        return;
      }

      Lock.hold('intro');

      /* Skip control: a real button, plus Escape for anyone who reaches
         for the keyboard without reading the corner of the screen. */
      var skipBtn = $('[data-intro-skip]', el);
      if (skipBtn) {
        skipBtn.addEventListener('click', function () {
          Intro.destroy(el);
        });
      }

      document.addEventListener('keydown', function onKey(e) {
        if (e.key !== 'Escape') return;
        document.removeEventListener('keydown', onKey);
        Intro.destroy(el);
      });

      if (REDUCED.matches) {
        /* Brief, calm brand reveal. No ring spin, no sweeping bar. */
        el.classList.add('is-active');
        setTimeout(function () {
          Intro.destroy(el);
        }, Intro.STILL_MS);
        return;
      }

      /* One frame, so the display change and the animation timeline are
         committed together and nothing flashes. */
      requestAnimationFrame(function () {
        el.classList.add('is-active');
      });

      setTimeout(function () {
        Intro.destroy(el);
      }, Intro.EXIT_AT);
    },

    destroy: function (el) {
      if (!el || el.dataset.done === '1') return;
      el.dataset.done = '1';
      clearTimeout(el._failsafe);
      Lock.release('intro');

      var remove = function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      };

      /* Never shown (skipped, or a failure before the first frame):
         drop it at once, there is nothing to fade out. */
      if (!el.classList.contains('is-active')) {
        remove();
        return;
      }

      el.classList.add('is-leaving');
      if (REDUCED.matches) remove();
      else window.setTimeout(remove, Intro.FADE_MS);
    }
  };

  /* ---------------------------------------------------------------- 03 */
  var Nav = {
    init: function () {
      var toggle = $('.js-nav-toggle');
      var menu = $('#primary-menu');
      if (!toggle || !menu) return;

      var mq = window.matchMedia(DESKTOP_NAV);

      function isOpen() {
        return toggle.getAttribute('aria-expanded') === 'true';
      }

      function setOpen(open) {
        menu.hidden = !open;
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open && !mq.matches) Lock.hold('nav');
        else Lock.release('nav');
      }

      /* Viewport grew past the mobile breakpoint: reset cleanly. */
      function onBreakpointChange() {
        if (mq.matches) {
          menu.hidden = false;
          toggle.setAttribute('aria-expanded', 'false');
          Lock.release('nav');
        } else if (!isOpen()) {
          menu.hidden = false;
        }
      }
      if (mq.addEventListener) mq.addEventListener('change', onBreakpointChange);
      else if (mq.addListener) mq.addListener(onBreakpointChange);

      /* Mobile start: collapsed. The markup ships un-hidden so that a
         scripting failure still leaves the full bar visible on desktop. */
      if (!mq.matches) setOpen(false);

      toggle.addEventListener('click', function () {
        setOpen(!isOpen());
      });

      /* Close after choosing a destination. */
      $$('.nav__link', menu).forEach(function (link) {
        link.addEventListener('click', function () {
          setOpen(false);
        });
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isOpen() && !mq.matches) {
          setOpen(false);
          toggle.focus();
        }
      });

      document.addEventListener('click', function (e) {
        if (isOpen() && !mq.matches && !menu.contains(e.target) && !toggle.contains(e.target)) {
          setOpen(false);
        }
      });

      document.addEventListener('focusin', function (e) {
        if (isOpen() && !mq.matches && !menu.contains(e.target) && !toggle.contains(e.target)) {
          setOpen(false);
        }
      });
    }
  };

  /* Sticky header shadow */
  var Header = {
    init: function () {
      var header = $('.site-header');
      if (!header) return;
      var ticking = false;

      var update = function () {
        header.classList.toggle('is-stuck', window.scrollY > 8);
        ticking = false;
      };

      window.addEventListener(
        'scroll',
        function () {
          if (!ticking) {
            ticking = true;
            window.requestAnimationFrame(update);
          }
        },
        { passive: true }
      );
      update();
    }
  };

  /* ---------------------------------------------------------------- 04 */
  var ActiveSection = {
    init: function () {
      var links = $$('.js-section-link');
      if (!links.length || !('IntersectionObserver' in window)) return;

      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var id = entry.target.id;
            links.forEach(function (link) {
              if (link.getAttribute('href') === '#' + id) link.setAttribute('aria-current', 'true');
              else link.removeAttribute('aria-current');
            });
          });
        },
        { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
      );

      links.forEach(function (link) {
        var id = (link.getAttribute('href') || '').slice(1);
        var section = id && document.getElementById(id);
        if (section) observer.observe(section);
      });
    }
  };

  /* ---------------------------------------------------------------- 05 */
  var Reveal = {
    init: function () {
      var items = $$('[data-reveal]');
      if (!items.length) return;

      if (REDUCED.matches || !('IntersectionObserver' in window)) {
        items.forEach(function (el) {
          el.classList.add('is-revealed');
        });
        return;
      }

      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
      );

      items.forEach(function (el) {
        observer.observe(el);
      });

      /* Safety net: never leave content permanently invisible. */
      window.setTimeout(function () {
        items.forEach(function (el) {
          if (el.getBoundingClientRect().top < window.innerHeight) {
            el.classList.add('is-revealed');
          }
        });
      }, 2500);
    }
  };

  /* ---------------------------------------------------------------- 06 */
  var BackToTop = {
    init: function () {
      var btn = $('.to-top');
      if (!btn) return;
      var ticking = false;

      var update = function () {
        btn.classList.toggle('is-visible', window.scrollY > 640);
        ticking = false;
      };

      window.addEventListener(
        'scroll',
        function () {
          if (!ticking) {
            ticking = true;
            window.requestAnimationFrame(update);
          }
        },
        { passive: true }
      );

      btn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: REDUCED.matches ? 'auto' : 'smooth' });
        var main = $('#main-content');
        if (main) {
          main.setAttribute('tabindex', '-1');
          main.focus({ preventScroll: true });
        }
      });

      update();
    }
  };

  /* ---------------------------------------------------------------- 07 */
  /* Web3Forms delivery. The public access key already lives in the markup;
     nothing secret is added by this script.                            */
  var Form = {
    endpoint: 'https://api.web3forms.com/submit',

    rules: {
      name: function (v) {
        if (!v) return 'Please enter your name.';
        if (v.length < 2) return 'Please enter at least 2 characters.';
        return '';
      },
      email: function (v) {
        if (!v) return 'Please enter your email address.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Please enter a valid email address.';
        return '';
      },
      project_type: function (v) {
        if (!v) return 'Please choose a project type.';
        return '';
      },
      message: function (v) {
        if (!v) return 'Please tell me about your project.';
        if (v.length < 20) return 'A little more detail helps, 20 characters or more.';
        return '';
      }
    },

    init: function () {
      var form = $('#contact-form');
      if (!form) return;

      var status = $('#form-status');
      var submit = form.querySelector('button[type="submit"]');
      var submitLabel = submit ? submit.innerHTML : '';
      var busy = false;

      function fieldWrap(input) {
        return input.closest('.form__field') || input.parentNode;
      }

      function showError(input, message) {
        var wrap = fieldWrap(input);
        var slot = wrap.querySelector('.form__error');
        wrap.classList.add('has-error');
        input.setAttribute('aria-invalid', 'true');
        if (slot) slot.textContent = message;
      }

      function clearError(input) {
        var wrap = fieldWrap(input);
        wrap.classList.remove('has-error');
        input.removeAttribute('aria-invalid');
      }

      function setStatus(kind, message) {
        if (!status) return;
        status.textContent = message;
        status.className =
          'form__status' + (kind ? ' form__status--' + kind + ' is-visible' : '');
      }

      function validate(input, showMessage) {
        var rule = Form.rules[input.name];
        if (!rule) return true;
        var message = rule(input.value.trim());
        if (message && showMessage) showError(input, message);
        if (!message) clearError(input);
        return !message;
      }

      $$('.form__control', form).forEach(function (input) {
        input.addEventListener('blur', function () {
          if (input.value.trim()) validate(input, true);
        });
        input.addEventListener('input', function () {
          if (fieldWrap(input).classList.contains('has-error')) validate(input, true);
        });
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        /* Honeypot: a real visitor never sees or fills this. */
        var hp = form.querySelector('input[name="_hp"]');
        if (hp && hp.value) return;

        var firstBad = null;
        $$('.form__control', form).forEach(function (input) {
          var ok = validate(input, true);
          if (!ok && !firstBad) firstBad = input;
        });

        if (firstBad) {
          setStatus('error', 'Please check the highlighted fields and try again.');
          firstBad.focus();
          return;
        }

        if (busy) return;
        busy = true;

        setStatus('sending', 'Sending your message...');
        if (submit) {
          submit.disabled = true;
          submit.textContent = 'Sending...';
        }

        var done = function (kind, message) {
          busy = false;
          setStatus(kind, message);
          if (submit) {
            submit.disabled = false;
            submit.innerHTML = submitLabel;
          }
          if (kind === 'success') form.reset();
        };

        var payload = new FormData(form);
        payload.delete('_hp');

        fetch(Form.endpoint, {
          method: 'POST',
          body: payload,
          headers: { Accept: 'application/json' }
        })
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json().catch(function () {
              return null;
            });
          })
          .then(function (data) {
            if (data && data.success === false) {
              throw new Error(data.message || 'Rejected by provider');
            }
            done('success', "Thanks, your message is on its way. I'll reply as soon as I can.");
          })
          .catch(function (err) {
            if (window.console && console.error) console.error('[mb] form:', err);
            done(
              'error',
              'Sorry, that did not send. Please email me directly at prosperbangura9@gmail.com.'
            );
          });
      });
    }
  };

  /* ---------------------------------------------------------------- 08 */
  var Year = {
    init: function () {
      var slots = $$('[data-year]');
      if (!slots.length) return;
      var now = String(new Date().getFullYear());
      slots.forEach(function (el) {
        el.textContent = now;
      });
    }
  };

  /* ---------------------------------------------------------------- 09 */
  function boot() {
    once(Intro.run);
    once(Nav.init);
    once(Header.init);
    once(ActiveSection.init);
    once(Reveal.init);
    once(BackToTop.init);
    once(Form.init);
    once(Year.init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
