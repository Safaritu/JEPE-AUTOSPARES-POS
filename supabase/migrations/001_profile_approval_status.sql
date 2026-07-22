-- Adds an admin-approval gate for new user signups.
--
-- Background: handle_new_user() previously trusted `role` directly from
-- auth.users.raw_user_meta_data, which is fully client-controlled at signup
-- time. Any caller of the public signup endpoint (not just the HTML form)
-- could set role='admin' and be inserted as a full admin with no checks.
--
-- This migration:
--   1. Adds a `status` column to profiles ('pending' | 'approved' | 'rejected'),
--      backfilling every existing row as 'approved' so current staff are
--      completely unaffected.
--   2. Rewrites handle_new_user() so self-signup can only ever create
--      role='cashier', status='pending' — role is never trusted from client
--      metadata again. Promotion to admin now only happens via an existing
--      admin, through the app's User Approvals page.
--   3. Adds an is_admin() SECURITY DEFINER helper (mirrors the existing
--      get_user_branch_id() pattern) and an RLS policy so admins can update
--      other users' profiles (needed for approve/reject/promote).
--
-- Run this in the Supabase SQL Editor. Steps are ordered so it's safe to run
-- top to bottom in one go.

-- 1. New status column + backfill + allowed-values constraint
ALTER TABLE public.profiles ADD COLUMN status text NOT NULL DEFAULT 'pending';
UPDATE public.profiles SET status = 'approved';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'));

-- 2. handle_new_user(): role is now always 'cashier', status always 'pending'
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    default_branch uuid;
BEGIN
    -- Get first active branch
    SELECT id INTO default_branch
    FROM public.branches
    WHERE is_active = true
    LIMIT 1;

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        branch_id,
        status,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,

        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            split_part(NEW.email, '@', 1)
        ),

        'cashier',

        COALESCE(
            NULLIF(
                NEW.raw_user_meta_data->>'branch_id',
                ''
            )::uuid,
            default_branch
        ),

        'pending',

        NOW()
    );

    RETURN NEW;

EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Error creating profile for user %: %',
        NEW.email,
        SQLERRM;

        RETURN NEW;
END;
$function$;

-- 3. Admin update access for approve/reject/promote.
-- is_admin() is SECURITY DEFINER specifically to avoid recursive-RLS issues
-- that come from a profiles policy querying profiles directly.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin' AND status = 'approved'
    );
END;
$$;

-- NOTE: if this errors with "policy already exists" or conflicts with an
-- existing policy on profiles, that means there's already RLS configured
-- here that this migration doesn't know about — stop and share the existing
-- policy list before re-running.
CREATE POLICY "Admins can update any profile"
    ON public.profiles FOR UPDATE
    USING (public.is_admin());
