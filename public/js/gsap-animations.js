// ====================================
// PARTSFORM - GSAP Premium Animations
// Enterprise-level animations with glow effects
// ====================================

(function() {
  'use strict';

  // Wait for GSAP to load
  if (typeof gsap === 'undefined') {
    console.error('GSAP library not loaded. Please include GSAP CDN.');
    return;
  }

  // Register GSAP plugins
  if (typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }

  // ====================================
  // GLOBAL ANIMATION SETTINGS
  // ====================================
  
  const EASING = {
    smooth: 'power3.out',
    elastic: 'elastic.out(1, 0.5)',
    bounce: 'back.out(1.7)',
    default: 'power2.out'
  };

  const DURATIONS = {
    fast: 0.3,
    normal: 0.6,
    slow: 1,
    verySlow: 1.5
  };

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  if (prefersReducedMotion) {
    gsap.globalTimeline.timeScale(0.01); // Nearly instant animations
    console.log('%c♿ Reduced motion enabled', 'color: #64748B');
    return;
  }

  // ====================================
  // PAGE LOAD: HEADER ANIMATIONS
  // ====================================
  
  function initHeaderAnimations() {
    const tl = gsap.timeline({ delay: 0.2 });

    // Logo enters from left
    tl.from('.nav-logo', {
      x: -80,
      opacity: 0,
      duration: DURATIONS.slow,
      ease: EASING.smooth
    });

    // Nav links fade in with stagger
    tl.from('.nav-link', {
      y: -20,
      opacity: 0,
      duration: DURATIONS.normal,
      stagger: 0.08,
      ease: EASING.smooth
    }, '-=0.6');

    // Right side buttons enter from right
    tl.from('.nav-actions > *', {
      x: 80,
      opacity: 0,
      duration: DURATIONS.slow,
      stagger: 0.1,
      ease: EASING.smooth
    }, '-=0.8');

    // Subtle glow effect on nav bar
    tl.to('.nav-bar', {
      boxShadow: '0 4px 20px rgba(59, 130, 246, 0.08)',
      duration: DURATIONS.normal
    }, '-=0.5');
  }

  // ====================================
  // HERO SECTION ANIMATIONS
  // ====================================
  
  function initHeroAnimations() {
    const tl = gsap.timeline({ delay: 0.5 });

    // Left side content
    tl.from('.hero-left', {
      x: -100,
      opacity: 0,
      duration: DURATIONS.verySlow,
      ease: EASING.smooth
    });

    // Badge appears with bounce
    tl.from('.hero-badge', {
      scale: 0,
      opacity: 0,
      duration: DURATIONS.normal,
      ease: EASING.bounce
    }, '-=1');

    // Title reveals with scale
    tl.from('.hero-title', {
      y: 30,
      opacity: 0,
      scale: 0.96,
      duration: DURATIONS.slow,
      ease: EASING.smooth
    }, '-=0.7');

    // Description fades in
    tl.from('.hero-description', {
      y: 20,
      opacity: 0,
      duration: DURATIONS.normal,
      ease: EASING.smooth
    }, '-=0.4');

    // Feature tags stagger in
    tl.from('.feature-tag', {
      x: -30,
      opacity: 0,
      duration: DURATIONS.normal,
      stagger: 0.1,
      ease: EASING.smooth
    }, '-=0.3');

    // Buttons appear last
    tl.from('.hero-buttons > *', {
      y: 20,
      opacity: 0,
      scale: 0.9,
      duration: DURATIONS.normal,
      stagger: 0.15,
      ease: EASING.bounce
    }, '-=0.2');

    // Right side stats enter from right
    tl.from('.stat-card', {
      x: 100,
      opacity: 0,
      duration: DURATIONS.slow,
      stagger: 0.15,
      ease: EASING.smooth
    }, '-=1.5');

    // Scroll indicator bounces
    tl.from('.scroll-indicator', {
      y: -20,
      opacity: 0,
      duration: DURATIONS.normal,
      ease: EASING.elastic,
      repeat: -1,
      yoyo: true,
      repeatDelay: 1
    }, '-=0.5');

    // Add glow to hero elements
    gsap.to('.hero-badge', {
      boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });
  }

  // ====================================
  // SCROLL-TRIGGERED ANIMATIONS
  // ====================================
  
  function initScrollAnimations() {
    // Sectors section
    gsap.from('.sector-panel', {
      scrollTrigger: {
        trigger: '.sectors-section',
        start: 'top 80%',
        toggleActions: 'play none none none'
      },
      y: 60,
      opacity: 0,
      duration: DURATIONS.slow,
      stagger: 0.2,
      ease: EASING.smooth
    });

    // Advantages cards
    gsap.from('.advantage-card', {
      scrollTrigger: {
        trigger: '.advantages-section',
        start: 'top 75%',
        toggleActions: 'play none none none'
      },
      y: 50,
      opacity: 0,
      scale: 0.9,
      duration: DURATIONS.slow,
      stagger: 0.12,
      ease: EASING.smooth
    });

    // About section quote
    gsap.from('.about-quote', {
      scrollTrigger: {
        trigger: '.about-section',
        start: 'top 70%',
        toggleActions: 'play none none none'
      },
      y: 40,
      opacity: 0,
      duration: DURATIONS.verySlow,
      ease: EASING.smooth
    });

    // About visual
    gsap.from('.about-visual', {
      scrollTrigger: {
        trigger: '.about-visual',
        start: 'top 75%',
        toggleActions: 'play none none none'
      },
      scale: 0.95,
      opacity: 0,
      duration: DURATIONS.verySlow,
      ease: EASING.smooth
    });

    // Floating stats
    gsap.from('.stat-card-floating', {
      scrollTrigger: {
        trigger: '.stats-floating',
        start: 'top 80%',
        toggleActions: 'play none none none'
      },
      y: 60,
      opacity: 0,
      scale: 0.8,
      duration: DURATIONS.slow,
      stagger: 0.15,
      ease: EASING.bounce
    });

    // Contact section
    gsap.from('.contact-left', {
      scrollTrigger: {
        trigger: '.contact-section',
        start: 'top 75%',
        toggleActions: 'play none none none'
      },
      x: -80,
      opacity: 0,
      duration: DURATIONS.verySlow,
      ease: EASING.smooth
    });

    gsap.from('.contact-right', {
      scrollTrigger: {
        trigger: '.contact-section',
        start: 'top 75%',
        toggleActions: 'play none none none'
      },
      x: 80,
      opacity: 0,
      duration: DURATIONS.verySlow,
      ease: EASING.smooth
    });

    // Contact features stagger
    gsap.from('.contact-feature', {
      scrollTrigger: {
        trigger: '.contact-features',
        start: 'top 85%',
        toggleActions: 'play none none none'
      },
      x: -30,
      opacity: 0,
      duration: DURATIONS.normal,
      stagger: 0.1,
      ease: EASING.smooth
    });

    // Footer columns
    gsap.from('.footer-column', {
      scrollTrigger: {
        trigger: '.footer',
        start: 'top 85%',
        toggleActions: 'play none none none'
      },
      y: 40,
      opacity: 0,
      duration: DURATIONS.slow,
      stagger: 0.1,
      ease: EASING.smooth
    });
  }

  // ====================================
  // HOVER GLOW EFFECTS
  // ====================================
  
  function initHoverEffects() {
    // Buttons
    const buttons = document.querySelectorAll('.btn-primary, .btn-secondary, .btn-outline');
    buttons.forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        gsap.to(btn, {
          scale: 1.05,
          boxShadow: '0 8px 30px rgba(59, 130, 246, 0.4)',
          duration: DURATIONS.fast,
          ease: EASING.default
        });
      });

      btn.addEventListener('mouseleave', () => {
        gsap.to(btn, {
          scale: 1,
          boxShadow: '0 4px 12px rgba(43, 82, 120, 0.2)',
          duration: DURATIONS.fast,
          ease: EASING.default
        });
      });
    });

    // Cards with 3D tilt
    const cards = document.querySelectorAll('.stat-card, .advantage-card, .sector-panel, .stat-card-floating');
    cards.forEach(card => {
      card.addEventListener('mouseenter', () => {
        gsap.to(card, {
          y: -8,
          boxShadow: '0 12px 40px rgba(59, 130, 246, 0.2)',
          duration: DURATIONS.fast,
          ease: EASING.default
        });
      });

      card.addEventListener('mouseleave', () => {
        gsap.to(card, {
          y: 0,
          rotateX: 0,
          rotateY: 0,
          boxShadow: '0 4px 12px rgba(43, 82, 120, 0.12)',
          duration: DURATIONS.fast,
          ease: EASING.default
        });
      });

      // 3D tilt on mouse move
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / 15;
        const rotateY = (centerX - x) / 15;

        gsap.to(card, {
          rotateX: rotateX,
          rotateY: rotateY,
          transformPerspective: 1000,
          duration: 0.2,
          ease: 'none'
        });
      });
    });

    // Form inputs glow on focus
    const inputs = document.querySelectorAll('.form-input, .form-textarea');
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        gsap.to(input, {
          boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.15), 0 0 20px rgba(59, 130, 246, 0.1)',
          duration: DURATIONS.fast,
          ease: EASING.default
        });
      });

      input.addEventListener('blur', () => {
        gsap.to(input, {
          boxShadow: '0 0 0 0 rgba(59, 130, 246, 0)',
          duration: DURATIONS.fast,
          ease: EASING.default
        });
      });
    });
  }

  // ====================================
  // MODAL ANIMATIONS
  // ====================================
  
  function initModalAnimations() {
    const modal = document.getElementById('sign-in-modal');
    if (!modal) return;

    const originalOpenModal = window.openModal;
    window.openModal = function() {
      if (originalOpenModal) originalOpenModal();
      
      const tl = gsap.timeline();
      
      // Backdrop fade in with blur
      tl.from('.modal-backdrop', {
        opacity: 0,
        duration: DURATIONS.normal,
        ease: EASING.smooth
      });

      // Modal content zoom in
      tl.from('.modal-content', {
        scale: 0.9,
        y: 30,
        opacity: 0,
        duration: DURATIONS.slow,
        ease: EASING.bounce
      }, '-=0.3');

      // Form elements stagger
      tl.from('.modal-content .form-group', {
        y: 20,
        opacity: 0,
        duration: DURATIONS.normal,
        stagger: 0.08,
        ease: EASING.smooth
      }, '-=0.4');
    };
  }

  // ====================================
  // PARALLAX SCROLL EFFECTS
  // ====================================
  
  function initParallaxEffects() {
    // Hero background parallax
    gsap.to('.hero-background-slider', {
      scrollTrigger: {
        trigger: '.hero-section',
        start: 'top top',
        end: 'bottom top',
        scrub: 1
      },
      y: 100,
      ease: 'none'
    });

    // Decorative orbs parallax
    gsap.utils.toArray('.gradient-orb').forEach((orb, index) => {
      gsap.to(orb, {
        scrollTrigger: {
          trigger: orb.closest('section'),
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1
        },
        y: index % 2 === 0 ? -100 : 100,
        ease: 'none'
      });
    });
  }

  // ====================================
  // MAGNETIC BUTTON EFFECT
  // ====================================
  
  function initMagneticButtons() {
    const magneticElements = document.querySelectorAll('.btn-primary, .btn-submit');
    
    magneticElements.forEach(el => {
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        
        gsap.to(el, {
          x: x * 0.3,
          y: y * 0.3,
          duration: 0.3,
          ease: 'power2.out'
        });
      });
      
      el.addEventListener('mouseleave', () => {
        gsap.to(el, {
          x: 0,
          y: 0,
          duration: 0.5,
          ease: 'elastic.out(1, 0.5)'
        });
      });
    });
  }

  // ====================================
  // TEXT SPLIT AND REVEAL
  // ====================================
  
  function initTextReveal() {
    const headings = document.querySelectorAll('.section-title, .quote-text');
    
    headings.forEach(heading => {
      const text = heading.textContent;
      const words = text.split(' ');
      heading.innerHTML = '';
      
      words.forEach(word => {
        const span = document.createElement('span');
        span.textContent = word + ' ';
        span.style.display = 'inline-block';
        span.style.opacity = '0';
        heading.appendChild(span);
      });
      
      gsap.from(heading.children, {
        scrollTrigger: {
          trigger: heading,
          start: 'top 85%',
          toggleActions: 'play none none none'
        },
        y: 20,
        opacity: 0,
        duration: DURATIONS.normal,
        stagger: 0.05,
        ease: EASING.smooth
      });
    });
  }

  // ====================================
  // CONTINUOUS FLOATING ANIMATION
  // ====================================
  
  function initFloatingElements() {
    gsap.to('.hero-badge', {
      y: -10,
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });

    gsap.to('.stat-card', {
      y: -5,
      duration: 3,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      stagger: {
        each: 0.3,
        from: 'start'
      }
    });
  }

  // ====================================
  // INITIALIZE ALL ANIMATIONS
  // ====================================
  
  function init() {
    // Wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initAnimations, 100);
      });
    } else {
      setTimeout(initAnimations, 100);
    }
  }

  function initAnimations() {
    console.log('%c✨ GSAP Animations Initialized', 'color: #3B82F6; font-weight: bold; font-size: 14px;');
    
    initHeaderAnimations();
    initHeroAnimations();
    initScrollAnimations();
    initHoverEffects();
    initModalAnimations();
    initParallaxEffects();
    initMagneticButtons();
    initTextReveal();
    initFloatingElements();

    // Refresh ScrollTrigger after all animations are set
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }
  }

  // Start initialization
  init();

  // Expose refresh function globally
  window.refreshAnimations = function() {
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }
  };

})();

