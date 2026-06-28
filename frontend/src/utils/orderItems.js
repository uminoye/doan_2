/**
 * Format order items for display as a string
 */
export function formatOrderItems(order) {
    if (!order) return '';
    const items = Array.isArray(order.items) ? order.items : [];
    if (!items.length) return '(Không có sản phẩm)';
    return items
        .map(
            (item, idx) =>
                `  ${idx + 1}. ${item.product_name || item.name || 'Sản phẩm'} x${item.quantity}${item.unit ? ` (${item.unit})` : ''}${item.unit_price ? ` - ${Number(item.unit_price).toLocaleString('vi-VN')}đ` : ''}`
        )
        .join('\n');
}

/**
 * Normalize order items from API response to a consistent format
 */
export function normalizeOrderItems(order) {
    if (!order) return [];
    if (Array.isArray(order)) return order;
    if (Array.isArray(order.items)) return order.items;
    if (Array.isArray(order.products)) return order.products;
    return [];
}
