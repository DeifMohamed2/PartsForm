// ====================================
// AOG CASE INTEGRATION WITH SEARCH
// Handles AOG case creation from aviation search
// ====================================

document.addEventListener('DOMContentLoaded', () => {
  // Check if we're on aviation search page
  const isAviationPage = window.location.pathname.includes('aviation');
  const aogButton = document.getElementById('create-aog-case-btn');
  const addToCartButton = document.getElementById('add-to-cart-btn');
  const aogSelectedCount = document.getElementById('aog-selected-count');

  // Show AOG button only on aviation search
  if (isAviationPage && aogButton) {
    aogButton.style.display = 'inline-flex';

    // Update AOG button count when selection changes
    const updateAOGCount = () => {
      const selectedCount = document.querySelectorAll(
        '.results-table tbody input[type="checkbox"]:checked'
      ).length;
      aogSelectedCount.textContent = selectedCount;

      // Enable/disable button based on selection
      if (selectedCount > 0) {
        aogButton.disabled = false;
      } else {
        aogButton.disabled = true;
      }
    };

    // Listen for checkbox changes
    document.addEventListener('change', (e) => {
      if (
        e.target.type === 'checkbox' &&
        e.target.closest('.results-table tbody')
      ) {
        updateAOGCount();
      }
    });

    // Handle AOG case creation
    aogButton.addEventListener('click', () => {
      const selectedParts = getSelectedParts();

      if (selectedParts.length === 0) {
        alert('Please select at least one part to create an AOG case');
        return;
      }

      // Store selected parts in sessionStorage for case creation form
      sessionStorage.setItem('aog-selected-parts', JSON.stringify(selectedParts));

      // Calculate total
      const total = selectedParts.reduce((sum, part) => sum + part.total, 0);
      sessionStorage.setItem('aog-parts-total', total.toFixed(2));

      // Redirect to AOG case creation form
      window.location.href = '/buyer/aog/case-create';
    });
  }

  // Helper function to get selected parts
  function getSelectedParts() {
    const parts = [];
    const checkboxes = document.querySelectorAll(
      '.results-table tbody input[type="checkbox"]:checked'
    );

    checkboxes.forEach((checkbox) => {
      const row = checkbox.closest('tr');
      const brand = row.querySelector('td:nth-child(2)').textContent.trim();
      const vendorCode = row
        .querySelector('td:nth-child(3)')
        .textContent.trim();
      const description = row
        .querySelector('td:nth-child(4)')
        .textContent.trim();
      const supplier = row.querySelector('td:nth-child(5)').textContent.trim();
      const origin = row.querySelector('td:nth-child(6)').textContent.trim();
      const stock = row.querySelector('td:nth-child(8)').textContent.trim();
      const weight = row.querySelector('td:nth-child(9)').textContent.trim();
      const delivery = row.querySelector('td:nth-child(10)').textContent.trim();
      const quantity = parseInt(
        row.querySelector('input[type="number"]').value
      );
      const totalText = row.querySelector('td:nth-child(12)').textContent.trim();
      const total = parseFloat(totalText.replace(/[^0-9.-]+/g, ''));

      parts.push({
        brand,
        vendorCode,
        description,
        supplier,
        origin,
        stock,
        weight,
        delivery,
        quantity,
        total,
      });
    });

    return parts;
  }
});
