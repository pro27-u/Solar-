/* =====================================================================
   SolarScrollAnimation
   ---------------------------------------------------------------------
   A vertical-scroll-scrubbed, frame-by-frame canvas animation.

   The supplied reference MP4 is NOT referenced, loaded, played or used
   anywhere in this file or in the site. It is a visual/motion reference
   only. The animation source is exclusively the supplied frame sequence
   (240 sequential JPGs -> optimised WebP, same order, same count).

   SCROLL POSITION = ANIMATION POSITION. No autoplay, no timer-driven
   frames, no carousel, no horizontal motion of any kind.

   Module responsibilities (kept separate on purpose):
     1. frame discovery    -> discoverCount()
     2. frame loading      -> loadFrame() / preload()
     3. scroll progress    -> measure() / onScroll()
     4. canvas rendering   -> render() / drawFrame()
     5. responsive sizing  -> resize()
     6. cleanup            -> destroy()
   ===================================================================== */
(function (global) {
  'use strict';

  var DEFAULTS = {
    sectionSelector: '[data-solar-animation]',
    stickySelector: '[data-solar-sticky]',
    canvasSelector: '[data-solar-canvas]',
    overlaySelector: '[data-solar-overlay]',
    cueSelector: '[data-solar-cue]',
    loaderSelector: '[data-solar-loader]',
    pctSelector: '[data-solar-pct]',
    trackSelector: '[data-solar-track]',
    countSelector: '[data-solar-count]',
    totalSelector: '[data-solar-total]',
    sceneSelector: '[data-solar-scene]',
    fallbackSelector: '[data-solar-fallback]',

    assetsBase: '',
    framePattern: 'assets/frames/frame_%frame%.webp',
    frameDigits: 6,
    countHint: 240,          // hint only - the real count is discovered
    countProbeLimit: 40,     // how far past the hint we look for extra frames

    keyframeStep: 8,         // coarse preload pass: every 8th frame
    concurrency: 6,          // parallel image requests
    responsiveness: 0.34,    // 0 = frozen, 1 = no smoothing
    snapThreshold: 0.6,      // frames closer than this snap to the target
    maxDpr: 2,

    overlayFadeEnd: 0.07,    // hero copy is gone by 7% of the scrub
    cueFadeEnd: 0.02,

    sceneStops: [
      [0.00, 'Sun'],
      [0.18, 'Energy Flow'],
      [0.36, 'Solar Light'],
      [0.55, 'Atmosphere'],
      [0.68, 'Soulshine Solar'],
      [0.78, 'Powering Real Spaces'],
      [0.88, 'Clean Savings']
    ]
  };

  var SCENES = null;

  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (!src) continue;
      for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
    }
    return target;
  }
  function clamp(v, min, max) { return v < min ? min : (v > max ? max : v); }
  function pad(n, digits) {
    var s = String(n);
    while (s.length < digits) s = '0' + s;
    return s;
  }

  function SolarScrollAnimation(options) {
    this.opts = assign({}, DEFAULTS, options || {});
    this.section = document.querySelector(this.opts.sectionSelector);
    if (!this.section) return;

    this.sticky = this.section.querySelector(this.opts.stickySelector) || this.section;
    this.canvas = this.section.querySelector(this.opts.canvasSelector);
    this.overlay = this.section.querySelector(this.opts.overlaySelector);
    this.cue = this.section.querySelector(this.opts.cueSelector);
    this.loader = this.section.querySelector(this.opts.loaderSelector);
    this.pctEl = this.section.querySelector(this.opts.pctSelector);
    this.trackEl = this.section.querySelector(this.opts.trackSelector);
    this.countEl = this.section.querySelector(this.opts.countSelector);
    this.totalEl = this.section.querySelector(this.opts.totalSelector);
    this.sceneEl = this.section.querySelector(this.opts.sceneSelector);
    this.fallbackEl = this.section.querySelector(this.opts.fallbackSelector);

    // Cinematic Showcase Stages and HUD Elements
    this.stageCards = Array.prototype.slice.call(this.section.querySelectorAll('[data-hero-stage]'));
    this.hudChapterEl = this.section.querySelector('[data-hero-hud-chapter]');
    this.hudFillEl = this.section.querySelector('[data-hero-hud-fill]');
    this.hudPctEl = this.section.querySelector('[data-hero-hud-pct]');

    this.ctx = this.canvas ? this.canvas.getContext('2d', { alpha: false }) : null;

    this.frameCount = this.opts.countHint;
    this.frames = [];            // sparse: index -> HTMLImageElement
    this.loaded = [];            // sparse: index -> true
    this.loadedCount = 0;

    this.targetProgress = 0;     // 0..1 from scroll
    this.targetFrame = 0;        // float
    this.currentFrame = 0;       // float, eased
    this.drawnIndex = -1;
    this.lastGoodIndex = 0;

    this.needsRedraw = true;
    this.destroyed = false;
    this.frozen = false;         // debug hook lock
    this.inFlight = 0;

    this.sectionTop = 0;
    this.scrubDistance = 1;
    this.dpr = 1;

    this.reduced = false;
    this.mq = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;

    this._tick = this.tick.bind(this);
    this._onScroll = this.onScroll.bind(this);
    this._onResize = this.onResize.bind(this);
    this._onMq = this.onMq.bind(this);
    this._raf = null;
  }

  /* ---------------------------------------------------------------- *
   * 1. FRAME DISCOVERY - never assume the count, verify it
   * ---------------------------------------------------------------- */
  SolarScrollAnimation.prototype.urlFor = function (index) {
    return this.opts.assetsBase +
      this.opts.framePattern.replace('%frame%', pad(index, this.opts.frameDigits));
  };

  SolarScrollAnimation.prototype.probe = function (index) {
    var self = this;
    return new Promise(function (resolve) {
      if (index < 0) return resolve(false);
      var img = new Image();
      var settled = false;
      var timer = setTimeout(function () { finish(false); }, 15000);
      function finish(ok) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        img.onload = img.onerror = null;
        resolve(ok);
      }
      img.onload = function () { finish(true); };
      img.onerror = function () { finish(false); };
      img.decoding = 'async';
      img.src = self.urlFor(index);
    });
  };

  /* The manifest supplies a starting hint; we then confirm the last frame
     that actually exists, and check whether anything follows it. */
  SolarScrollAnimation.prototype.discoverCount = function () {
    var self = this;
    var manifest = global.SOLAR_FRAMES_MANIFEST;
    var hint = (manifest && manifest.count) ? manifest.count
      : (global.SOLAR_FRAME_COUNT || this.opts.countHint);
    hint = parseInt(hint, 10) || this.opts.countHint;

    if (manifest && manifest.pattern) {
      this.opts.framePattern = manifest.pattern;
      if (manifest.digits) this.opts.frameDigits = manifest.digits;
    }

    return this.probe(hint - 1).then(function (hintEndOk) {
      if (hintEndOk) {
        // confirm the frame right after the hint does NOT exist (or extend)
        var i = hint, last = hint - 1;
        function stepUp() {
          if (i >= hint + self.opts.countProbeLimit) return Promise.resolve(last);
          return self.probe(i).then(function (ok) {
            if (!ok) return last;
            last = i;
            i++;
            return stepUp();
          });
        }
        return stepUp().then(function (lastIdx) { return lastIdx + 1; });
      }
      // The sequence is shorter than the hint: walk down to the real end.
      var j = hint - 2, found = -1;
      function stepDown() {
        if (j < 0 || (hint - 1 - j) > self.opts.countProbeLimit * 6) return Promise.resolve(found + 1);
        return self.probe(j).then(function (ok) {
          if (ok) return j + 1;
          j--;
          return stepDown();
        });
      }
      return stepDown();
    }).then(function (count) {
      self.frameCount = Math.max(1, count || hint);
      return self.frameCount;
    }).catch(function () {
      self.frameCount = hint;
      return hint;
    });
  };

  /* ---------------------------------------------------------------- *
   * 2. FRAME LOADING - frame 0 first, then coarse pass, then the rest
   * ---------------------------------------------------------------- */
  SolarScrollAnimation.prototype.loadFrame = function (index) {
    var self = this;
    if (index < 0 || index >= this.frameCount) return Promise.resolve(null);
    if (this.frames[index]) return Promise.resolve(this.frames[index]);

    return new Promise(function (resolve) {
      var img = new Image();
      img.decoding = 'async';
      var settled = false;
      var timer = setTimeout(function () { finish(null); }, 25000);
      function finish(ok) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        img.onload = img.onerror = null;
        if (ok) {
          self.frames[index] = ok;
          if (!self.loaded[index]) { self.loaded[index] = true; self.loadedCount++; }
          resolve(ok);
        } else {
          resolve(null);
        }
      }
      img.onload = function () {
        var decoded = (img.decode && img.decode()) || Promise.resolve();
        decoded.then(function () { finish(img); }, function () { finish(img); });
      };
      img.onerror = function () { finish(null); };
      img.src = self.urlFor(index);
    });
  };

  SolarScrollAnimation.prototype.preload = function () {
    var self = this;
    var n = this.frameCount;

    // Pass 1: coarse keyframes so scrubbing anywhere is instant.
    var coarse = [];
    for (var i = 0; i < n; i += this.opts.keyframeStep) coarse.push(i);
    if (coarse[coarse.length - 1] !== n - 1) coarse.push(n - 1);

    // Pass 2: everything else, chronological order.
    var coarseSet = {};
    for (var c = 0; c < coarse.length; c++) coarseSet[coarse[c]] = true;
    var rest = [];
    for (var j = 0; j < n; j++) if (!coarseSet[j]) rest.push(j);

    function run(list, onProgress) {
      return new Promise(function (resolve) {
        var cursor = 0;
        var active = 0;
        if (!list.length) return resolve();
        function pump() {
          while (active < self.opts.concurrency && cursor < list.length) {
            var idx = list[cursor++];
            active++;
            self.loadFrame(idx).then(function () {
              active--;
              if (onProgress) onProgress();
              if (cursor >= list.length && active === 0) resolve();
              else pump();
            });
          }
        }
        pump();
      });
    }

    function report() {
      var pct = Math.round((self.loadedCount / self.frameCount) * 100);
      if (self.pctEl) self.pctEl.textContent = pct + '%';
      if (pct >= 100) self.hideLoader();
    }

    this.updateTotalLabel();

    return run(coarse, report).then(function () {
      self.firstPaintReady = true;
      return run(rest, report);
    }).then(function () {
      self.hideLoader();
    });
  };

  SolarScrollAnimation.prototype.hideLoader = function () {
    if (!this.loader || this.loader.classList.contains('is-done')) return;
    this.loader.classList.add('is-done');
    var el = this.loader;
    setTimeout(function () { el.hidden = true; }, 700);
  };

  SolarScrollAnimation.prototype.updateTotalLabel = function () {
    if (this.totalEl) this.totalEl.textContent = String(this.frameCount);
  };

  /* nearest already-decoded frame, so the canvas never goes blank */
  SolarScrollAnimation.prototype.resolveFrame = function (index) {
    if (this.frames[index]) return this.frames[index];
    for (var d = 1; d <= 32; d++) {
      if (this.frames[index - d]) return this.frames[index - d];
      if (this.frames[index + d]) return this.frames[index + d];
    }
    return this.frames[this.lastGoodIndex] || null;
  };

  /* ---------------------------------------------------------------- *
   * 3. SCROLL PROGRESS  (listener only computes the target)
   * ---------------------------------------------------------------- */
  SolarScrollAnimation.prototype.measure = function () {
    var rect = this.section.getBoundingClientRect();
    this.sectionTop = rect.top + (global.pageYOffset || document.documentElement.scrollTop || 0);
    this.scrubDistance = Math.max(1, this.section.offsetHeight - global.innerHeight);
  };

  SolarScrollAnimation.prototype.onScroll = function () {
    if (this.frozen) return;
    this.scrollDirty = true;
  };

  SolarScrollAnimation.prototype.computeProgress = function () {
    var y = global.pageYOffset || document.documentElement.scrollTop || 0;
    var p = (y - this.sectionTop) / this.scrubDistance;
    this.targetProgress = clamp(p, 0, 1);
    this.targetFrame = this.targetProgress * (this.frameCount - 1);
    this.targetFrame = clamp(this.targetFrame, 0, this.frameCount - 1);
  };

  /* ---------------------------------------------------------------- *
   * 4. CANVAS RENDERING - cover fit, never stretched
   * ---------------------------------------------------------------- */
  SolarScrollAnimation.prototype.render = function () {
    var idx = clamp(Math.round(this.currentFrame), 0, this.frameCount - 1);

    if (idx !== this.drawnIndex || this.needsRedraw) {
      this.drawFrame(idx);
      this.drawnIndex = idx;
      this.needsRedraw = false;
      if (this.countEl) this.countEl.textContent = pad(idx + 1, 3);
    }

    var p = this.targetProgress;

    if (this.overlay && !this.overlayHidden && p >= this.opts.overlayFadeEnd) {
      this.overlay.style.opacity = '0';
      this.overlay.style.visibility = 'hidden';
      this.overlayHidden = true;
    } else if (this.overlay && this.overlayHidden && p < this.opts.overlayFadeEnd * 0.6) {
      this.overlay.style.visibility = '';
      this.overlay.style.opacity = '';
      this.overlayHidden = false;
    }
    if (this.overlay && !this.overlayHidden) {
      var o = clamp(1 - (p / this.opts.overlayFadeEnd), 0, 1);
      this.overlay.style.setProperty('--overlay-alpha', o.toFixed(3));
      this.overlay.style.transform = 'translate3d(0,' + ((1 - o) * -22).toFixed(2) + 'px,0)';
    }

    // Scroll-Controlled Multi-Stage Showcase Cards
    // Stage 1: Solar Harvest [0.18, 0.38]
    // Stage 2: Power Flow / Atmosphere [0.38, 0.58]
    // Stage 3: Residential Solar [0.58, 0.76]
    // Stage 4: Commercial & Industrial EPC [0.76, 0.94]
    if (this.stageCards && this.stageCards.length) {
      var stageRanges = [
        { id: 1, start: 0.16, peakStart: 0.22, peakEnd: 0.32, end: 0.37, chapter: '01 • SOLAR IRRADIANCE & HARVEST' },
        { id: 2, start: 0.37, peakStart: 0.43, peakEnd: 0.53, end: 0.58, chapter: '02 • ATMOSPHERE & POWER INVERSION' },
        { id: 3, start: 0.58, peakStart: 0.63, peakEnd: 0.72, end: 0.77, chapter: '03 • RESIDENTIAL ARCHITECTURE' },
        { id: 4, start: 0.77, peakStart: 0.82, peakEnd: 0.90, end: 0.95, chapter: '04 • COMMERCIAL & INDUSTRIAL EPC' }
      ];

      var activeChapter = '00 • SOLAR EMISSION';
      if (p < 0.16) {
        activeChapter = '00 • SOLAR EMISSION';
      } else if (p >= 0.95) {
        activeChapter = 'COMPLETION • GRID SYNCHRONIZED';
      }

      for (var s = 0; s < this.stageCards.length; s++) {
        var card = this.stageCards[s];
        var range = stageRanges[s];
        if (!range) continue;

        var alpha = 0;
        var yShift = 0;
        var isLeft = card.classList.contains('hero-stage-card--left');
        var xShift = 0;

        if (p >= range.start && p <= range.end) {
          activeChapter = range.chapter;
          if (p < range.peakStart) {
            // Entering
            alpha = (p - range.start) / (range.peakStart - range.start);
            yShift = (1 - alpha) * 28;
            xShift = (1 - alpha) * (isLeft ? -35 : 35);
          } else if (p > range.peakEnd) {
            // Exiting
            alpha = 1 - ((p - range.peakEnd) / (range.end - range.peakEnd));
            yShift = (1 - alpha) * -24;
            xShift = (1 - alpha) * (isLeft ? -25 : 25);
          } else {
            // Fully peaked
            alpha = 1;
            yShift = 0;
            xShift = 0;
          }
        }

        alpha = clamp(alpha, 0, 1);
        if (alpha > 0.01) {
          card.style.opacity = alpha.toFixed(3);
          card.style.transform = 'translateY(-50%) translate3d(' + xShift.toFixed(1) + 'px, ' + yShift.toFixed(1) + 'px, 0)';
          card.style.visibility = 'visible';
          card.setAttribute('aria-hidden', 'false');
        } else {
          card.style.opacity = '0';
          card.style.visibility = 'hidden';
          card.setAttribute('aria-hidden', 'true');
        }
      }

      // Update Cinematic Status HUD
      if (this.hudChapterEl) {
        this.hudChapterEl.textContent = activeChapter;
      }
      if (this.hudFillEl) {
        this.hudFillEl.style.transform = 'scaleX(' + clamp(p, 0, 1).toFixed(4) + ')';
      }
      if (this.hudPctEl) {
        this.hudPctEl.textContent = Math.round(p * 100) + '%';
      }
    }

    if (this.cue) {
      var c = clamp(1 - (p / this.opts.cueFadeEnd), 0, 1);
      if (c !== this.cueAlpha) {
        this.cue.style.opacity = c.toFixed(3);
        this.cue.style.visibility = c <= 0.01 ? 'hidden' : '';
        this.cueAlpha = c;
      }
    }

    if (this.trackEl) this.trackEl.style.transform = 'scaleX(' + clamp(p, 0, 1).toFixed(4) + ')';

    if (this.sceneEl && this.opts.sceneStops) {
      var name = this.opts.sceneStops[0][1];
      for (var i = 0; i < this.opts.sceneStops.length; i++) {
        if (p >= this.opts.sceneStops[i][0]) name = this.opts.sceneStops[i][1];
      }
      if (name !== this.sceneName) {
        this.sceneName = name;
        this.sceneEl.textContent = name;
      }
    }

    this.section.style.setProperty('--solar-progress', clamp(p, 0, 1).toFixed(4));
  };

  SolarScrollAnimation.prototype.drawFrame = function (index) {
    if (!this.ctx) return;
    var img = this.resolveFrame(index);
    if (!img) return;
    this.lastGoodIndex = index;

    // Real frame is on the canvas: retire the placeholder layer for good.
    if (!this.isReady) {
      this.isReady = true;
      this.section.classList.add('is-ready');
    }

    var cw = this.canvas.width;
    var ch = this.canvas.height;
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;

    // COVER, centre-anchored: the supplied sequence is centred on its
    // subject (sun -> rays -> earth -> clouds -> house -> panels), so a
    // centre crop is what keeps the composition intact on both phone
    // portrait and wide desktop. The frame is never stretched.
    var scale = Math.max(cw / iw, ch / ih);
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = (cw - dw) / 2;
    var dy = (ch - dh) / 2;

    this.ctx.clearRect(0, 0, cw, ch);
    this.ctx.drawImage(img, dx, dy, dw, dh);
  };

  /* ---------------------------------------------------------------- *
   * 5. SIZING
   * ---------------------------------------------------------------- */
  SolarScrollAnimation.prototype.resize = function () {
    if (!this.canvas) return;
    var rect = this.sticky.getBoundingClientRect();
    var dpr = clamp(global.devicePixelRatio || 1, 1, this.opts.maxDpr);
    this.dpr = dpr;
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.needsRedraw = true;
  };

  SolarScrollAnimation.prototype.onResize = function () {
    var self = this;
    if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
    this._resizeRaf = requestAnimationFrame(function () {
      self.resize();
      self.measure();
      self.computeProgress();
      self.needsRedraw = true;
    });
  };

  /* ---------------------------------------------------------------- *
   * 6. LOOP / LIFECYCLE
   * ---------------------------------------------------------------- */
  SolarScrollAnimation.prototype.tick = function () {
    if (this.destroyed) return;

    if (this.holdPin()) {
      this.render();
      this._raf = requestAnimationFrame(this._tick);
      return;
    }

    if (this.scrollDirty && !this.frozen) {
      this.scrollDirty = false;
      this.computeProgress();
    }

    if (this.reduced) {
      this.currentFrame = 0;
      this.render();
      this._raf = requestAnimationFrame(this._tick);
      return;
    }

    var target = this.targetFrame;
    var delta = target - this.currentFrame;
    if (Math.abs(delta) < this.opts.snapThreshold) {
      this.currentFrame = target;
    } else {
      this.currentFrame += delta * this.opts.responsiveness;
    }

    this.render();
    this._raf = requestAnimationFrame(this._tick);
  };

  SolarScrollAnimation.prototype.applyReducedMotion = function () {
    this.reduced = !!(this.mq && this.mq.matches);
    if (this.reduced) {
      this.section.classList.add('is-reduced-motion');
      if (this.loader) { this.loader.hidden = true; }
      if (this.cue) this.cue.style.display = 'none';
      if (this.debugProgress === undefined) this.currentFrame = 0;
      this.needsRedraw = true;
    } else {
      this.section.classList.remove('is-reduced-motion');
      if (this.cue) this.cue.style.display = '';
    }
  };

  SolarScrollAnimation.prototype.onMq = function () {
    this.applyReducedMotion();
    this.measure();
    this.computeProgress();
  };

  /* Debug / QA hook: ?p=0.5 pins the scrub to a normalised progress and
     freezes it, so a specific frame can be captured without scrolling. */
  SolarScrollAnimation.prototype.readDebugParams = function () {
    if (!global.location || !global.location.search) return;
    var q = new URLSearchParams(global.location.search);
    var p = null;
    if (q.has('p')) p = clamp(parseFloat(q.get('p')) || 0, 0, 1);
    if (q.has('frame')) {
      var f = parseInt(q.get('frame'), 10) || 0;
      p = clamp(f / Math.max(1, this.frameCount - 1), 0, 1);
    }
    if (p === null) return;
    this.pinTo(p);
  };

  /* Pin the scrub to a normalised progress and freeze it. Shared by the
     ?p= / ?frame= query hook and the programmatic QA hook. */
  SolarScrollAnimation.prototype.pinTo = function (p) {
    this.frozen = true;
    this.debugProgress = clamp(p, 0, 1);
    this.targetProgress = this.debugProgress;
    this.targetFrame = this.debugProgress * (this.frameCount - 1);
    this.currentFrame = this.targetFrame;
    this.scrollDirty = false;
    this.needsRedraw = true;
    this.render();
  };

  /* Re-assert a pinned progress on every tick so nothing else can move it. */
  SolarScrollAnimation.prototype.holdPin = function () {
    if (this.debugProgress === undefined) return false;
    var f = this.debugProgress * (this.frameCount - 1);
    this.targetProgress = this.debugProgress;
    this.targetFrame = f;
    this.currentFrame = f;
    return true;
  };

  SolarScrollAnimation.prototype.setProgress = function (p) {
    this.pinTo(p);
  };

  SolarScrollAnimation.prototype.init = function () {
    if (!this.canvas) return Promise.resolve(this);

    this.resize();
    this.measure();
    this.applyReducedMotion();
    this.computeProgress();

    var self = this;

    return this.discoverCount().then(function () {
      self.updateTotalLabel();
      self.measure();
      self.computeProgress();
      self.readDebugParams();

      // Frame 0 first - the site never waits for the full sequence.
      return self.loadFrame(0);
    }).then(function () {
      self.needsRedraw = true;
      self.render();

      global.addEventListener('scroll', self._onScroll, { passive: true });
      global.addEventListener('resize', self._onResize, { passive: true });
      global.addEventListener('orientationchange', self._onResize, { passive: true });
      global.addEventListener('load', self._onResize);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(self._onResize);
      if (self.mq) {
        if (self.mq.addEventListener) self.mq.addEventListener('change', self._onMq);
        else if (self.mq.addListener) self.mq.addListener(self._onMq);
      }
      if (global.ResizeObserver) {
        self._ro = new ResizeObserver(function () {
          if (self._roRaf) cancelAnimationFrame(self._roRaf);
          self._roRaf = requestAnimationFrame(function () { self.measure(); self.needsRedraw = true; });
        });
        self._ro.observe(document.body);
      }

      self._raf = requestAnimationFrame(self._tick);
      return self.preload();
    });
  };

  SolarScrollAnimation.prototype.destroy = function () {
    this.destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._resizeRaf) cancelAnimationFrame(this._resizeRaf);
    if (this._roRaf) cancelAnimationFrame(this._roRaf);
    global.removeEventListener('scroll', this._onScroll);
    global.removeEventListener('resize', this._onResize);
    global.removeEventListener('orientationchange', this._onResize);
    global.removeEventListener('load', this._onResize);
    if (this.mq) {
      if (this.mq.removeEventListener) this.mq.removeEventListener('change', this._onMq);
      else if (this.mq.removeListener) this.mq.removeListener(this._onMq);
    }
    if (this._ro) this._ro.disconnect();
    this.frames = [];
    this.loaded = [];
  };

  /* ------------------------------ boot ------------------------------ */
  var instance = null;

  function boot() {
    var el = document.querySelector(DEFAULTS.sectionSelector);
    if (!el) return;
    instance = new SolarScrollAnimation();
    instance.init().catch(function (err) {
      if (global.console && console.warn) console.warn('[SolarScrollAnimation]', err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.SolarScrollAnimation = {
    get instance() { return instance; },
    setProgress: function (p) { if (instance) instance.setProgress(p); },
    frameCount: function () { return instance ? instance.frameCount : 0; },
    destroy: function () { if (instance) instance.destroy(); }
  };
})(window);
