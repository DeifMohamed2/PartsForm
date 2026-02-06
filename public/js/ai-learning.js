/**
 * AI Learning Client
 *
 * This module helps the AI learn from user behavior to improve search results.
 * It automatically tracks:
 * - Search refinements (when user searches again after a failed search)
 * - User engagement (clicks, views, cart additions)
 * - Explicit feedback (if requested)
 */

class AILearningClient {
  constructor() {
    this.lastSearchQuery = null;
    this.lastSearchRecordId = null;
    this.lastSearchResultsCount = 0;
    this.sessionStartTime = Date.now();

    // Auto-initialize
    this.init();
  }

  init() {
    console.log('🧠 AI Learning Client initialized');

    // Track page visibility for dwell time
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.lastSearchRecordId) {
        this.recordEngagement({
          dwellTime: Date.now() - this.sessionStartTime,
        });
      }
    });
  }

  /**
   * Record a new search - called after AI search completes
   */
  recordSearch(query, resultsCount, recordId) {
    // Check if this is a refinement of previous search
    if (
      this.lastSearchQuery &&
      this.lastSearchResultsCount === 0 &&
      resultsCount > 0 &&
      query !== this.lastSearchQuery
    ) {
      // User refined their search and got better results - learning opportunity!
      this.recordRefinement(this.lastSearchQuery, query, resultsCount);
    }

    // Update tracking
    this.lastSearchQuery = query;
    this.lastSearchResultsCount = resultsCount;
    this.lastSearchRecordId = recordId;
    this.sessionStartTime = Date.now();
  }

  /**
   * Record that user viewed a part's details
   */
  recordPartViewed(partId) {
    if (!this.lastSearchRecordId) return;

    this.recordEngagement({
      viewedDetails: true,
      partViewed: partId,
    });
  }

  /**
   * Record that user added a part to cart
   */
  recordAddedToCart(partId) {
    if (!this.lastSearchRecordId) return;

    this.recordEngagement({
      addedToCart: true,
      partAdded: partId,
    });
  }

  /**
   * Record scroll depth (0-100)
   */
  recordScrollDepth(depth) {
    if (!this.lastSearchRecordId) return;

    // Debounce - only record significant scroll changes
    if (
      !this._lastScrollDepth ||
      Math.abs(depth - this._lastScrollDepth) >= 25
    ) {
      this._lastScrollDepth = depth;
      this.recordEngagement({
        scrollDepth: depth,
      });
    }
  }

  /**
   * Record a search refinement (user improved their search)
   */
  async recordRefinement(originalQuery, refinedQuery, resultsCount) {
    try {
      const response = await fetch('/api/ai-learn/refinement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalQuery,
          refinedQuery,
          refinedResultsCount: resultsCount,
        }),
      });

      const result = await response.json();
      if (result.learned) {
        console.log(`🧠 AI learned: "${originalQuery}" → "${refinedQuery}"`);
      }
    } catch (error) {
      console.warn('Learning refinement error:', error);
    }
  }

  /**
   * Record user engagement (async, non-blocking)
   */
  async recordEngagement(engagement) {
    if (!this.lastSearchRecordId) return;

    try {
      await fetch('/api/ai-learn/engagement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recordId: this.lastSearchRecordId,
          engagement,
        }),
      });
    } catch (error) {
      // Silent fail - don't interrupt user experience
    }
  }

  /**
   * Record explicit user feedback (when asked)
   */
  async recordFeedback(rating, helpful, comment = '') {
    if (!this.lastSearchRecordId) {
      console.warn('No search to provide feedback for');
      return { success: false };
    }

    try {
      const response = await fetch('/api/ai-learn/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recordId: this.lastSearchRecordId,
          feedback: { rating, helpful, comment },
        }),
      });

      const result = await response.json();
      if (result.success) {
        console.log('🧠 Thank you for helping the AI learn!');
      }
      return result;
    } catch (error) {
      console.warn('Feedback error:', error);
      return { success: false };
    }
  }

  /**
   * Get AI learning statistics
   */
  async getStats() {
    try {
      const response = await fetch('/api/ai-learn/stats');
      return await response.json();
    } catch (error) {
      console.warn('Stats error:', error);
      return null;
    }
  }

  /**
   * Show a simple feedback prompt (optional UI enhancement)
   */
  showFeedbackPrompt(container) {
    if (!this.lastSearchRecordId) return;

    const html = `
      <div class="ai-feedback-prompt" style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        padding: 16px;
        margin: 16px 0;
        color: white;
        font-family: inherit;
      ">
        <p style="margin: 0 0 12px 0; font-weight: 500;">
          🧠 Help our AI improve! Was this search helpful?
        </p>
        <div style="display: flex; gap: 8px;">
          <button onclick="aiLearning.recordFeedback(5, true)" style="
            background: rgba(255,255,255,0.2);
            border: none;
            border-radius: 8px;
            padding: 8px 16px;
            color: white;
            cursor: pointer;
            transition: background 0.2s;
          " onmouseover="this.style.background='rgba(255,255,255,0.3)'"
             onmouseout="this.style.background='rgba(255,255,255,0.2)'">
            👍 Yes
          </button>
          <button onclick="aiLearning.recordFeedback(2, false)" style="
            background: rgba(255,255,255,0.2);
            border: none;
            border-radius: 8px;
            padding: 8px 16px;
            color: white;
            cursor: pointer;
            transition: background 0.2s;
          " onmouseover="this.style.background='rgba(255,255,255,0.3)'"
             onmouseout="this.style.background='rgba(255,255,255,0.2)'">
            👎 No
          </button>
        </div>
      </div>
    `;

    if (typeof container === 'string') {
      container = document.querySelector(container);
    }

    if (container) {
      container.insertAdjacentHTML('beforeend', html);
    }
  }
}

// Create global instance
window.aiLearning = new AILearningClient();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AILearningClient;
}
