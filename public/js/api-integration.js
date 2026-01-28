// ====================================
// ORDER API INTEGRATION
// Handles backend API calls for orders
// Cart is managed in localStorage (see cart.js)
// ====================================

(function (window) {
    'use strict';

    const API_BASE = '/buyer/api';

    // ====================================
    // ORDER API
    // ====================================

    const OrderAPI = {
        /**
         * Validate checkout - pass cart items to validate
         * @param {Array} items - Cart items from localStorage
         */
        async validateCheckout(items) {
            try {
                const response = await fetch(`${API_BASE}/checkout/validate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ items })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Checkout validation failed');
                }

                return data;
            } catch (error) {
                console.error('Order API - validateCheckout error:', error);
                throw error;
            }
        },

        /**
         * Create order from cart items
         * @param {Object} orderData - Order data including items, payment info
         */
        async createOrder(orderData) {
            try {
                const response = await fetch(`${API_BASE}/orders/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(orderData)
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to create order');
                }

                return data;
            } catch (error) {
                console.error('Order API - createOrder error:', error);
                throw error;
            }
        },

        /**
         * Get orders with filters
         * @param {Object} filters - Filter options (status, dateFrom, dateTo, search, page, limit)
         */
        async getOrders(filters = {}) {
            try {
                const queryParams = new URLSearchParams();

                Object.keys(filters).forEach(key => {
                    if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
                        queryParams.append(key, filters[key]);
                    }
                });

                const url = `${API_BASE}/orders${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to get orders');
                }

                return data;
            } catch (error) {
                console.error('Order API - getOrders error:', error);
                throw error;
            }
        },

        /**
         * Get order details
         * @param {string} orderNumber - The order number
         */
        async getOrderDetails(orderNumber) {
            try {
                const response = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderNumber)}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to get order details');
                }

                return data;
            } catch (error) {
                console.error('Order API - getOrderDetails error:', error);
                throw error;
            }
        },

        /**
         * Cancel order
         * @param {string} orderNumber - The order number
         * @param {string} reason - Cancellation reason
         */
        async cancelOrder(orderNumber, reason = 'Cancelled by customer') {
            try {
                const response = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderNumber)}/cancel`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ reason })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to cancel order');
                }

                return data;
            } catch (error) {
                console.error('Order API - cancelOrder error:', error);
                throw error;
            }
        },

        /**
         * Process payment for order
         * @param {string} orderNumber - The order number
         * @param {Object} paymentData - Payment transaction data
         */
        async processPayment(orderNumber, paymentData) {
            try {
                const response = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderNumber)}/payment`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(paymentData)
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to process payment');
                }

                return data;
            } catch (error) {
                console.error('Order API - processPayment error:', error);
                throw error;
            }
        }
    };

    // Export to window
    window.PartsFormAPI = {
        Order: OrderAPI
    };

})(window);
