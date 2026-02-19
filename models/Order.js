const mongoose = require('mongoose');

/**
 * Order Item Schema
 * Stores complete part details in order (snapshot at time of order)
 * Each item is stored individually - NO quantity grouping
 * Parts are stored by part number and all details (no partId reference)
 */
const orderItemSchema = new mongoose.Schema({
    // Part Number is the primary identifier (no partId - parts can change)
    partNumber: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    brand: {
        type: String,
        trim: true,
        default: 'N/A'
    },
    supplier: {
        type: String,
        trim: true,
        default: ''
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'AED',
        uppercase: true
    },
    weight: {
        type: Number,
        min: 0,
        default: 0
    },
    stock: {
        type: String,
        default: 'N/A'
    },
    origin: {
        type: String,
        trim: true,
        default: ''
    },
    terms: {
        type: String,
        trim: true,
        default: 'N/A'
    },
    aircraftType: {
        type: String,
        trim: true,
        default: 'N/A'
    },
    reference: {
        type: String,
        trim: true,
        default: ''
    },
    addPacking: {
        type: Boolean,
        default: false
    },
    category: {
        type: String,
        trim: true,
        default: 'general'
    },
    // Each item has its own addedAt timestamp
    addedAt: {
        type: Date,
        default: Date.now
    }
}, {
    _id: true
});

/**
 * Timeline Event Schema
 */
const timelineEventSchema = new mongoose.Schema({
    status: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    updatedBy: {
        type: String,
        default: 'System'
    },
    isNote: {
        type: Boolean,
        default: false
    },
    noteType: {
        type: String,
        enum: ['update', 'delay', 'issue', 'info', 'action', 'resolution', 'custom', null],
        default: null
    }
}, {
    _id: true
});

/**
 * Payment Transaction Schema
 */
const paymentTransactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        trim: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    method: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    processedAt: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    }
}, {
    _id: true
});

/**
 * Order Schema
 */
const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    buyer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Buyer',
        required: true,
        index: true
    },

    // Order Items
    items: [orderItemSchema],

    // Pricing
    pricing: {
        subtotal: {
            type: Number,
            required: true,
            min: 0
        },
        tax: {
            type: Number,
            default: 0,
            min: 0
        },
        shipping: {
            type: Number,
            default: 0,
            min: 0
        },
        processingFee: {
            type: Number,
            default: 0,
            min: 0
        },
        discount: {
            type: Number,
            default: 0,
            min: 0
        },
        total: {
            type: Number,
            required: true,
            min: 0
        },
        currency: {
            type: String,
            default: 'AED',
            uppercase: true
        }
    },

    // Payment Information
    payment: {
        type: {
            type: String,
            enum: ['full', 'partial'],
            required: true
        },
        method: {
            type: String,
            enum: ['card', 'bank-dubai', 'bank-international', 'paypal', 'cod'],
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'paid', 'partial', 'failed', 'refunded'],
            default: 'pending'
        },
        amountPaid: {
            type: Number,
            default: 0,
            min: 0
        },
        amountDue: {
            type: Number,
            default: 0,
            min: 0
        },
        transactions: [paymentTransactionSchema]
    },

    // Shipping Information
    shipping: {
        addressId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Buyer.addresses'
        },
        label: String,
        fullName: String,
        phone: String,
        street: String,
        city: String,
        state: String,
        country: String,
        postalCode: String,
        notes: String,
        // Legacy fields for backward compatibility
        firstName: String,
        lastName: String,
        companyName: String,
        address: String,
        email: String,
        trackingNumber: String,
        carrier: String,
        estimatedDelivery: Date,
        actualDelivery: Date
    },

    // Order Status
    status: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'],
        default: 'pending',
        index: true
    },

    // Timeline
    timeline: [timelineEventSchema],

    // Additional Information
    notes: {
        type: String,
        trim: true,
        default: ''
    },

    // Order Type
    type: {
        type: String,
        enum: ['regular'],
        default: 'regular'
    },

    // Priority
    priority: {
        type: String,
        enum: ['normal', 'high', 'urgent'],
        default: 'normal'
    },

    // Metadata
    totalItems: {
        type: Number,
        required: true,
        min: 0
    },
    totalWeight: {
        type: Number,
        default: 0,
        min: 0
    },

    // Cancellation
    cancellation: {
        reason: String,
        cancelledAt: Date,
        cancelledBy: String
    },

    // Referral Information
    referral: {
        referralCode: {
            type: String,
            uppercase: true,
            trim: true,
            index: true
        },
        referralPartner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ReferralPartner'
        },
        discountRate: {
            type: Number,
            default: 0,
            min: 0
        },
        discountAmount: {
            type: Number,
            default: 0,
            min: 0
        },
        commissionRate: {
            type: Number,
            default: 0,
            min: 0
        },
        commissionAmount: {
            type: Number,
            default: 0,
            min: 0
        },
        commissionStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'paid', 'cancelled'],
            default: 'pending'
        }
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
// Note: orderNumber index is already created by unique: true
orderSchema.index({ 'buyer': 1, 'createdAt': -1 });
orderSchema.index({ 'status': 1, 'createdAt': -1 });

