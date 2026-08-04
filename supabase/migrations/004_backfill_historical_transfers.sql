-- One-time data correction + backfill, run manually in the SQL Editor.
-- NOT auto-applied like 001-003 - review each part before running.

-- ============================================================
-- PART 1: Fix a specific mislabeled row.
-- 7c27acfd-7038-48ad-a115-22acee01636d (3 Aug 2026, Mutomo, Ksh 126,000,
-- "To kcb sales account, -Bike") was an internal transfer INTO KCB Paybill
-- via cashier.html's Money IN/OUT card, but got recorded as Money Out
-- because that card's direction dropdown defaulted to "Money Out" before
-- the fix in this same branch. Confirmed with the shop owner before running.
-- ============================================================
UPDATE public.cash_transactions
SET type = 'Money In'
WHERE id = '7c27acfd-7038-48ad-a115-22acee01636d';


-- ============================================================
-- PART 2 (PREVIEW FIRST): Backfill transfers rows for historical pairs.
--
-- Run this SELECT first and eyeball the row count / amounts before running
-- the INSERT+UPDATE below it. Only matches pairs where BOTH legs still carry
-- the exact "Transfer to "/"Transfer from " description template the old
-- money transfer.html always wrote, with an identical timestamp between the
-- two legs (that code inserted both from the same `now` variable) - single-
-- sided Money IN/OUT card entries (different, free-text descriptions) will
-- never match this and are left untouched.
-- ============================================================
SELECT o.id AS money_out_id, i.id AS money_in_id, o.branch_id, o.amount,
       o.category AS from_category, i.category AS to_category, o.created_at
FROM public.cash_transactions o
JOIN public.cash_transactions i
  ON i.type = 'Money In'
 AND i.amount = o.amount
 AND i.branch_id = o.branch_id
 AND i.created_at = o.created_at
 AND i.id <> o.id
WHERE o.type = 'Money Out'
  AND o.transfer_id IS NULL
  AND i.transfer_id IS NULL
  AND o.description LIKE 'Transfer to %'
  AND i.description LIKE 'Transfer from %'
ORDER BY o.created_at DESC;


-- ============================================================
-- PART 3: Once Part 2's preview looks right, run this to actually backfill.
-- Creates one transfers row per matched pair and links both legs to it via
-- transfer_id, so they show up in money transfer.html's Transfer History.
-- ============================================================
WITH pairs AS (
    SELECT
        o.id AS out_id, i.id AS in_id,
        o.branch_id, o.shift_id, o.user_id,
        o.category AS from_category, i.category AS to_category,
        o.amount, o.created_at,
        NULLIF(regexp_replace(o.description, '^Transfer to [^:]+:\s*', ''), '') AS description
    FROM public.cash_transactions o
    JOIN public.cash_transactions i
      ON i.type = 'Money In'
     AND i.amount = o.amount
     AND i.branch_id = o.branch_id
     AND i.created_at = o.created_at
     AND i.id <> o.id
    WHERE o.type = 'Money Out'
      AND o.transfer_id IS NULL
      AND i.transfer_id IS NULL
      AND o.description LIKE 'Transfer to %'
      AND i.description LIKE 'Transfer from %'
),
inserted AS (
    INSERT INTO public.transfers (branch_id, shift_id, user_id, from_category, to_category, amount, description, created_at)
    SELECT branch_id, shift_id, user_id, from_category, to_category, amount, description, created_at
    FROM pairs
    RETURNING id AS transfer_id, branch_id, shift_id, amount, created_at, from_category, to_category
)
UPDATE public.cash_transactions ct
SET transfer_id = ins.transfer_id
FROM inserted ins, pairs p
WHERE p.branch_id = ins.branch_id
  AND p.shift_id IS NOT DISTINCT FROM ins.shift_id
  AND p.amount = ins.amount
  AND p.created_at = ins.created_at
  AND p.from_category = ins.from_category
  AND p.to_category = ins.to_category
  AND ct.id IN (p.out_id, p.in_id);


-- ============================================================
-- PART 4: Row C - 0742b1fa-02ab-4c6e-ab7f-8e6bfc8f89e9 (3 Jul 2026, Mutomo,
-- Ksh 100,000, "To kcb sales Account-bike"). Confirmed with the shop owner:
-- this was motorbike-sale cash transferred into KCB Paybill. Only the Money
-- Out (Cash) leg was ever recorded via the old single-sided Money IN/OUT
-- card - the Money In (Paybill) leg was never created at all, unlike Row A
-- above which existed but had the wrong direction. This creates the missing
-- leg and a transfers row linking both, rather than just flipping a flag.
-- ============================================================
BEGIN;

INSERT INTO public.transfers (branch_id, shift_id, user_id, from_category, to_category, amount, description, created_at)
VALUES (
    '5326e4c6-6d0d-4500-83d9-f322c859b9fb',
    'cb9a27f1-b9db-4418-a986-9795570b0ada',
    '069e27cd-c745-470b-8b8e-2a8b41757069',
    'Cash', 'KCB Paybill', 100000,
    'Motorbike sale proceeds transferred to Paybill',
    '2026-07-03 17:44:59.790968+03'
);

UPDATE public.cash_transactions
SET transfer_id = (
    SELECT id FROM public.transfers
    WHERE amount = 100000 AND from_category = 'Cash' AND to_category = 'KCB Paybill'
      AND created_at = '2026-07-03 17:44:59.790968+03'
)
WHERE id = '0742b1fa-02ab-4c6e-ab7f-8e6bfc8f89e9';

INSERT INTO public.cash_transactions (type, category, amount, description, branch_id, user_id, shift_id, created_at, transfer_id)
SELECT
    'Money In', 'KCB Paybill', 100000,
    'Transfer from Cash: To kcb sales Account-bike',
    '5326e4c6-6d0d-4500-83d9-f322c859b9fb',
    '069e27cd-c745-470b-8b8e-2a8b41757069',
    'cb9a27f1-b9db-4418-a986-9795570b0ada',
    '2026-07-03 17:44:59.790968+03',
    id
FROM public.transfers
WHERE amount = 100000 AND from_category = 'Cash' AND to_category = 'KCB Paybill'
  AND created_at = '2026-07-03 17:44:59.790968+03';

COMMIT;
