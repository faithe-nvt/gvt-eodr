-- Fix: allow VPs to update send_status on their own submissions
-- Run this in Supabase SQL Editor

drop policy if exists "submissions_update" on public.eodr_submissions;

create policy "submissions_update" on public.eodr_submissions for update using (
  vp_user_id = auth.uid()
  or get_my_role() in ('csm', 'admin')
);