// Virtual for order items preview (first 3 items)
orderSchema.virtual('itemsPreview').get(function () {
    return this.items.slice(0, 3).map(item => item.description || item.partNumber);
});

// Method to add timeline event
orderSchema.methods.addTimelineEvent = function (status, message, updatedBy = 'System') {
    this.timeline.push({
        status,
        message,
        timestamp: new Date(),
        updatedBy
    });
};

// Method to update status
orderSchema.methods.updateStatus = async function (newStatus, message, updatedBy = 'System') {
    this.status = newStatus;
    this.addTimelineEvent(newStatus, message, updatedBy);
    await this.save();
};

// Method to add payment transaction
orderSchema.methods.addPaymentTransaction = function (transactionData) {
    this.payment.transactions.push({
        transactionId: transactionData.transactionId || '',
        amount: transactionData.amount,
        method: transactionData.method || this.payment.method,
        status: transactionData.status || 'completed',
        processedAt: new Date(),
        notes: transactionData.notes || ''
    });

    // Update payment amounts
    if (transactionData.status === 'completed') {
        this.payment.amountPaid += transactionData.amount;
        this.payment.amountDue = Math.max(0, this.pricing.total - this.payment.amountPaid);

        // Update payment status
        if (this.payment.amountDue <= 0) {
            this.payment.status = 'paid';
        } else if (this.payment.amountPaid > 0) {
            this.payment.status = 'partial';
        }
    }
};

// Method to cancel order
orderSchema.methods.cancelOrder = async function (reason, cancelledBy = 'Buyer') {
    if (this.status === 'cancelled' || this.status === 'completed') {
        throw new Error('Order cannot be cancelled');
    }

    this.status = 'cancelled';
    this.cancellation = {
        reason,
        cancelledAt: new Date(),
        cancelledBy
    };
    this.addTimelineEvent('cancelled', `Order cancelled: ${reason}`, cancelledBy);
    
    // Update referral commission status if applicable
    if (this.referral && this.referral.referralPartner) {
        this.referral.commissionStatus = 'cancelled';
        // Also update the ReferralCommission record
        try {
            const ReferralCommission = mongoose.model('ReferralCommission');
            await ReferralCommission.updateOrderStatus(this._id, 'cancelled');
        } catch (err) {
            console.error('Error updating referral commission status:', err);
        }
    }
    
    await this.save();
};

