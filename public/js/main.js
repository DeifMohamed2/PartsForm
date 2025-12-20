// ====================================
// PARTSFORM - Main JavaScript
// Professional interactions and features
// ====================================

(function() {
  'use strict';

  // ====================================
  // NAVIGATION SCROLL EFFECTS
  // ====================================
  const navbar = document.getElementById('navbar');
  const navLinks = document.querySelectorAll('.nav-link');
  
  let lastScrollTop = 0;
  const scrollThreshold = 20;

  function handleNavScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > scrollThreshold) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
  }

  // Initial check on page load
  handleNavScroll();

  // Throttle scroll events for better performance
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        handleNavScroll();
        ticking = false;
      });
      ticking = true;
    }
  });

  // ====================================
  // NAVIGATION ACTIVE SECTION TRACKING
  // ====================================
  function updateActiveNav() {
    const sections = document.querySelectorAll('section[id]');
    const scrollPos = window.scrollY + 100;

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');

      if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('data-section') === sectionId) {
            link.classList.add('active');
          }
        });
      }
    });
  }

  window.addEventListener('scroll', updateActiveNav);

  // ====================================
  // SMOOTH SCROLL FOR NAVIGATION LINKS
  // ====================================
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href');
      const targetSection = document.querySelector(targetId);
      
      if (targetSection) {
        const offsetTop = targetSection.offsetTop - 80;
        window.scrollTo({
          top: offsetTop,
          behavior: 'smooth'
        });
      }
    });
  });

  // ====================================
  // HERO BACKGROUND SLIDER
  // ====================================
  const heroSlider = document.getElementById('hero-slider');
  if (heroSlider) {
    const slides = heroSlider.querySelectorAll('.hero-slide');
    let currentSlide = 0;
    const slideInterval = 8000; // 8 seconds per slide

    function nextSlide() {
      slides[currentSlide].classList.remove('active');
      currentSlide = (currentSlide + 1) % slides.length;
      slides[currentSlide].classList.add('active');
    }

    // Auto-advance slides
    if (slides.length > 1) {
      setInterval(nextSlide, slideInterval);
    }
  }

  // ====================================
  // SECTOR PANEL INTERACTIONS
  // ====================================
  const sectorPanels = document.querySelectorAll('.sector-panel');
  
  sectorPanels.forEach(panel => {
    panel.addEventListener('click', () => {
      const sectorId = panel.getAttribute('data-sector');
      // Navigate to sector search page
      window.location.href = `/search/${sectorId}`;
    });

    // Add hover sound effect (optional - can be removed)
    panel.addEventListener('mouseenter', () => {
      panel.style.transform = 'translateY(-8px) scale(1.02)';
    });

    panel.addEventListener('mouseleave', () => {
      panel.style.transform = 'translateY(0) scale(1)';
    });
  });

  // ====================================
  // STAT CARD COUNTER ANIMATION
  // ====================================
  function animateValue(element, start, end, duration) {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
      current += increment;
      if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
        current = end;
        clearInterval(timer);
      }
      
      // Format the number
      if (typeof end === 'number') {
        element.textContent = Math.floor(current).toLocaleString();
      } else {
        element.textContent = end;
      }
    }, 16);
  }

  // Observe stat cards for animation trigger
  const statCards = document.querySelectorAll('.stat-card');
  const statObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.animated) {
        entry.target.dataset.animated = 'true';
        
        const statValue = entry.target.querySelector('.stat-value');
        if (statValue) {
          const text = statValue.textContent.trim();
          const matches = text.match(/[\d,]+/);
          if (matches) {
            const number = parseInt(matches[0].replace(/,/g, ''));
            statValue.textContent = '0';
            setTimeout(() => {
              animateValue(statValue, 0, number, 1500);
            }, 300);
          }
        }
      }
    });
  }, { threshold: 0.5 });

  statCards.forEach(card => statObserver.observe(card));

  // ====================================
  // LANGUAGE SELECTOR
  // ====================================
  const languageBtn = document.getElementById('language-btn');
  const languageDropdown = document.getElementById('language-dropdown');
  const languageSelector = document.querySelector('.language-selector');
  const currentFlag = document.getElementById('current-flag');
  const currentLang = document.getElementById('current-lang');
  const langOptions = document.querySelectorAll('.lang-option');

  if (languageBtn && languageDropdown) {
    languageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      languageSelector.classList.toggle('open');
    });

    langOptions.forEach(option => {
      option.addEventListener('click', () => {
        const lang = option.getAttribute('data-lang');
        const flag = option.getAttribute('data-flag');
        
        // Update current language display
        currentFlag.textContent = flag;
        currentLang.textContent = lang;
        
        // Mark as active
        langOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        
        // Close dropdown
        languageSelector.classList.remove('open');
        
        // Store preference
        localStorage.setItem('selectedLanguage', lang);
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!languageSelector.contains(e.target)) {
        languageSelector.classList.remove('open');
      }
    });

    // Load saved language preference
    const savedLang = localStorage.getItem('selectedLanguage');
    if (savedLang) {
      const savedOption = document.querySelector(`.lang-option[data-lang="${savedLang}"]`);
      if (savedOption) {
        const flag = savedOption.getAttribute('data-flag');
        currentFlag.textContent = flag;
        currentLang.textContent = savedLang;
        savedOption.classList.add('active');
      }
    }
  }

  // ====================================
  // SIGN IN MODAL
  // ====================================
  const signInBtn = document.getElementById('sign-in-btn');
  const signInModal = document.getElementById('sign-in-modal');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalClose = document.getElementById('modal-close');
  const signInForm = document.getElementById('sign-in-form');

  function openModal() {
    signInModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    // Reinitialize icons for modal
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  function closeModal() {
    signInModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (signInBtn) {
    signInBtn.addEventListener('click', openModal);
  }

  if (modalClose) {
    modalClose.addEventListener('click', closeModal);
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', closeModal);
  }

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && signInModal.classList.contains('active')) {
      closeModal();
    }
  });

  // Handle form submission
  if (signInForm) {
    signInForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // Show success message (in production, this would actually authenticate)
      alert('Sign in functionality will be implemented in production.');
      closeModal();
    });
  }

  // ====================================
  // CONTACT FORM
  // ====================================
  const contactForm = document.getElementById('contact-form');
  
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const formData = new FormData(contactForm);
      const data = Object.fromEntries(formData);
      
      console.log('Contact form submitted:', data);
      
      // In production, send data to server
      alert('Thank you for your message! We will get back to you soon.');
      contactForm.reset();
    });

    // Add focus effects to form inputs
    const formInputs = contactForm.querySelectorAll('.form-input, .form-textarea');
    formInputs.forEach(input => {
      input.addEventListener('focus', () => {
        input.parentElement.classList.add('focused');
      });
      
      input.addEventListener('blur', () => {
        input.parentElement.classList.remove('focused');
      });
    });
  }

  // ====================================
  // SCROLL TO TOP BUTTON (Optional Enhancement)
  // ====================================
  const scrollToTopBtn = document.createElement('button');
  scrollToTopBtn.innerHTML = '<i data-lucide="arrow-up"></i>';
  scrollToTopBtn.className = 'scroll-to-top';
  scrollToTopBtn.style.cssText = `
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #2B5278 0%, #3B82F6 100%);
    color: white;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: none;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(43, 82, 120, 0.3);
    transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    z-index: 999;
  `;

  document.body.appendChild(scrollToTopBtn);

  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      scrollToTopBtn.style.display = 'flex';
    } else {
      scrollToTopBtn.style.display = 'none';
    }
  });

  scrollToTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });

  scrollToTopBtn.addEventListener('mouseenter', () => {
    scrollToTopBtn.style.transform = 'translateY(-4px) scale(1.1)';
    scrollToTopBtn.style.boxShadow = '0 8px 24px rgba(43, 82, 120, 0.4)';
  });

  scrollToTopBtn.addEventListener('mouseleave', () => {
    scrollToTopBtn.style.transform = 'translateY(0) scale(1)';
    scrollToTopBtn.style.boxShadow = '0 4px 12px rgba(43, 82, 120, 0.3)';
  });

  // Reinitialize Lucide for dynamic elements
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // ====================================
  // PARALLAX EFFECT FOR DECORATIVE ELEMENTS
  // ====================================
  const parallaxElements = document.querySelectorAll('.gradient-orb');
  
  window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    
    parallaxElements.forEach((element, index) => {
      const speed = (index % 2 === 0) ? 0.3 : 0.5;
      const yPos = -(scrolled * speed);
      element.style.transform = `translateY(${yPos}px)`;
    });
  });

  // ====================================
  // BUTTON RIPPLE EFFECT
  // ====================================
  const buttons = document.querySelectorAll('.btn-primary, .btn-secondary, .btn-outline');
  
  buttons.forEach(button => {
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.5);
        left: ${x}px;
        top: ${y}px;
        pointer-events: none;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
      `;
      
      button.style.position = 'relative';
      button.style.overflow = 'hidden';
      button.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 600);
    });
  });

  // Add ripple animation to stylesheet
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ripple {
      to {
        transform: scale(2.5);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);

  // ====================================
  // PERFORMANCE OPTIMIZATION
  // ====================================
  
  // Lazy load images
  const images = document.querySelectorAll('img[loading="lazy"]');
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          imageObserver.unobserve(img);
        }
      });
    });
    
    images.forEach(img => imageObserver.observe(img));
  }

  // ====================================
  // CONSOLE BRANDING
  // ====================================
  console.log(
    '%c⚙️ PARTSFORM %c- Global Industrial Parts Sourcing Platform',
    'color: #3B82F6; font-size: 20px; font-weight: bold;',
    'color: #64748B; font-size: 14px;'
  );
  console.log(
    '%cBuilt with precision. Engineered for scale.',
    'color: #2B5278; font-size: 12px; font-style: italic;'
  );

})();
