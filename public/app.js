/**
 * Soulshine Renewable Energy — Frontend Interactions
 * Surat, Gujarat, India
 * Progressive enhancements layer without modifying the core solar scroll animation.
 */
(function () {
  'use strict';

  /* ---- Header: blur state on scroll & Mobile Menu ---- */
  var header = document.querySelector('[data-header]');
  var toggle = document.querySelector('[data-nav-toggle]');
  var mobileNav = document.querySelector('[data-mobile-nav]');

  if (toggle && mobileNav) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      mobileNav.hidden = open;
      if (header) header.classList.toggle('is-open', !open);
    });

    mobileNav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        toggle.setAttribute('aria-expanded', 'false');
        mobileNav.hidden = true;
        if (header) header.classList.remove('is-open');
      }
    });
  }

  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', (window.pageYOffset || 0) > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- Project Category Filter with Smooth Transitions ---- */
  var filterButtons = document.querySelectorAll('[data-project-filter]');
  var projectCards = document.querySelectorAll('[data-project-category]');

  if (filterButtons.length && projectCards.length) {
    filterButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var category = btn.getAttribute('data-project-filter');
        filterButtons.forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');

        var visibleCount = 0;
        projectCards.forEach(function (card) {
          var cardCat = card.getAttribute('data-project-category');
          if (category === 'all' || cardCat === category) {
            card.style.display = 'flex';
            card.style.transitionDelay = (visibleCount * 0.08) + 's';
            card.classList.add('is-inview');
            visibleCount++;
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  /* ---- Interactive Solar Savings Explorer ---- */
  var calcType = document.getElementById('calc-property-type');
  var calcBill = document.getElementById('calc-monthly-bill');
  var outCap = document.getElementById('out-recommended-cap');
  var outGen = document.getElementById('out-est-units');
  var outArea = document.getElementById('out-roof-area');

  function updateSolarCalc() {
    if (!calcType || !calcBill || !outCap || !outGen || !outArea) return;
    var type = calcType.value;
    var bill = parseFloat(calcBill.value) || 3000;

    // Realistic calculation based on Gujarat solar tariff (~Rs 7-8/unit residential, Rs 8-9/unit commercial)
    // 1 kW solar in Gujarat generates ~120 - 135 units/month
    // Roof area needed is ~80 - 100 sq.ft per kW
    var kw = 3;
    if (type === 'residential') {
      if (bill <= 3000) kw = 3;
      else if (bill <= 6000) kw = 5;
      else if (bill <= 12000) kw = 8;
      else kw = 10;
    } else if (type === 'commercial') {
      if (bill <= 15000) kw = 12;
      else if (bill <= 40000) kw = 25;
      else if (bill <= 100000) kw = 50;
      else kw = 80;
    } else { // industrial
      if (bill <= 50000) kw = 40;
      else if (bill <= 150000) kw = 100;
      else if (bill <= 500000) kw = 250;
      else kw = 500;
    }

    var unitsPerMonth = Math.round(kw * 125);
    var areaNeeded = Math.round(kw * 90);

    outCap.textContent = kw + ' kWp';
    outGen.textContent = '~' + unitsPerMonth.toLocaleString() + ' kWh / month';
    outArea.textContent = '~' + areaNeeded.toLocaleString() + ' sq. ft.';
  }

  if (calcType && calcBill) {
    calcType.addEventListener('change', updateSolarCalc);
    calcBill.addEventListener('change', updateSolarCalc);
    updateSolarCalc();
  }

  /* ---- Consultation Form Handler ---- */
  var contactForm = document.querySelector('[data-consultation-form]');
  if (contactForm) {
    var statusNote = contactForm.querySelector('[data-form-status]');
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = (contactForm.querySelector('[name="name"]') || {}).value || '';
      var phone = (contactForm.querySelector('[name="phone"]') || {}).value || '';
      var email = (contactForm.querySelector('[name="email"]') || {}).value || '';
      var solution = (contactForm.querySelector('[name="solution"]') || {}).value || 'Solar EPC';
      var city = (contactForm.querySelector('[name="city"]') || {}).value || 'Surat';

      if (!name.trim() || !phone.trim()) {
        if (statusNote) {
          statusNote.textContent = 'Please enter your name and phone/WhatsApp number.';
          statusNote.classList.add('is-error');
        }
        return;
      }

      if (statusNote) {
        statusNote.classList.remove('is-error');
        statusNote.textContent = 'Thank you, ' + name + '! Your solar consultation request has been received. Our Surat EPC team will contact you shortly.';
      }
      contactForm.reset();
    });
  }

  /* ============================================================
   * PREMIUM SCROLL-BASED ANIMATION SYSTEM
   * Luxury Automotive & Architectural Motion Choreography
   * Strictly applies to sections AFTER the hero (#solar-hero is excluded)
   * ============================================================ */
  function initScrollAnimations() {
    // Respect user's motion preferences
    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // Verify IntersectionObserver support
    if (!('IntersectionObserver' in window)) return;

    // Mark HTML as JS-ready to activate reveal styles
    document.documentElement.classList.add('js-ready');

    // Query all sections strictly AFTER the hero
    var animatedSections = document.querySelectorAll('main > section:not(#solar-hero), .site-footer');

    // General Section Observer
    var sectionObserverOptions = {
      root: null,
      threshold: 0.18,
      rootMargin: '0px 0px -50px 0px'
    };

    var sectionObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-inview');

          // Process curtain transition trigger
          if (entry.target.hasAttribute('data-process-curtain-section') || entry.target.id === 'process') {
            entry.target.classList.add('is-curtain-open');
          }

          // Final CTA section depth trigger
          if (entry.target.hasAttribute('data-cta-section') || entry.target.id === 'contact') {
            var prevSection = document.querySelector('.instagram-section');
            if (prevSection) prevSection.classList.add('is-leaving');
          }

          // Trigger inner reveal elements
          var innerTargets = entry.target.querySelectorAll(
            '.section-head, .eyebrow, .section-title, .section-subtitle, .about-lead, .about-body, .about-media, .about-copy, .savings-card, .contact-form-card'
          );
          innerTargets.forEach(function (el) {
            el.classList.add('is-inview');
          });

          // Trigger cards inside section with natural stagger
          var childCards = entry.target.querySelectorAll(
            '.pillar-card, .why-card, .flow-step, .process-card, .insta-card, .contact-detail-item'
          );
          childCards.forEach(function (card, index) {
            card.style.setProperty('--stagger', index);
            card.classList.add('is-inview');
          });

          // Unobserve section once revealed
          observer.unobserve(entry.target);
        }
      });
    }, sectionObserverOptions);

    animatedSections.forEach(function (sec) {
      sectionObserver.observe(sec);
    });

    // Dedicated observer for Project Cards with directional wipes
    var projectCardObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-inview');
          observer.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      threshold: 0.16,
      rootMargin: '0px 0px -40px 0px'
    });

    var projectCardsList = document.querySelectorAll('.project-card');
    projectCardsList.forEach(function (card) {
      projectCardObserver.observe(card);
    });

    // Dedicated observer for Process section curtain
    var processSec = document.querySelector('[data-process-curtain-section]');
    if (processSec) {
      var curtainObserver = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            processSec.classList.add('is-curtain-open');
            var pCards = processSec.querySelectorAll('.process-card');
            pCards.forEach(function (c, idx) {
              setTimeout(function () {
                c.classList.add('is-inview');
              }, 400 + idx * 90);
            });
            observer.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px'
      });
      curtainObserver.observe(processSec);
    }

    // Scroll-Driven Controllers: About Layered Depth, Solutions Horizontal Track, Why Parallax, Energy Conduit, Transformation, Editorial Words
    var aboutSection = document.querySelector('[data-about-section]');
    var aboutLayerBg = document.querySelector('[data-about-layer="bg"]');
    var aboutLayerGold = document.querySelector('[data-about-layer="gold"]');
    var aboutLayerImg = document.querySelector('[data-about-layer="image"]');
    var aboutLayerText = document.querySelector('[data-about-layer="text"]');

    var solTrack = document.querySelector('[data-solutions-scroll-track]');
    var solHorizontalTrack = document.querySelector('[data-solutions-horizontal-track]');
    var solViewport = document.querySelector('[data-solutions-viewport]');
    var solNavProgress = document.querySelector('[data-solutions-nav-progress]');
    var solNavProgress2 = document.querySelector('[data-solutions-nav-progress-2]');
    var solPanels = document.querySelectorAll('[data-solution-panel]');
    var solSteps = document.querySelectorAll('[data-step-index]');

    var whySection = document.querySelector('[data-why-section]');
    var parallaxBg = document.querySelector('[data-parallax-bg]');
    var parallaxGold = document.querySelector('[data-parallax-gold]');

    var storySection = document.querySelector('[data-story-section]');
    var energyPath = document.querySelector('[data-energy-path]');
    var energySpark = document.querySelector('[data-energy-spark]');
    var energyConduit = document.querySelector('[data-energy-conduit]');

    var transSection = document.querySelector('[data-transformation-section]');
    var transAfter = document.querySelector('[data-transform-after]');
    var transDivider = document.querySelector('[data-transform-divider]');
    var hudIndep = document.querySelector('[data-hud-independence]');
    var hudOffset = document.querySelector('[data-hud-offset]');
    var hudState = document.querySelector('[data-hud-state]');

    var typoWords = document.querySelectorAll('[data-typo-moment]');

    var ctaSection = document.querySelector('[data-cta-section]');
    var instaSection = document.querySelector('.instagram-section');

    var ticking = false;

    function onScrollFrame() {
      var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      var winH = window.innerHeight || 800;

      // 0. About Section: Deep 3D Layered Depth Parallax
      if (aboutSection) {
        var aboutRect = aboutSection.getBoundingClientRect();
        if (aboutRect.top < winH && aboutRect.bottom > 0) {
          var aboutProgress = (winH - aboutRect.top) / (winH + aboutRect.height);
          var normalized = (aboutProgress - 0.5) * 2; // -1 to +1
          if (aboutLayerBg) {
            aboutLayerBg.style.transform = 'translate3d(0, ' + (normalized * 22) + 'px, 0)';
          }
          if (aboutLayerGold) {
            aboutLayerGold.style.transform = 'translate3d(0, ' + (-normalized * 15) + 'px, 0)';
          }
          if (aboutLayerImg) {
            aboutLayerImg.style.transform = 'translate3d(0, ' + (-normalized * 32) + 'px, 0)';
          }
          if (aboutLayerText) {
            aboutLayerText.style.transform = 'translate3d(0, ' + (normalized * 12) + 'px, 0)';
          }
        }
      }

      // 1. Solutions Horizontal Scroll Scrubbing
      if (solTrack && solHorizontalTrack && solViewport) {
        var trackRect = solTrack.getBoundingClientRect();
        var trackTop = scrollY + trackRect.top;
        var trackHeight = solTrack.offsetHeight;
        var scrollableDist = trackHeight - winH;

        if (scrollableDist > 0) {
          var progress = (scrollY - trackTop) / scrollableDist;
          progress = Math.max(0, Math.min(1, progress));

          var maxTranslate = solHorizontalTrack.scrollWidth - solViewport.clientWidth;
          if (maxTranslate > 0) {
            solHorizontalTrack.style.transform = 'translate3d(' + (-progress * maxTranslate) + 'px, 0, 0)';
          }

          // Active panel state and progress bar fill
          var activeIndex = 0;
          if (progress < 0.38) {
            activeIndex = 0;
            if (solNavProgress) solNavProgress.style.width = Math.min(100, (progress / 0.38) * 100) + '%';
            if (solNavProgress2) solNavProgress2.style.width = '0%';
          } else if (progress < 0.76) {
            activeIndex = 1;
            if (solNavProgress) solNavProgress.style.width = '100%';
            if (solNavProgress2) solNavProgress2.style.width = Math.min(100, ((progress - 0.38) / 0.38) * 100) + '%';
          } else {
            activeIndex = 2;
            if (solNavProgress) solNavProgress.style.width = '100%';
            if (solNavProgress2) solNavProgress2.style.width = '100%';
          }

          solPanels.forEach(function (panel, idx) {
            panel.classList.toggle('is-active', idx === activeIndex);
          });
          solSteps.forEach(function (step, idx) {
            step.classList.toggle('is-active', idx === activeIndex);
          });
        }
      }

      // 2. Why Soulshine Layered Parallax
      if (whySection) {
        var whyRect = whySection.getBoundingClientRect();
        if (whyRect.top < winH && whyRect.bottom > 0) {
          var whyMid = whyRect.top + whyRect.height / 2;
          var winMid = winH / 2;
          var delta = (whyMid - winMid) * 0.08;
          if (parallaxBg) {
            parallaxBg.style.transform = 'translate3d(0, ' + (-delta * 0.7) + 'px, 0)';
          }
          if (parallaxGold) {
            parallaxGold.style.transform = 'translate3d(0, ' + (delta * 1.2) + 'px, 0)';
          }
        }
      }

      // 3. Storytelling Energy Conduit Flow
      if (storySection && energyPath) {
        var storyRect = storySection.getBoundingClientRect();
        if (storyRect.top < winH && storyRect.bottom > 0) {
          var storyProgress = (winH - storyRect.top) / (winH + storyRect.height * 0.7);
          storyProgress = Math.max(0, Math.min(1, storyProgress));

          var pathLength = 1200;
          var offset = pathLength * (1 - storyProgress);
          energyPath.style.strokeDashoffset = offset;

          if (energySpark && energyConduit) {
            var conduitW = energyConduit.clientWidth || 1000;
            var sparkX = 20 + storyProgress * (conduitW - 40);
            energySpark.style.left = sparkX + 'px';
            energySpark.style.opacity = storyProgress > 0.02 ? '1' : '0';
          }
        }
      }

      // 4. Solar Transformation (Before -> After Metamorphosis on Scroll)
      if (transSection && transAfter && transDivider) {
        var transRect = transSection.getBoundingClientRect();
        if (transRect.top < winH && transRect.bottom > 0) {
          var transProgress = (winH * 0.85 - transRect.top) / (winH * 0.75);
          transProgress = Math.max(0.08, Math.min(0.92, transProgress));

          var pct = (transProgress * 100).toFixed(1);
          // Reveal after image from right-to-left
          transAfter.style.clipPath = 'inset(0 0 0 ' + pct + '%)';
          transDivider.style.left = pct + '%';

          var indepVal = Math.round(transProgress * 95);
          var offsetVal = Math.round(transProgress * 90);
          if (hudIndep) hudIndep.textContent = indepVal + '%';
          if (hudOffset) hudOffset.textContent = offsetVal + '%';
          if (hudState) {
            if (transProgress < 0.35) {
              hudState.textContent = 'GRID ONLY';
              hudState.style.color = 'var(--text-muted)';
            } else if (transProgress < 0.7) {
              hudState.textContent = 'SOLAR TRANSITION';
              hudState.style.color = 'var(--soft-gold)';
            } else {
              hudState.textContent = 'SOLAR SELF-POWERED';
              hudState.style.color = 'var(--champagne-gold)';
            }
          }
        }
      }

      // 5. Editorial Typographic Moments Subtle Scroll Expansion
      if (typoWords.length) {
        typoWords.forEach(function (moment) {
          var rect = moment.getBoundingClientRect();
          if (rect.top < winH && rect.bottom > 0) {
            var mProg = (winH - rect.top) / (winH + rect.height);
            var track = moment.querySelector('[data-typo-word]');
            if (track) {
              var shiftX = (mProg - 0.5) * 60;
              var spacing = 0.06 + Math.abs(mProg - 0.5) * 0.08;
              track.style.transform = 'translate3d(' + shiftX + 'px, 0, 0)';
              track.style.letterSpacing = spacing.toFixed(3) + 'em';
            }
          }
        });
      }

      // 6. CTA 3D perspective transition
      if (ctaSection && instaSection) {
        var ctaRect = ctaSection.getBoundingClientRect();
        if (ctaRect.top < winH * 0.85) {
          ctaSection.classList.add('is-inview');
          instaSection.classList.add('is-leaving');
        } else {
          instaSection.classList.remove('is-leaving');
        }
      }

      ticking = false;
    }

    function requestScrollTick() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(onScrollFrame);
      }
    }

    window.addEventListener('scroll', requestScrollTick, { passive: true });
    window.addEventListener('resize', requestScrollTick, { passive: true });
    requestScrollTick();
  }

  // Initialize scroll animation engine on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollAnimations);
  } else {
    initScrollAnimations();
  }
})();