// Static method to generate order number
orderSchema.statics.generateOrderNumber = async function () {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD

    // Find orders with same date prefix
    const prefix = `ORD-${dateStr}`;
    const lastOrder = await this.findOne({
        orderNumber: new RegExp(`^${prefix}`)
    }).sort({ orderNumber: -1 });

    let sequence = 1;
    if (lastOrder) {
        const lastSequence = parseInt(lastOrder.orderNumber.split('-').pop());
        sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
};

/**
 * Static method to create order from cart items
 * Each cart item becomes a separate order item (no quantity grouping)
 * All part details are stored directly in the order
 */
orderSchema.statics.createFromCartItems = async function (buyer, cartItems, paymentInfo) {
    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    // Validate cart items
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        throw new Error('Cart items are required');
    }

    // Prepare order items - each cart item is a separate order item
    // No quantity grouping - each item is individual
    const orderItems = cartItems.map(item => {
        const price = parseFloat(item.price) || 0;
        return {
            partNumber: item.code || item.partNumber || 'N/A',
            description: item.description || '',
            brand: item.brand || 'N/A',
            supplier: item.supplier || '',
            price: price,
            currency: item.currency || 'AED',
            weight: parseFloat(item.weight) || 0,
            stock: item.stock || 'N/A',
            terms: item.terms || 'N/A',
            aircraftType: item.aircraftType || 'N/A',
            reference: item.reference || '',
            addPacking: item.addPacking || false,
            category: item.category || 'general',
            addedAt: item.dateCreated ? new Date(item.dateCreated) : new Date()
        };
    });

    // Calculate totals - each item counts as 1 (no quantity field)
    const totalItems = orderItems.length;
    const subtotal = orderItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    const totalWeight = orderItems.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0);
    
    // Calculate referral discount if applied
    let referralDiscount = 0;
    let referralData = null;
    if (paymentInfo.referral && paymentInfo.referral.code) {
        referralDiscount = parseFloat(paymentInfo.referral.discountAmount) || 0;
        referralData = {
            referralCode: paymentInfo.referral.code,
            referralPartner: paymentInfo.referral.partnerId,
            discountRate: paymentInfo.referral.discountRate || 0,
            discountAmount: referralDiscount,
            commissionRate: paymentInfo.referral.commissionRate || 5,
            commissionAmount: subtotal * ((paymentInfo.referral.commissionRate || 5) / 100),
            commissionStatus: 'pending'
        };
    }
    
    const processingFee = parseFloat(paymentInfo.fee) || 0;
    const total = subtotal - referralDiscount + processingFee;

    // Order defaults
    const orderType = 'regular';
    const priority = 'normal';

    // Build shipping address - use provided address or fallback to buyer info
    const shippingData = paymentInfo.shippingAddress ? {
        addressId: paymentInfo.shippingAddress.addressId,
        label: paymentInfo.shippingAddress.label,
        fullName: paymentInfo.shippingAddress.fullName,
        phone: paymentInfo.shippingAddress.phone,
        street: paymentInfo.shippingAddress.street,
        city: paymentInfo.shippingAddress.city,
        state: paymentInfo.shippingAddress.state,
        country: paymentInfo.shippingAddress.country,
        postalCode: paymentInfo.shippingAddress.postalCode || '',
        notes: paymentInfo.shippingAddress.notes || '',
        // Legacy fields
        firstName: paymentInfo.shippingAddress.fullName?.split(' ')[0] || buyer.firstName,
        lastName: paymentInfo.shippingAddress.fullName?.split(' ').slice(1).join(' ') || buyer.lastName,
        address: paymentInfo.shippingAddress.street,
        email: buyer.email
    } : {
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        fullName: `${buyer.firstName} ${buyer.lastName}`,
        companyName: buyer.companyName,
        address: buyer.shippingAddress,
        street: buyer.shippingAddress,
        city: buyer.city,
        country: buyer.country,
        phone: buyer.phone,
        email: buyer.email
    };

    // Create order
    const orderData = {
        orderNumber,
        buyer: buyer._id,
        items: orderItems,
        pricing: {
            subtotal,
            tax: 0,
            shipping: 0,
            processingFee,
            discount: referralDiscount,
            total,
            currency: 'AED'
        },
        payment: {
            type: paymentInfo.type,
            method: paymentInfo.method,
            status: 'pending',
            amountPaid: 0,
            amountDue: total,
            transactions: []
        },
        shipping: shippingData,
        status: 'pending',
        timeline: [{
            status: 'pending',
            message: 'Order created and awaiting payment',
            timestamp: new Date(),
            updatedBy: 'System'
        }],
        type: orderType,
        priority: priority,
        totalItems,
        totalWeight,
        notes: paymentInfo.notes || ''
    };

    // Add referral data if present
    if (referralData) {
        orderData.referral = referralData;
    }

    const order = await this.create(orderData);

    return order;
};

// Enable virtuals in JSON
orderSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret.__v;
        return ret;
    }
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
