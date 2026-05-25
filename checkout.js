// checkout.js
// Checkout page logic: load order data, calculate change, print receipt, and save completed orders.

const STORAGE_CURRENT_ORDER = 'currentFoodOrder';
const STORAGE_HISTORY = 'foodOrderHistory';

const receiptStatus = document.getElementById('receipt-status');
const receiptCustomer = document.getElementById('receipt-customer');
const receiptNumber = document.getElementById('receipt-number');
const receiptDate = document.getElementById('receipt-date');
const receiptItems = document.getElementById('receipt-items');
const receiptTotalOrders = document.getElementById('receipt-total-orders');
const receiptTotalAmount = document.getElementById('receipt-total-amount');
const receiptCash = document.getElementById('receipt-cash');
const receiptChange = document.getElementById('receipt-change');
const receiptChangeStatus = document.getElementById('receipt-change-status');
const receiptPaymentStatus = document.getElementById('receipt-payment-status');
const cashInput = document.getElementById('cash-input');
const calculateButton = document.getElementById('calculate-button');
const confirmButton = document.getElementById('confirm-button');
const printButton = document.getElementById('print-button');
const backButton = document.getElementById('back-button');
const checkoutMessage = document.getElementById('checkout-message');
const markChangeButton = document.getElementById('mark-change-button');

let currentOrder = null;

function initializeCheckout() {
    loadCurrentOrder();
    if (!currentOrder || !currentOrder.items || currentOrder.items.length === 0) {
        showEmptyState();
        return;
    }

    renderReceipt();
    cashInput.value = currentOrder.cashReceived || currentOrder.totalAmount;
    updatePaymentPreview();

    calculateButton.addEventListener('click', updatePaymentPreview);
    cashInput.addEventListener('input', updatePaymentPreview);
    confirmButton.addEventListener('click', confirmPayment);
    markChangeButton.addEventListener('click', markChangeGiven);
    printButton.addEventListener('click', printReceipt);
    backButton.addEventListener('click', () => window.location.href = 'index.html');
}

function loadCurrentOrder() {
    const saved = localStorage.getItem(STORAGE_CURRENT_ORDER);
    if (!saved) {
        currentOrder = null;
        return;
    }

    currentOrder = JSON.parse(saved);
}

function showEmptyState() {
    receiptStatus.textContent = 'No order found';
    receiptCustomer.textContent = '-';
    receiptNumber.textContent = '-';
    receiptDate.textContent = '-';
    receiptItems.innerHTML = '<p>Please return to the order page and place an order.</p>';
    receiptTotalOrders.textContent = '0';
    receiptTotalAmount.textContent = '₱0.00';
    receiptCash.textContent = '₱0.00';
    receiptChange.textContent = '-';
    receiptChangeStatus.textContent = '-';
    receiptPaymentStatus.textContent = 'UNPAID';
    checkoutMessage.textContent = 'No current order found in storage.';
    calculateButton.disabled = true;
    confirmButton.disabled = true;
    markChangeButton.disabled = true;
    cashInput.disabled = true;
    printButton.disabled = true;
}

function renderReceipt() {
    receiptStatus.textContent = currentOrder.paymentStatus || 'UNPAID';
    receiptCustomer.textContent = currentOrder.customerName || 'Unknown';
    receiptNumber.textContent = currentOrder.orderNumber || '-';
    receiptDate.textContent = currentOrder.dateTime || new Date().toLocaleString();

    receiptItems.innerHTML = '';
    currentOrder.items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'receipt-item';
        row.innerHTML = `
            <div>
                <strong>${item.name}</strong><br />
                <span>₱${item.price.toFixed(2)} × ${item.quantity}</span>
            </div>
            <div>
                <span>₱${item.lineTotal.toFixed(2)}</span>
            </div>
        `;
        receiptItems.appendChild(row);
    });

    receiptTotalOrders.textContent = currentOrder.totalQuantity;
    receiptTotalAmount.textContent = `₱${currentOrder.totalAmount.toFixed(2)}`;
    receiptCash.textContent = `₱${(currentOrder.cashReceived || 0).toFixed(2)}`;
    receiptChange.textContent = currentOrder.change !== undefined ? formatChange(currentOrder) : '-';
    receiptChangeStatus.textContent = changeStatusLabel(currentOrder);
    receiptPaymentStatus.textContent = currentOrder.paymentStatus || 'UNPAID';
    markChangeButton.disabled = !(currentOrder.paymentStatus === 'PAID' && currentOrder.change > 0 && currentOrder.changeStatus !== 'GIVEN');
}

