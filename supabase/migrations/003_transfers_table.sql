-- Dedicated ledger for internal money transfers (any wallet -> any wallet),
-- to replace inferring "this was a transfer" from a pair of cash_transactions
-- rows matched by description text (fragile: any row whose description
-- happened to contain "transfer" was picked up, and there was nothing
-- linking the two legs together).
--
-- Also fixes a real production bug: money transfer.html previously ran two
-- independent .insert() calls (Money Out from source, then Money In to
-- destination) with no rollback if the second failed partway through - the
-- same class of bug 002_atomic_checkout.sql already fixed for checkout.
-- process_transfer() below moves the whole operation into one transaction.
--
-- cash_transactions keeps getting both legs written automatically (via
-- transfer_id, so they stay traceable back to the transfers row) because
-- cashier.html's shift totals, admin.html's balance calc, shift-history.html
-- etc. already sum cash_transactions directly and must keep working
-- unchanged.

CREATE TABLE public.transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id uuid NOT NULL REFERENCES public.branches(id),
    shift_id uuid REFERENCES public.daily_shifts(id),
    user_id uuid NOT NULL REFERENCES auth.users(id),
    from_category text NOT NULL,
    to_category text NOT NULL,
    amount numeric NOT NULL CHECK (amount > 0),
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (from_category <> to_category)
);

ALTER TABLE public.cash_transactions ADD COLUMN transfer_id uuid REFERENCES public.transfers(id);

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- Reads go through normal RLS (branch-scoped for cashiers, everything for
-- admins); writes only ever happen inside process_transfer() below, which
-- runs SECURITY DEFINER and does its own authorization - so there is
-- deliberately no direct INSERT/UPDATE/DELETE policy for any role.
CREATE POLICY "View transfers for own branch or all if admin"
    ON public.transfers FOR SELECT
    USING (public.is_admin() OR branch_id = public.get_user_branch_id());

CREATE OR REPLACE FUNCTION public.process_transfer(
    p_branch_id uuid,
    p_shift_id uuid,
    p_from_category text,
    p_to_category text,
    p_amount numeric,
    p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_caller_id uuid := auth.uid();
    v_caller_role text;
    v_caller_branch uuid;
    v_transfer_id uuid;
    v_note text;
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
        RAISE EXCEPTION 'You are not authorized to transfer for this branch';
    END IF;

    IF v_caller_role <> 'admin' AND p_from_category = 'KCB Paybill' THEN
        RAISE EXCEPTION 'Only admins can transfer out of KCB Paybill';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Invalid transfer amount';
    END IF;

    IF p_from_category = p_to_category THEN
        RAISE EXCEPTION 'Cannot transfer to the same account';
    END IF;

    v_note := NULLIF(trim(p_description), '');

    INSERT INTO public.transfers (branch_id, shift_id, user_id, from_category, to_category, amount, description)
    VALUES (p_branch_id, p_shift_id, v_caller_id, p_from_category, p_to_category, p_amount, v_note)
    RETURNING id INTO v_transfer_id;

    INSERT INTO public.cash_transactions (type, category, amount, description, branch_id, user_id, shift_id, transfer_id)
    VALUES (
        'Money Out', p_from_category, p_amount,
        'Transfer to ' || p_to_category || CASE WHEN v_note IS NOT NULL THEN ': ' || v_note ELSE '' END,
        p_branch_id, v_caller_id, p_shift_id, v_transfer_id
    );

    INSERT INTO public.cash_transactions (type, category, amount, description, branch_id, user_id, shift_id, transfer_id)
    VALUES (
        'Money In', p_to_category, p_amount,
        'Transfer from ' || p_from_category || CASE WHEN v_note IS NOT NULL THEN ': ' || v_note ELSE '' END,
        p_branch_id, v_caller_id, p_shift_id, v_transfer_id
    );

    RETURN jsonb_build_object('success', true, 'transfer_id', v_transfer_id);
END;
$function$;
