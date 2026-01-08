// ====================================
// MOBILE MENU SYSTEM - PROFESSIONAL IMPLEMENTATION
// ====================================
(function () {
  'use strict';

  // Wait for DOM to be ready
  document.addEventListener('DOMContentLoaded', initNavbar);

  function initNavbar() {
    initMobileMenu();
    initLanguageSelector();
    initNavbarScroll();
    initSectionTracking();
    initSmoothScrolling();
  }

  // ====================================
  // MOBILE MENU
  // ====================================
  function initMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const backdrop = document.getElementById('mobileBackdrop');
    const navLinks = document.getElementById('navLinks');
    const navActions = document.getElementById('navActions');

    if (!menuBtn || !backdrop || !navLinks || !navActions) {
      console.warn('Mobile menu elements not found');
      return;
    }

    let isOpen = false;

    // Toggle menu
    function toggleMenu() {
      isOpen = !isOpen;
      updateMenuState();
    }

    // Close menu
    function closeMenu() {
      isOpen = false;
      updateMenuState();
    }

    // Update menu state
    function updateMenuState() {
      if (isOpen) {
        menuBtn.setAttribute('aria-expanded', 'true');
        backdrop.classList.add('active');
        navLinks.classList.add('active');
        navActions.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
      } else {
        menuBtn.setAttribute('aria-expanded', 'false');
        backdrop.classList.remove('active');
        navLinks.classList.remove('active');
        navActions.classList.remove('active');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    }

    // Event listeners
    menuBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
    });

    backdrop.addEventListener('click', closeMenu);

    // Close on nav link click (support both .nav-link and .nav-link-pill)
    const links = navLinks.querySelectorAll('.nav-link, .nav-link-pill');
    links.forEach((link) => {
      link.addEventListener('click', closeMenu);
    });

    // Close on action button click
    const buttons = navActions.querySelectorAll('.btn-primary, .btn-secondary');
    buttons.forEach((button) => {
      button.addEventListener('click', closeMenu);
    });

    // Close on ESC key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) {
        closeMenu();
      }
    });

    // Close on resize to desktop
    let resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (window.innerWidth > 767 && isOpen) {
          closeMenu();
        }
      }, 250);
    });
  }

  // ====================================
  // LANGUAGE SELECTOR
  // ====================================
  function initLanguageSelector() {
    const langBtn = document.getElementById('language-btn');
    const langDropdown = document.getElementById('language-dropdown');
    const currentFlag = document.getElementById('current-flag');
    const currentLang = document.getElementById('current-lang');
    const langOptions = document.querySelectorAll('.lang-option');

    if (!langBtn || !langDropdown) {
      return;
    }

    // Toggle dropdown
    langBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      langDropdown.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
      if (!langBtn.contains(e.target) && !langDropdown.contains(e.target)) {
        langDropdown.classList.remove('show');
      }
    });

    // Select language
    langOptions.forEach((option) => {
      option.addEventListener('click', function (e) {
        e.preventDefault();
        const lang = this.getAttribute('data-lang');
        const flag = this.getAttribute('data-flag');

        if (currentFlag && currentLang) {
          currentFlag.textContent = flag;
          currentLang.textContent = lang;
        }

        langDropdown.classList.remove('show');

        // Save to localStorage
        localStorage.setItem('selectedLanguage', lang);
        localStorage.setItem('selectedFlag', flag);
      });
    });

    // Load saved language
    const savedLang = localStorage.getItem('selectedLanguage');
    const savedFlag = localStorage.getItem('selectedFlag');
    if (savedLang && savedFlag && currentLang && currentFlag) {
      currentLang.textContent = savedLang;
      currentFlag.textContent = savedFlag;
    }
  }

  // ====================================
  // NAVBAR SCROLL EFFECT
  // ====================================
  function initNavbarScroll() {
    const navbar = document.getElementById('navbar');

    if (!navbar) {
      return;
    }

    window.addEventListener('scroll', function () {
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;

      if (scrollTop > 100) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }

  // ====================================
  // SECTION TRACKING - Highlight active nav link based on scroll position
  // ====================================
  function initSectionTracking() {
    const navLinks = document.querySelectorAll('.nav-link-pill[data-section]');
    const sections = [];

    // Collect all sections that have corresponding nav links
    navLinks.forEach(link => {
      const sectionId = link.getAttribute('data-section');
      const section = document.getElementById(sectionId);
      if (section) {
        sections.push({
          id: sectionId,
          element: section,
          link: link
        });
      }
    });

    if (sections.length === 0) return;

    // Throttle function for performance
    function throttle(func, limit) {
      let inThrottle;
      return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    }

    // Update active link based on scroll position
    function updateActiveLink() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // Check if scrolled to bottom
      const isAtBottom = scrollTop + windowHeight >= documentHeight - 50;
      
      let currentSection = null;
      
      // If at bottom, activate the last section (contact)
      if (isAtBottom) {
        currentSection = sections[sections.length - 1];
      } else {
        // Find the section currently in view
        // Use offset to trigger slightly before section reaches top
        const offset = windowHeight * 0.4;
        
        sections.forEach(section => {
          const rect = section.element.getBoundingClientRect();
          const sectionTop = rect.top + scrollTop;
          const sectionBottom = sectionTop + section.element.offsetHeight;
          
          // Check if section is in view
          if (scrollTop >= sectionTop - offset && scrollTop < sectionBottom - offset) {
            currentSection = section;
          }
        });
        
        // Default to first section if none found and near top
        if (!currentSection && scrollTop < 200) {
          currentSection = sections[0];
        }
      }

      // Update active states
      if (currentSection) {
        navLinks.forEach(link => {
          link.classList.remove('active');
        });
        currentSection.link.classList.add('active');
      }
    }

    // Listen to scroll events with throttling
    window.addEventListener('scroll', throttle(updateActiveLink, 100));
    
    // Initial check
    updateActiveLink();
  }

  // ====================================
  // SMOOTH SCROLLING - Smooth scroll to sections on nav link click
  // ====================================
  function initSmoothScrolling() {
    const navLinks = document.querySelectorAll('.nav-link-pill[data-section]');
    const navbar = document.getElementById('navbar');
    
    navLinks.forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        
        const sectionId = this.getAttribute('data-section');
        const section = document.getElementById(sectionId);
        
        if (section) {
          // Calculate navbar height for offset
          const navbarHeight = navbar ? navbar.offsetHeight : 0;
          const offset = navbarHeight + 20;
          
          // Get section position
          const sectionTop = section.getBoundingClientRect().top + window.pageYOffset - offset;
          
          // Smooth scroll to section
          window.scrollTo({
            top: sectionTop,
            behavior: 'smooth'
          });
          
          // Update active state immediately for better UX
          navLinks.forEach(navLink => navLink.classList.remove('active'));
          this.classList.add('active');
          
          // Close mobile menu if open
          const mobileNavLinks = document.getElementById('navLinks');
          const backdrop = document.getElementById('mobileBackdrop');
          if (mobileNavLinks && mobileNavLinks.classList.contains('active')) {
            mobileNavLinks.classList.remove('active');
            if (backdrop) backdrop.classList.remove('active');
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
          }
        }
      });
    });
  }
})();
