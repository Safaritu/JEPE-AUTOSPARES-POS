// gas-sale.js - shared gas cylinder sale recording, ported from
// cashiergashub.html's processSale() so cashier.html and pos.html can sell
// gas correctly (refill vs complete-new-cylinder, empty cylinder exchange)
// without duplicating or drifting from the logic that already works there.
// cashiergashub.html itself is untouched and does not use this module.

import { supabase } from './auth.js';

export async function loadGasItems(branchId) {
    const { data } = await supabase
        .from('products')
        .select('*')
        .eq('branch_id', branchId)
        .eq('category', 'Gas');
    return data || [];
}

// Minimum allowed price for a gas sale: refill compares against the
// product's own minimum (falling back to its normal selling price),
// complete sales compare against the complete-cylinder price itself.
export function gasMinAllowed(type, item) {
    return type === 'refill'
        ? (item.min_selling_price || item.selling_price)
        : (item.complete_price || 0);
}

// Records one gas sale end to end: the sales row(s), the outgoing stock
// decrement, the incoming empty-cylinder credit (refill only), and any
// debtor bookkeeping. Mirrors cashiergashub.html's processSale() exactly -
// same non-atomic sequence of calls it already uses in production, same
// split-payment zero-quantity-on-second-leg pattern, same field names.
// Callers are responsible for their own UI (spinners, min-price/discount
// prompts, debt-customer prompts) before calling this.
export async function recordGasSale({
    type,           // 'refill' | 'complete'
    outgoingItem,   // full products row for the item leaving the shop
    incomingId,     // product id to credit empty_quantity to (refill only);
                     // 'same'/null/outgoingItem.id all mean "same brand"
    qty,
    price,
    method,         // 'Cash' | 'KCB Paybill' | 'Split' | 'Debt'
    splitCash,      // cash portion when method === 'Split'
    discountReason,
    shiftId,
    branchId,
    userId,
    customerName,   // required when method === 'Debt'
    customerPhone
}) {
    const total = price * qty;

    let costPricePerUnit = 0;
    let itemName = '';
    if (type === 'refill') {
        costPricePerUnit = outgoingItem.cost_price || 0;
        itemName = `${outgoingItem.name} (${outgoingItem.weight_category}) REFILL`;
    } else {
        costPricePerUnit = outgoingItem.complete_cost || 0;
        itemName = `${outgoingItem.name} (${outgoingItem.weight_category}) NEW CYLINDER`;
    }

    let resolvedIncomingId = outgoingItem.id;
    if (type === 'refill' && incomingId && incomingId !== 'same' && incomingId !== outgoingItem.id) {
        resolvedIncomingId = incomingId;
    }

    if (method === 'Split') {
        const cashPart = splitCash || 0;
        const paybillPart = total - cashPart;

        if (cashPart <= 0 || cashPart >= total) {
            throw new Error('Invalid split amounts. Cash must be between 0 and total.');
        }

        const cashSaleRecord = {
            shift_id: shiftId,
            product_id: outgoingItem.id,
            item_name: `${itemName} (Split-Cash)`,
            quantity: qty,
            unit_price: price,
            total_amount: cashPart,
            amount: cashPart,
            cost_price: costPricePerUnit,
            discount_reason: discountReason,
            category: 'Gas',
            weight_category: outgoingItem.weight_category,
            branch_id: branchId,
            user_id: userId,
            payment_method: 'Cash'
        };

        const paybillSaleRecord = {
            shift_id: shiftId,
            product_id: outgoingItem.id,
            item_name: `${itemName} (Split-Paybill)`,
            quantity: 0,
            unit_price: price,
            total_amount: paybillPart,
            amount: paybillPart,
            cost_price: 0,
            discount_reason: discountReason,
            category: 'Gas',
            weight_category: outgoingItem.weight_category,
            branch_id: branchId,
            user_id: userId,
            payment_method: 'KCB Paybill'
        };

        const { error } = await supabase.from('sales').insert([cashSaleRecord, paybillSaleRecord]);
        if (error) throw error;
    } else {
        const saleRecord = {
            shift_id: shiftId,
            product_id: outgoingItem.id,
            item_name: itemName,
            quantity: qty,
            unit_price: price,
            total_amount: total,
            amount: total,
            cost_price: costPricePerUnit,
            discount_reason: discountReason,
            category: 'Gas',
            weight_category: outgoingItem.weight_category,
            branch_id: branchId,
            user_id: userId,
            payment_method: method
        };

        const { error } = await supabase.from('sales').insert([saleRecord]);
        if (error) throw error;
    }

    // Update Outgoing Stock
    await supabase.from('products')
        .update({ stock_quantity: outgoingItem.stock_quantity - qty })
        .eq('id', outgoingItem.id)
        .eq('branch_id', branchId);

    // Update Incoming Stock for refills
    if (type === 'refill') {
        const { data: incData } = await supabase
            .from('products')
            .select('empty_quantity')
            .eq('id', resolvedIncomingId)
            .eq('branch_id', branchId)
            .single();

        await supabase.from('products')
            .update({ empty_quantity: (incData?.empty_quantity || 0) + qty })
            .eq('id', resolvedIncomingId)
            .eq('branch_id', branchId);
    }

    // Debt handling
    if (method === 'Debt' && customerName) {
        const { data: existingDebt } = await supabase
            .from('debtors')
            .select('id, amount_owed')
            .eq('customer_name', customerName)
            .eq('product_id', outgoingItem.id)
            .eq('status', 'Unpaid')
            .eq('branch_id', branchId)
            .maybeSingle();

        if (existingDebt) {
            await supabase.from('debtors')
                .update({ amount_owed: existingDebt.amount_owed + total })
                .eq('id', existingDebt.id);
        } else {
            await supabase.from('debtors').insert([{
                customer_name: customerName,
                customer_phone: customerPhone || null,
                product_id: outgoingItem.id,
                amount_owed: total,
                branch_id: branchId,
                status: 'Unpaid'
            }]);
        }
    }

    return { total, itemName };
}
