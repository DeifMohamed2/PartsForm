// ====================================
// QUICK SEARCH FUNCTIONALITY
// Professional search with animations and query strings
// ====================================

(function () {
  'use strict';

  // ====================================
  // QUICK SEARCH MODAL
  // ====================================
  const quickSearchBtn = document.getElementById('quick-search-btn');
  const quickSearchModal = document.getElementById('quick-search-modal');
  const quickSearchBackdrop = document.getElementById('quick-search-backdrop');
  const quickSearchClose = document.getElementById('quick-search-close');
  const quickSearchInput = document.getElementById('quick-search-input');
  const quickSearchClear = document.getElementById('quick-search-clear');
  const quickSearchSubmit = document.getElementById('quick-search-submit');
  const categoryOptions = document.querySelectorAll('.category-option');
  const recentSearchesContainer = document.getElementById('quick-search-recent');
  const recentItemsContainer = document.getElementById('recent-items');

  let selectedCategory = 'automotive'; // Default category

  // Open Quick Search Modal
  function openQuickSearch() {
    quickSearchModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Focus on input after animation
    setTimeout(() => {
      quickSearchInput?.focus();
    }, 300);

    // Load recent searches
    loadRecentSearches();

    // Reinitialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // Close Quick Search Modal
  function closeQuickSearch() {
    quickSearchModal.classList.remove('active');
    document.body.style.overflow = '';
    quickSearchInput.value = '';
    quickSearchClear.style.display = 'none';
  }

  // Event Listeners for Modal
  if (quickSearchBtn) {
    quickSearchBtn.addEventListener('click', openQuickSearch);
  }

  if (quickSearchClose) {
    quickSearchClose.addEventListener('click', closeQuickSearch);
  }

  if (quickSearchBackdrop) {
    quickSearchBackdrop.addEventListener('click', closeQuickSearch);
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && quickSearchModal?.classList.contains('active')) {
      closeQuickSearch();
    }
  });

  // ====================================
  // SEARCH INPUT MANAGEMENT
  // ====================================
  if (quickSearchInput && quickSearchClear) {
    quickSearchInput.addEventListener('input', (e) => {
      if (e.target.value.length > 0) {
        quickSearchClear.style.display = 'flex';
      } else {
        quickSearchClear.style.display = 'none';
      }
    });

    quickSearchClear.addEventListener('click', () => {
      quickSearchInput.value = '';
      quickSearchClear.style.display = 'none';
      quickSearchInput.focus();
    });

    // Submit on Enter key
    quickSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performQuickSearch();
      }
    });
  }

  // ====================================
  // CATEGORY SELECTION
  // ====================================
  categoryOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Remove active class from all options
      categoryOptions.forEach(opt => opt.classList.remove('active'));
      
      // Add active class to clicked option
      option.classList.add('active');
      
      // Update selected category
      selectedCategory = option.getAttribute('data-category');
    });
  });

  // ====================================
  // PERFORM SEARCH
  // ====================================
  function performQuickSearch() {
    const searchQuery = quickSearchInput?.value.trim();

    if (!searchQuery) {
      // Shake animation for empty search
      quickSearchInput?.classList.add('shake');
      setTimeout(() => {
        quickSearchInput?.classList.remove('shake');
      }, 500);
      return;
    }

    // Save to recent searches
    saveRecentSearch(searchQuery, selectedCategory);

    // Construct URL with query parameter
    const searchUrl = `/buyer/search-${selectedCategory}?partnumber=${encodeURIComponent(searchQuery)}`;

    // Navigate to search page
    window.location.href = searchUrl;
  }

  if (quickSearchSubmit) {
    quickSearchSubmit.addEventListener('click', performQuickSearch);
  }

  // ====================================
  // RECENT SEARCHES MANAGEMENT
  // ====================================
  function saveRecentSearch(query, category) {
    let recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');

    // Create search object
    const searchObj = {
      query: query,
      category: category,
      timestamp: Date.now()
    };

    // Remove duplicate if exists
    recentSearches = recentSearches.filter(s => 
      !(s.query.toLowerCase() === query.toLowerCase() && s.category === category)
    );

    // Add to beginning of array
    recentSearches.unshift(searchObj);

    // Keep only last 5 searches
    recentSearches = recentSearches.slice(0, 5);

    // Save to localStorage
    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
  }

  function loadRecentSearches() {
    const recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');

    if (recentSearches.length > 0 && recentSearchesContainer && recentItemsContainer) {
      recentSearchesContainer.style.display = 'block';
      recentItemsContainer.innerHTML = '';

      recentSearches.forEach(search => {
        const recentItem = document.createElement('div');
        recentItem.className = 'recent-item';
        
        const categoryIcon = getCategoryIcon(search.category);
        
        recentItem.innerHTML = `
          <div class="recent-item-text">
            <i data-lucide="${categoryIcon}"></i>
            <span>${search.query}</span>
          </div>
          <span class="recent-item-category">${formatCategory(search.category)}</span>
        `;

        recentItem.addEventListener('click', () => {
          const searchUrl = `/buyer/search-${search.category}?partnumber=${encodeURIComponent(search.query)}`;
          window.location.href = searchUrl;
        });

        recentItemsContainer.appendChild(recentItem);
      });

      // Reinitialize Lucide icons for recent items
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    } else if (recentSearchesContainer) {
      recentSearchesContainer.style.display = 'none';
    }
  }

  function getCategoryIcon(category) {
    const icons = {
      'automotive': 'car-front',
      'aviation': 'plane',
      'machinery': 'construction'
    };
    return icons[category] || 'search';
  }

  function formatCategory(category) {
    const names = {
      'automotive': 'Automotive',
      'aviation': 'Aviation',
      'machinery': 'Machinery'
    };
    return names[category] || category;
  }

  // ====================================
  // HANDLE URL QUERY PARAMETERS
  // On search pages, if there's a partnumber query, trigger search
  // ====================================
  function handleURLQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    const partNumber = urlParams.get('partnumber');
    
    if (partNumber) {
      // Get the search input on the page (from search2.js)
      const mainSearchInput = document.getElementById('search2-input');
      const mainSearchBtn = document.getElementById('search2-btn');
      
      if (mainSearchInput) {
        // Set the value
        mainSearchInput.value = partNumber;
        
        // Trigger search if button exists
        if (mainSearchBtn) {
          // Small delay to ensure page is fully loaded
          setTimeout(() => {
            mainSearchBtn.click();
          }, 100);
        }
      }
    }
  }

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleURLQuery);
  } else {
    handleURLQuery();
  }

  // ====================================
  // SHAKE ANIMATION FOR VALIDATION
  // ====================================
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
      20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
    .shake {
      animation: shake 0.5s;
    }
  `;
  document.head.appendChild(style);

})();
