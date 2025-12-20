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

    // Close on nav link click
    const links = navLinks.querySelectorAll('.nav-link');
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
})();
