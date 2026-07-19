
const ORDER_STATUS = Object.freeze({
    PENDING: "Pending",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    RETURN_REQUEST: "Return Request",
    RETURNED: "Returned",
    RETURN_REQUEST_APPROVED: "Return Request Approved",
    RETURN_REQUEST_REJECTED: "Return Request Rejected",
});

const ITEM_STATUS = Object.freeze({
    ACTIVE: "Active",
    CANCELLED: "Cancelled",
    RETURNED: "Returned",
    RETURN_APPROVED: "Return Approved",
    RETURN_REJECTED: "Return Rejected",
});

const RETURN_DECISION = Object.freeze({
    APPROVED: "Approved",
    REJECTED: "Rejected",
});
const PAYMENT_METHOD = Object.freeze({
    RAZORPAY: "razorPay",
});
const PAYMENT_STATUS = Object.freeze({
    SUCCESS: "Success",
    FAILED: "Failed",
    PENDING: "Pending",
    REFUNDED: "Refunded",
});
 

const VALID_ORDER_STATUSES = Object.freeze([
    ORDER_STATUS.PENDING,
    ORDER_STATUS.PROCESSING,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.CANCELLED,
    ORDER_STATUS.RETURN_REQUEST,
    ORDER_STATUS.RETURNED,
]);

module.exports = {
    ORDER_STATUS,
    ITEM_STATUS,
    RETURN_DECISION,
    VALID_ORDER_STATUSES,
    PAYMENT_STATUS,
    PAYMENT_METHOD,
};