function updatePaymentPreview() {
    if (!currentOrder) return;

    const cash = parseInt(cashInput.value, 10);
    const total = currentOrder.totalAmount;

    if (Number.isNaN(cash) || cash < 0) {
        checkoutMessage.textContent = 'Enter a valid cash amount.';
        receiptCash.textContent = '₱0.00';
        receiptChange.textContent = '-';
        receiptChangeStatus.textContent = '-';
        receiptPaymentStatus.textContent = 'UNPAID';
        currentOrder.cashReceived = 0;
        currentOrder.change = 0;
        currentOrder.paymentStatus = 'UNPAID';
        currentOrder.changeStatus = undefined;
        saveCurrentOrder();
        return;
    }

    currentOrder.cashReceived = cash;

    if (cash < total) {
        currentOrder.change = 0;
        currentOrder.paymentStatus = 'UNPAID';
        currentOrder.changeStatus = undefined;
        checkoutMessage.textContent = 'Insufficient payment. Please enter enough cash.';
    } else if (cash === total) {
        currentOrder.change = 0;
        currentOrder.paymentStatus = 'PAID';
        currentOrder.changeStatus = 'NO_CHANGE_NEEDED';
        checkoutMessage.textContent = 'Exact payment received. No change required.';
    } else {
        currentOrder.change = cash - total;
        currentOrder.paymentStatus = 'PAID';
        // default to not yet given until someone marks it
        if (!currentOrder.changeStatus || currentOrder.changeStatus === 'NO_CHANGE_NEEDED') {
            currentOrder.changeStatus = 'NOT_YET_GIVEN';
        }
        checkoutMessage.textContent = `Change automatically calculated: ₱${currentOrder.change.toFixed(2)}.`;
    }

    renderReceipt();
    saveCurrentOrder();
}

function confirmPayment() {
    if (!currentOrder) return;

    updatePaymentPreview();
    if (currentOrder.paymentStatus === 'UNPAID') {
        checkoutMessage.textContent = 'Payment is insufficient. Please enter enough cash.';
        return;
    }

    currentOrder.dateTime = new Date().toLocaleString();
    currentOrder.paymentStatus = 'PAID';

    // Ensure changeStatus is set appropriately on confirm
    if (currentOrder.change === 0) {
        currentOrder.changeStatus = 'NO_CHANGE_NEEDED';
    } else if (currentOrder.change > 0 && !currentOrder.changeStatus) {
        currentOrder.changeStatus = 'NOT_YET_GIVEN';
    }

    saveCurrentOrder();
    saveOrderHistory(currentOrder);
    renderReceipt();
    checkoutMessage.textContent = 'Payment confirmed. You can now print the receipt.';
}

function saveCurrentOrder() {
    if (!currentOrder) return;
    localStorage.setItem(STORAGE_CURRENT_ORDER, JSON.stringify(currentOrder));
}

function saveOrderHistory(orderData) {
    let history = getOrderHistory();
    if (!Array.isArray(history)) {
        history = history ? [history] : [];
    }

    // If history is empty, ensure the incoming order uses orderNumber 1
    if (history.length === 0) {
        orderData.orderNumber = 1;
        saveCurrentOrder();
    }

    const duplicate = history.some(entry => Number(entry.orderNumber) === Number(orderData.orderNumber));
    if (duplicate) {
        const nextNumber = history.reduce((max, entry) => Math.max(max, Number(entry.orderNumber) || 0), 0) + 1;
        orderData.orderNumber = nextNumber;
        saveCurrentOrder();
    }

    history.push(orderData);
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
    localStorage.setItem('recent_order', JSON.stringify(orderData));

    // Notify other open pages/tabs about the new order so they can update instantly.
    try {
        // Trigger storage event listeners in other tabs/windows by setting a timestamp key
        localStorage.setItem('orderHistory_updated', new Date().toISOString());
    } catch (e) {
        // ignore
    }

    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const bc = new BroadcastChannel('food-order-channel');
            bc.postMessage({ type: 'new-order', order: orderData });
            bc.close();
        } catch (err) {
            // ignore
        }
    }
}


function updateOrderInHistory(orderData) {
    const history = getOrderHistory();
    const idx = history.findIndex(h => Number(h.orderNumber) === Number(orderData.orderNumber));
    if (idx !== -1) {
        history[idx] = orderData;
        localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));

        try { localStorage.setItem('orderHistory_updated', new Date().toISOString()); } catch (e) {}

        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const bc = new BroadcastChannel('food-order-channel');
                bc.postMessage({ type: 'updated-order', order: orderData });
                bc.close();
            } catch (err) {}
        }
    }
}
function getOrderHistory() {
    const historyJson = localStorage.getItem(STORAGE_HISTORY);
    if (!historyJson) return [];

    try {
        const parsed = JSON.parse(historyJson);
        return Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    } catch (e) {
        return [];
    }
}

function formatChange(orderData) {
    if (orderData.paymentStatus === 'UNPAID') {
        return 'Insufficient Payment';
    }

    if (orderData.cashReceived === orderData.totalAmount) {
        return 'No Change';
    }

    return `₱${orderData.change.toFixed(2)}`;
}

function changeStatusLabel(orderData) {
    const s = orderData.changeStatus;
    if (s === 'GIVEN') return 'GIVEN';
    if (s === 'NOT_YET_GIVEN') return 'NOT YET GIVEN';
    if (s === 'NO_CHANGE_NEEDED') return 'No Change Needed';
    return '-';
}

function markChangeGiven() {
    if (!currentOrder) return;
    if (!currentOrder.change || currentOrder.change === 0) return;
    currentOrder.changeStatus = 'GIVEN';
    saveCurrentOrder();
    updateOrderInHistory(currentOrder);
    renderReceipt();
    checkoutMessage.textContent = 'Change marked as GIVEN.';
}

function printReceipt() {
    window.print();
}

initializeCheckout();
