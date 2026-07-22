-- Atomic checkout for pos.html.
--
-- Fixes two related bugs found in processCheckout():
--   1. Stock race condition: stock was decremented client-side using a
--      stale in-memory snapshot (item.stock_quantity read at page load),
--      not the live value at checkout time. Concurrent sales could silently
--      overwrite each other's stock deduction.
--   2. Non-atomic checkout: sale insert(s), debtor insert, and stock updates
--      were separate sequential calls with no rollback if one failed
--      partway through, risking half-completed sales.
--
-- This function moves the entire checkout operation into one Postgres
-- transaction. SELECT ... FOR UPDATE on each product row is what actually
-- closes the race condition: a concurrent checkout on the same product
-- blocks until this transaction commits or rolls back, so two overlapping
-- sales can never both succeed against stock that isn't there.
--
-- Also re-validates branch authorization and shift status server-side
-- rather than trusting client-supplied values, consistent with the fix
-- already applied to handle_new_user().

CREATE OR REPLACE FUNCTION public.process_checkout(
    p_branch_id uuid,
    p_shift_id uuid,
    p_payment_method text,
    p_cart jsonb,
    p_split_cash numeric DEFAULT NULL,
    p_customer_name text DEFAULT NULL,
    p_customer_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_caller_id uuid := auth.uid();
    v_caller_role text;
    v_caller_branch uuid;
    v_shift_ok boolean;
    v_item jsonb;
    v_product_id uuid;
    v_qty int;
    v_name text;
    v_selling_price numeric;
    v_cost_price numeric;
    v_part_type text;
    v_category text;
    v_stock int;
    v_total numeric := 0;
    v_cash numeric;
    v_paybill numeric;
    v_item_total numeric;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT role, branch_id INTO v_caller_role, v_caller_branch
    FROM public.profiles WHERE id = v_caller_id;

    IF v_caller_role IS NULL THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;

    IF v_caller_role <> 'admin' AND v_caller_branch IS DISTINCT FROM p_branch_id THEN
        RAISE EXCEPTION 'You are not authorized to sell for this branch';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.daily_shifts
        WHERE id = p_shift_id AND branch_id = p_branch_id AND status = 'Open'
    ) INTO v_shift_ok;

    IF NOT v_shift_ok THEN
        RAISE EXCEPTION 'No active shift found for this branch';
    END IF;

    IF p_cart IS NULL OR jsonb_array_length(p_cart) = 0 THEN
        RAISE EXCEPTION 'Cart is empty';
    END IF;

    IF p_payment_method = 'Debt' AND (p_customer_name IS NULL OR trim(p_customer_name) = '') THEN
        RAISE EXCEPTION 'Customer name is required for credit sales';
    END IF;

    -- Pass 1: compute the authoritative total from current prices (never
    -- trust a client-supplied total).
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart)
    LOOP
        SELECT selling_price INTO v_selling_price
        FROM public.products
        WHERE id = (v_item->>'product_id')::uuid AND branch_id = p_branch_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product not found: %', v_item->>'product_id';
        END IF;

        v_total := v_total + (v_selling_price * (v_item->>'quantity')::numeric);
    END LOOP;

    IF p_payment_method = 'Split' THEN
        IF p_split_cash IS NULL OR p_split_cash <= 0 OR p_split_cash >= v_total THEN
            RAISE EXCEPTION 'Invalid split amount: cash must be between 0 and %', v_total;
        END IF;
        v_cash := p_split_cash;
        v_paybill := v_total - p_split_cash;
    END IF;

    -- Pass 2: lock each product row, validate live stock, decrement, and
    -- record the sale. Any failure here rolls back everything above too.
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_qty := (v_item->>'quantity')::int;

        SELECT name, selling_price, cost_price, part_type, category, stock_quantity
        INTO v_name, v_selling_price, v_cost_price, v_part_type, v_category, v_stock
        FROM public.products
        WHERE id = v_product_id AND branch_id = p_branch_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product not found: %', v_product_id;
        END IF;

        IF v_stock < v_qty THEN
            RAISE EXCEPTION 'Insufficient stock for %: only % left', v_name, v_stock;
        END IF;

        UPDATE public.products
        SET stock_quantity = stock_quantity - v_qty
        WHERE id = v_product_id;

        v_item_total := v_selling_price * v_qty;

        IF p_payment_method = 'Split' THEN
            INSERT INTO public.sales (product_id, item_name, part_type, quantity, unit_price, total_amount, payment_method, cost_price, shift_id, category, branch_id, user_id, discount_reason)
            VALUES (v_product_id, v_name || ' (Split-Cash)', v_part_type, v_qty, v_selling_price, v_item_total * (v_cash / v_total), 'Cash', v_cost_price, p_shift_id, v_category, p_branch_id, v_caller_id, 'Split payment - Cash portion');

            INSERT INTO public.sales (product_id, item_name, part_type, quantity, unit_price, total_amount, payment_method, cost_price, shift_id, category, branch_id, user_id, discount_reason)
            VALUES (v_product_id, v_name || ' (Split-Paybill)', v_part_type, 0, 0, v_item_total * (v_paybill / v_total), 'KCB Paybill', v_cost_price, p_shift_id, v_category, p_branch_id, v_caller_id, 'Split payment - Paybill portion');
        ELSE
            INSERT INTO public.sales (product_id, item_name, part_type, quantity, unit_price, total_amount, payment_method, cost_price, shift_id, category, branch_id, user_id)
            VALUES (v_product_id, v_name, v_part_type, v_qty, v_selling_price, v_item_total, p_payment_method, v_cost_price, p_shift_id, v_category, p_branch_id, v_caller_id);
        END IF;

        IF p_payment_method = 'Debt' THEN
            INSERT INTO public.debtors (customer_name, customer_phone, product_id, amount_owed, branch_id, status)
            VALUES (p_customer_name, NULLIF(p_customer_phone, ''), v_product_id, v_item_total, p_branch_id, 'Unpaid');
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'total', v_total);
END;
$function$;
