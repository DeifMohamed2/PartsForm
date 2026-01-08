// ====================================
// LANDING PAGE - STORY-BASED SCROLL EXPERIENCE
// Lenis Smooth Scroll + GSAP ScrollTrigger Animations
// ====================================

(function() {
  'use strict';

  // ====================================
  // LENIS SMOOTH SCROLL INITIALIZATION
  // ====================================
  
  let lenis = null;
  
  function initLenis() {
    // Check if Lenis is available
    if (typeof Lenis === 'undefined') {
      console.warn('Lenis not loaded, using native scroll');
      return;
    }
    
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
      mouseMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    });
    
    // Integrate with GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);
    
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    
    gsap.ticker.lagSmoothing(0);
    
    // Add class to html for styling
    document.documentElement.classList.add('lenis');
  }

  // ====================================
  // GSAP SCROLLTRIGGER SETUP
  // ====================================
  
  function initScrollTrigger() {
    // Check if GSAP and ScrollTrigger are available
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      console.warn('GSAP or ScrollTrigger not loaded, using fallback animations');
      initFallbackAnimations();
      return;
    }
    
    gsap.registerPlugin(ScrollTrigger);
    
    // Hero Section Animations
    initHeroAnimations();
    
    // Section Reveal Animations
    initSectionReveals();
    
    // Timeline/Milestone Animations
    initMilestoneAnimations();
    
    // Process Steps Animations
    initProcessAnimations();
    
    // Industry Cards Animations
    initIndustryAnimations();
    
    // Stats Counter Animations
    initStatsAnimations();
    
    // Advantage Cards Animations
    initAdvantageAnimations();
    
    // Contact Section Animations
    initContactAnimations();
    
    // Parallax Effects
    initParallaxEffects();
  }

  // ====================================
  // HERO SECTION ANIMATIONS
  // ====================================
  
  function initHeroAnimations() {
    const heroContent = document.querySelector('.story-hero-content');
    if (!heroContent) return;
    
    const tl = gsap.timeline({ delay: 0.3 });
    
    tl.to('.story-hero-badge', {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power3.out'
    })
    .to('.story-hero-title', {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: 'power3.out'
    }, '-=0.5')
    .to('.story-hero-subtitle', {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power3.out'
    }, '-=0.6')
    .to('.story-hero-cta', {
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: 'power3.out'
    }, '-=0.4');
    
    // Parallax effect on hero background
    const heroBg = document.querySelector('.story-hero-bg img');
    if (heroBg) {
      gsap.to(heroBg, {
        yPercent: 30,
        ease: 'none',
        scrollTrigger: {
          trigger: '.story-hero',
          start: 'top top',
          end: 'bottom top',
          scrub: true
        }
      });
    }
  }

  // ====================================
  // SECTION REVEAL ANIMATIONS
  // ====================================
  
  function initSectionReveals() {
    // Section headers
    gsap.utils.toArray('.story-section-header').forEach(header => {
      gsap.from(header, {
        opacity: 0,
        y: 50,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: header,
          start: 'top 80%',
          toggleActions: 'play none none none'
        }
      });
    });
    
    // Generic reveal elements
    gsap.utils.toArray('.reveal').forEach(element => {
      const direction = element.classList.contains('from-left') ? { x: -60, y: 0 } :
                        element.classList.contains('from-right') ? { x: 60, y: 0 } :
                        element.classList.contains('from-scale') ? { scale: 0.9, y: 0 } :
                        { x: 0, y: 50 };
      
      const delay = element.dataset.delay ? parseInt(element.dataset.delay) / 1000 : 0;
      
      gsap.from(element, {
        ...direction,
        opacity: 0,
        duration: 0.8,
        delay: delay,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: element,
          start: 'top 85%',
          toggleActions: 'play none none none',
          onEnter: () => element.classList.add('in-view')
        }
      });
    });
  }

  // ====================================
  // MILESTONE/TIMELINE ANIMATIONS
  // ====================================
  
  function initMilestoneAnimations() {
    const milestones = document.querySelectorAll('.story-milestone');
    
    milestones.forEach((milestone, index) => {
      const content = milestone.querySelector('.story-milestone-content');
      const isEven = index % 2 === 1;
      
      gsap.from(content, {
        opacity: 0,
        x: isEven ? 60 : -60,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: milestone,
          start: 'top 75%',
          toggleActions: 'play none none none',
          onEnter: () => milestone.classList.add('in-view')
        }
      });
      
      // Animate the dot
      const dot = milestone.querySelector('.story-milestone-dot');
      if (dot) {
        gsap.from(dot, {
          scale: 0,
          duration: 0.5,
          ease: 'back.out(2)',
          scrollTrigger: {
            trigger: milestone,
            start: 'top 75%',
            toggleActions: 'play none none none'
          }
        });
      }
    });
  }

  // ====================================
  // PROCESS STEP ANIMATIONS
  // ====================================
  
  function initProcessAnimations() {
    const steps = document.querySelectorAll('.story-process-step');
    
    steps.forEach((step, index) => {
      gsap.from(step, {
        opacity: 0,
        y: 40,
        duration: 0.6,
        delay: index * 0.15,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: step,
          start: 'top 85%',
          toggleActions: 'play none none none',
          onEnter: () => step.classList.add('in-view')
        }
      });
      
      // Icon animation
      const icon = step.querySelector('.story-process-icon');
      if (icon) {
        gsap.from(icon, {
          scale: 0.8,
          rotation: -10,
          duration: 0.5,
          delay: index * 0.15 + 0.2,
          ease: 'back.out(1.5)',
          scrollTrigger: {
            trigger: step,
            start: 'top 85%',
            toggleActions: 'play none none none'
          }
        });
      }
    });
  }

  // ====================================
  // INDUSTRY CARD ANIMATIONS
  // ====================================
  
  function initIndustryAnimations() {
    const cards = document.querySelectorAll('.story-industry-card');
    
    cards.forEach((card, index) => {
      gsap.from(card, {
        opacity: 0,
        scale: 0.9,
        y: 30,
        duration: 0.8,
        delay: index * 0.15,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 85%',
          toggleActions: 'play none none none',
          onEnter: () => card.classList.add('in-view')
        }
      });
    });
  }

  // ====================================
  // STATS COUNTER ANIMATIONS
  // ====================================
  
  function initStatsAnimations() {
    const statItems = document.querySelectorAll('.story-stat-item');
    
    statItems.forEach((item, index) => {
      gsap.from(item, {
        opacity: 0,
        y: 30,
        duration: 0.6,
        delay: index * 0.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: item,
          start: 'top 85%',
          toggleActions: 'play none none none',
          onEnter: () => {
            item.classList.add('in-view');
            // Trigger counter animation
            const valueElement = item.querySelector('.story-stat-value');
            if (valueElement && valueElement.dataset.count) {
              animateCounter(valueElement);
            }
          }
        }
      });
    });
  }
  
  function animateCounter(element) {
    const target = parseFloat(element.dataset.count);
    const suffix = element.dataset.suffix || '';
    const isDecimal = target % 1 !== 0;
    
    gsap.to(element, {
      textContent: target,
      duration: 2,
      ease: 'power2.out',
      snap: isDecimal ? 0.1 : 1,
      onUpdate: function() {
        const current = this.targets()[0].textContent;
        element.textContent = isDecimal ? 
          parseFloat(current).toFixed(1) + suffix : 
          Math.floor(parseFloat(current)).toLocaleString() + suffix;
      }
    });
  }

  // ====================================
  // ADVANTAGE CARD ANIMATIONS
  // ====================================
  
  function initAdvantageAnimations() {
    const cards = document.querySelectorAll('.story-advantage-card');
    
    cards.forEach((card, index) => {
      gsap.from(card, {
        opacity: 0,
        y: 40,
        duration: 0.6,
        delay: index * 0.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 85%',
          toggleActions: 'play none none none',
          onEnter: () => card.classList.add('in-view')
        }
      });
    });
  }

  // ====================================
  // CONTACT SECTION ANIMATIONS
  // ====================================
  
  function initContactAnimations() {
    const contactInfo = document.querySelector('.story-contact-info');
    const contactForm = document.querySelector('.story-contact-form-wrapper');
    
    if (contactInfo) {
      gsap.from(contactInfo, {
        opacity: 0,
        x: -50,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: contactInfo,
          start: 'top 80%',
          toggleActions: 'play none none none',
          onEnter: () => contactInfo.classList.add('in-view')
        }
      });
    }
    
    if (contactForm) {
      gsap.from(contactForm, {
        opacity: 0,
        x: 50,
        duration: 0.8,
        delay: 0.2,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: contactForm,
          start: 'top 80%',
          toggleActions: 'play none none none',
          onEnter: () => contactForm.classList.add('in-view')
        }
      });
    }
  }

  // ====================================
  // PARALLAX EFFECTS
  // ====================================
  
  function initParallaxEffects() {
    // Background images parallax
    gsap.utils.toArray('.story-stats-bg img, .story-hero-bg img').forEach(img => {
      gsap.to(img, {
        yPercent: 20,
        ease: 'none',
        scrollTrigger: {
          trigger: img.closest('section') || img.parentElement,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
    });
    
    // Industry cards subtle movement
    gsap.utils.toArray('.story-industry-bg img').forEach(img => {
      gsap.to(img, {
        yPercent: 10,
        ease: 'none',
        scrollTrigger: {
          trigger: img.closest('.story-industry-card'),
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
    });
  }

  // ====================================
  // FALLBACK ANIMATIONS (No GSAP)
  // ====================================
  
  function initFallbackAnimations() {
    const observerConfig = {
      threshold: 0.15,
      rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, observerConfig);
    
    // Observe all animatable elements
    const elements = document.querySelectorAll(
      '.reveal, .story-milestone, .story-process-step, .story-industry-card, ' +
      '.story-stat-item, .story-advantage-card, .story-contact-info, .story-contact-form-wrapper'
    );
    
    elements.forEach(el => observer.observe(el));
    
    // Hero animation fallback
    setTimeout(() => {
      document.querySelectorAll('.story-hero-badge, .story-hero-title, .story-hero-subtitle, .story-hero-cta')
        .forEach((el, i) => {
          setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
          }, i * 200);
        });
    }, 300);
  }

  // ====================================
  // SMOOTH SCROLL TO SECTIONS
  // ====================================
  
  function initSmoothScrollLinks() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const target = document.querySelector(targetId);
        if (!target) return;
        
        e.preventDefault();
        
        if (lenis) {
          lenis.scrollTo(target, {
            offset: -80,
            duration: 1.2
          });
        } else {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  // ====================================
  // NAVBAR SCROLL EFFECT
  // ====================================
  
  function initNavbarScroll() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    
    ScrollTrigger.create({
      start: 'top -80',
      end: 99999,
      toggleClass: { targets: navbar, className: 'scrolled' }
    });
  }

  // ====================================
  // INITIALIZATION
  // ====================================
  
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAll);
    } else {
      initAll();
    }
  }
  
  function initAll() {
    initLenis();
    initScrollTrigger();
    initSmoothScrollLinks();
    initNavbarScroll();
    
    // Initialize Lucide icons if available
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    
    console.log('%c✨ PARTSFORM Story Landing Page Initialized', 'color: #c9a962; font-weight: bold;');
  }
  
  // Start initialization
  init();

})();
