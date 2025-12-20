// ====================================
// PARTSFORM - Animations & Effects
// Smooth scroll, fade-ins, and professional animations
// ====================================

(function() {
  'use strict';

  // ====================================
  // INTERSECTION OBSERVER FOR ANIMATIONS
  // ====================================
  
  const animationConfig = {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  };

  const animationObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const element = entry.target;
        const delay = element.dataset.delay || 0;
        
        setTimeout(() => {
          element.classList.add('animate');
        }, parseInt(delay));
        
        // Unobserve after animation to improve performance
        animationObserver.unobserve(element);
      }
    });
  }, animationConfig);

  // Observe all elements with data-animate attribute
  function observeAnimatedElements() {
    const animatedElements = document.querySelectorAll('[data-animate]');
    animatedElements.forEach(element => {
      animationObserver.observe(element);
    });
  }

  // Initialize on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeAnimatedElements);
  } else {
    observeAnimatedElements();
  }

  // ====================================
  // SMOOTH SCROLL POLYFILL (for older browsers)
  // ====================================
  
  if (!('scrollBehavior' in document.documentElement.style)) {
    // Simple smooth scroll polyfill
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
      link.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const target = document.querySelector(targetId);
        if (!target) return;
        
        e.preventDefault();
        
        const targetPosition = target.offsetTop - 80;
        const startPosition = window.pageYOffset;
        const distance = targetPosition - startPosition;
        const duration = 800;
        let start = null;
        
        function animation(currentTime) {
          if (start === null) start = currentTime;
          const timeElapsed = currentTime - start;
          const run = ease(timeElapsed, startPosition, distance, duration);
          window.scrollTo(0, run);
          if (timeElapsed < duration) requestAnimationFrame(animation);
        }
        
        function ease(t, b, c, d) {
          t /= d / 2;
          if (t < 1) return c / 2 * t * t + b;
          t--;
          return -c / 2 * (t * (t - 2) - 1) + b;
        }
        
        requestAnimationFrame(animation);
      });
    });
  }

  // ====================================
  // PARALLAX SCROLLING EFFECTS
  // ====================================
  
  let ticking = false;
  
  function updateParallax() {
    const scrolled = window.pageYOffset;
    
    // Hero elements parallax
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
      const heroSection = document.querySelector('.hero-section');
      const heroHeight = heroSection ? heroSection.offsetHeight : 0;
      const scrollPercent = scrolled / heroHeight;
      
      if (scrollPercent <= 1) {
        const yOffset = scrolled * 0.1;
        const opacity = Math.max(1 - scrollPercent * 1.5, 0);
        heroContent.style.transform = `translateY(${yOffset}px)`;
        heroContent.style.opacity = opacity;
      }
    }
    
    // Decorative orbs parallax
    const orbs = document.querySelectorAll('.gradient-orb');
    orbs.forEach((orb, index) => {
      const speed = index % 2 === 0 ? 0.3 : 0.5;
      const yPos = -(scrolled * speed);
      orb.style.transform = `translateY(${yPos}px)`;
    });
    
    ticking = false;
  }
  
  function requestParallaxUpdate() {
    if (!ticking) {
      requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }
  
  window.addEventListener('scroll', requestParallaxUpdate, { passive: true });

  // ====================================
  // CURSOR TRAIL EFFECT (Subtle)
  // ====================================
  
  const cursorTrail = [];
  const trailLength = 8;
  
  function createCursorDot() {
    const dot = document.createElement('div');
    dot.style.cssText = `
      position: fixed;
      width: 4px;
      height: 4px;
      background: rgba(59, 130, 246, 0.3);
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      transition: all 0.1s ease-out;
      opacity: 0;
    `;
    document.body.appendChild(dot);
    return dot;
  }
  
  // Initialize cursor trail dots
  for (let i = 0; i < trailLength; i++) {
    cursorTrail.push(createCursorDot());
  }
  
  let mouseX = 0;
  let mouseY = 0;
  
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  
  function animateCursorTrail() {
    let x = mouseX;
    let y = mouseY;
    
    cursorTrail.forEach((dot, index) => {
      const nextDot = cursorTrail[index + 1] || cursorTrail[0];
      
      dot.style.left = x + 'px';
      dot.style.top = y + 'px';
      dot.style.opacity = (trailLength - index) / trailLength * 0.5;
      dot.style.transform = `scale(${(trailLength - index) / trailLength})`;
      
      if (nextDot.style.left) {
        x += (parseFloat(nextDot.style.left) - x) * 0.3;
        y += (parseFloat(nextDot.style.top) - y) * 0.3;
      }
    });
    
    requestAnimationFrame(animateCursorTrail);
  }
  
  // Only enable cursor trail on desktop
  if (window.innerWidth > 1024) {
    animateCursorTrail();
  } else {
    cursorTrail.forEach(dot => dot.remove());
  }

  // ====================================
  // CARD HOVER EFFECTS WITH 3D TRANSFORM
  // ====================================
  
  const cards = document.querySelectorAll('.stat-card, .advantage-card, .sector-panel');
  
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px) scale(1.02)`;
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0) scale(1)';
    });
  });

  // ====================================
  // TEXT REVEAL ANIMATION
  // ====================================
  
  function revealText(element) {
    const text = element.textContent;
    element.textContent = '';
    element.style.opacity = '1';
    
    const chars = text.split('');
    chars.forEach((char, index) => {
      const span = document.createElement('span');
      span.textContent = char;
      span.style.opacity = '0';
      span.style.display = 'inline-block';
      span.style.animation = `fadeInChar 0.05s ${index * 0.02}s forwards`;
      element.appendChild(span);
    });
  }
  
  // Add character fade-in animation
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes fadeInChar {
      to {
        opacity: 1;
        transform: translateY(0);
      }
      from {
        opacity: 0;
        transform: translateY(10px);
      }
    }
  `;
  document.head.appendChild(styleSheet);
  
  // Apply to specific headings
  const heroTitle = document.querySelector('.hero-title');
  if (heroTitle) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setTimeout(() => revealText(entry.target), 200);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    
    observer.observe(heroTitle);
  }

  // ====================================
  // LOADING PROGRESS BAR
  // ====================================
  
  function createProgressBar() {
    const progressBar = document.createElement('div');
    progressBar.id = 'page-load-progress';
    progressBar.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 0%;
      height: 3px;
      background: linear-gradient(90deg, #2B5278 0%, #3B82F6 100%);
      z-index: 99999;
      transition: width 0.3s ease-out;
      box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
    `;
    document.body.appendChild(progressBar);
    return progressBar;
  }
  
  const progressBar = createProgressBar();
  
  // Simulate loading progress
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += Math.random() * 30;
    if (progress > 90) progress = 90;
    progressBar.style.width = progress + '%';
  }, 200);
  
  window.addEventListener('load', () => {
    clearInterval(progressInterval);
    progressBar.style.width = '100%';
    setTimeout(() => {
      progressBar.style.opacity = '0';
      setTimeout(() => progressBar.remove(), 300);
    }, 200);
  });

  // ====================================
  // SCROLL PROGRESS INDICATOR
  // ====================================
  
  const scrollProgress = document.createElement('div');
  scrollProgress.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0%;
    height: 2px;
    background: linear-gradient(90deg, #2B5278 0%, #3B82F6 100%);
    z-index: 9998;
    transition: width 0.1s ease-out;
  `;
  document.body.appendChild(scrollProgress);
  
  function updateScrollProgress() {
    const windowHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = (window.pageYOffset / windowHeight) * 100;
    scrollProgress.style.width = scrolled + '%';
  }
  
  window.addEventListener('scroll', updateScrollProgress, { passive: true });

  // ====================================
  // SECTION FADE-IN OBSERVER
  // ====================================
  
  const sections = document.querySelectorAll('section');
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });
  
  sections.forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(30px)';
    section.style.transition = 'opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)';
    sectionObserver.observe(section);
  });

  // ====================================
  // MOUSE MOVE INTERACTIVE GRADIENTS
  // ====================================
  
  let mouseXPercent = 50;
  let mouseYPercent = 50;
  
  document.addEventListener('mousemove', (e) => {
    mouseXPercent = (e.clientX / window.innerWidth) * 100;
    mouseYPercent = (e.clientY / window.innerHeight) * 100;
  });
  
  function updateGradients() {
    const decorations = document.querySelectorAll('.hero-decorations, .sectors-decorations');
    
    decorations.forEach(decoration => {
      const orbs = decoration.querySelectorAll('.gradient-orb');
      orbs.forEach((orb, index) => {
        const xOffset = (mouseXPercent - 50) * (index % 2 === 0 ? 0.5 : -0.5);
        const yOffset = (mouseYPercent - 50) * (index % 2 === 0 ? -0.5 : 0.5);
        orb.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
      });
    });
    
    requestAnimationFrame(updateGradients);
  }
  
  if (window.innerWidth > 1024) {
    updateGradients();
  }

  // ====================================
  // PERFORMANCE MONITORING
  // ====================================
  
  if (window.performance) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = window.performance.timing;
        const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
        console.log(`%c⚡ Page loaded in ${pageLoadTime}ms`, 'color: #10B981; font-weight: bold;');
      }, 0);
    });
  }

  // ====================================
  // REDUCED MOTION SUPPORT
  // ====================================
  
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  if (prefersReducedMotion) {
    // Disable animations for users who prefer reduced motion
    document.documentElement.style.setProperty('--transition-base', 'none');
    document.documentElement.style.setProperty('--transition-fast', 'none');
    
    // Remove cursor trail
    cursorTrail.forEach(dot => dot.remove());
    
    console.log('%cReduced motion mode enabled', 'color: #64748B; font-style: italic;');
  }

})();
