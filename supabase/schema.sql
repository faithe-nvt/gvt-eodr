-- GVT EODR Database Schema
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor > New query)

-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Profiles ─────────────────────────────────────────────────────────────────
-- Extends Supabase Auth users with role and GVT-specific fields
create table public.profiles (
  id             uuid references auth.users(id) on delete cascade primary key,
  full_name      text not null,
  email          text not null,
  role           text not null default 'vp' check (role in ('vp', 'csm', 'admin')),
  csm_user_id    uuid references public.profiles(id),  -- VP's assigned CSM
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Trusted Client Emails ────────────────────────────────────────────────────
create table public.trusted_client_emails (
  id              uuid default uuid_generate_v4() primary key,
  vp_user_id      uuid not null references public.profiles(id) on delete cascade,
  client_name     text not null,
  trusted_email   text not null,
  csm_user_id     uuid references public.profiles(id),
  set_by_user_id  uuid references public.profiles(id),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (vp_user_id, client_name)
);

-- ─── EODR Submissions ─────────────────────────────────────────────────────────
create table public.eodr_submissions (
  id                          uuid default uuid_generate_v4() primary key,
  vp_user_id                  uuid not null references public.profiles(id) on delete cascade,
  client_name                 text not null,
  client_email_entered        text not null,
  trusted_email_at_submission text,
  email_match_status          text not null default 'no_trusted_email_on_file'
                                check (email_match_status in (
                                  'match',
                                  'flagged_typo',
                                  'flagged_different_recipient',
                                  'flagged_new_domain',
                                  'no_trusted_email_on_file'
                                )),
  form_data                   jsonb not null,
  ai_grade                    integer,
  ai_feedback                 jsonb,
  email_subject               text,
  email_html                  text,
  email_plain_text            text,
  send_to_csm                 boolean not null default true,
  send_status                 text not null default 'pending_verification'
                                check (send_status in (
                                  'pending_verification',
                                  'sent',
                                  'failed',
                                  'cancelled'
                                )),
  sent_at                     timestamptz,
  created_at                  timestamptz not null default now()
);

-- ─── Email Send Log ───────────────────────────────────────────────────────────
create table public.email_send_log (
  id                  uuid default uuid_generate_v4() primary key,
  submission_id       uuid not null references public.eodr_submissions(id) on delete cascade,
  recipient_email     text not null,
  recipient_type      text not null check (recipient_type in ('client', 'csm_bcc', 'vp_test')),
  resend_message_id   text,
  status              text not null default 'sent' check (status in ('sent', 'bounced', 'failed')),
  timestamp           timestamptz not null default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.profiles           enable row level security;
alter table public.trusted_client_emails enable row level security;
alter table public.eodr_submissions   enable row level security;
alter table public.email_send_log     enable row level security;

-- Helper: get current user's role
create or replace function public.get_my_role()
returns text language sql security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Helper: get current user's CSM id
create or replace function public.get_my_csm_id()
returns uuid language sql security definer set search_path = public as $$
  select csm_user_id from public.profiles where id = auth.uid();
$$;

-- profiles: users can read their own; admins can read all
create policy "profiles_select" on public.profiles for select using (
  id = auth.uid() or get_my_role() in ('csm', 'admin')
);
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid());

-- trusted_client_emails: VPs see none; CSMs see their clients; admins see all
create policy "trusted_emails_select" on public.trusted_client_emails for select using (
  get_my_role() = 'admin'
  or (get_my_role() = 'csm' and csm_user_id = auth.uid())
);
create policy "trusted_emails_insert" on public.trusted_client_emails for insert with check (
  get_my_role() in ('csm', 'admin')
);
create policy "trusted_emails_update" on public.trusted_client_emails for update using (
  get_my_role() in ('csm', 'admin')
);

-- eodr_submissions: VPs see own; CSMs see their clients'; admins see all
create policy "submissions_select_vp" on public.eodr_submissions for select using (
  vp_user_id = auth.uid()
  or get_my_role() = 'admin'
  or (
    get_my_role() = 'csm'
    and vp_user_id in (
      select id from public.profiles where csm_user_id = auth.uid()
    )
  )
);
create policy "submissions_insert" on public.eodr_submissions for insert with check (
  vp_user_id = auth.uid()
);
create policy "submissions_update" on public.eodr_submissions for update using (
  get_my_role() in ('csm', 'admin')
);

-- email_send_log: admins + csms only
create policy "send_log_select" on public.email_send_log for select using (
  get_my_role() in ('csm', 'admin')
);
create policy "send_log_insert" on public.email_send_log for insert with check (true);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index on public.eodr_submissions (vp_user_id, created_at desc);
create index on public.eodr_submissions (send_status);
create index on public.eodr_submissions (created_at desc);
create index on public.trusted_client_emails (vp_user_id, client_name);
create index on public.email_send_log (submission_id);
