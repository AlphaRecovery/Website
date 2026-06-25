create extension if not exists pgcrypto;

create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin','recruiter','contractor','applicant')),
  full_name text not null,
  phone text,
  location text,
  status text not null default 'active' check (status in ('active','disabled','pending')),
  force_password_change boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  ip_address inet,
  user_agent text,
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  actor_user_id uuid references users(id),
  target_user_id uuid references users(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table activity_log drop constraint if exists activity_log_action_check;
alter table activity_log add constraint activity_log_action_check check (action in (
  'login','logout','failed_login','file_upload','file_view','file_download','file_access_denied',
  'status_change','invite_sent','invite_accepted','profile_change','document_requested',
  'document_status_change','application_created','application_deleted','task_created','task_completed',
  'message_sent','note_added','company_created','contractor_deactivated','application_submitted',
  'application_assigned','notification_failed','pii_purged','file_delete_missing','library_template_created',
  'library_template_updated','library_template_deleted','interview_scheduled','interview_cancelled',
  'interview_completed','interview_updated','interview_confirmed'
));

create table if not exists employment_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  role_slug text not null,
  role_title text not null,
  department text not null,
  location text,
  employment_type text,
  full_name text not null,
  email text not null,
  phone text,
  status text not null default 'New',
  score integer not null default 0,
  score_breakdown jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  files jsonb not null default '[]'::jsonb,
  hr_notes text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists employment_application_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  email text not null,
  role_slug text not null,
  role_title text not null,
  department text,
  location text,
  employment_type text,
  full_name text,
  confirmation_number text not null unique,
  delivery text not null default 'portal',
  email_to text,
  email_cc text,
  uploaded_files jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table employment_applications add column if not exists assigned_recruiter_id uuid references users(id);
alter table employment_applications add column if not exists assigned_at timestamptz;
alter table employment_applications add column if not exists confirmation_number text;
alter table employment_applications add column if not exists notification_status text not null default 'pending';
alter table employment_applications add column if not exists notification_error_code text;
alter table employment_applications add column if not exists rejected_at timestamptz;
alter table employment_applications add column if not exists withdrawn_at timestamptz;
alter table employment_applications add column if not exists purged_at timestamptz;
alter table employment_applications add column if not exists updated_at timestamptz;

alter table employment_application_submissions add column if not exists employment_application_id uuid references employment_applications(id) on delete cascade;
alter table employment_application_submissions add column if not exists email_status text not null default 'pending';
alter table employment_application_submissions add column if not exists email_error_code text;

create table if not exists employment_application_files (
  id uuid primary key default gen_random_uuid(),
  employment_application_id uuid not null references employment_applications(id) on delete cascade,
  field text not null,
  label text not null,
  original_name text not null,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  storage_bucket text not null,
  storage_key text not null,
  storage_status text not null default 'pending' check (storage_status in ('pending','active','delete_failed','deleted')),
  sha256 text,
  uploaded_at timestamptz not null default now(),
  activated_at timestamptz,
  deleted_at timestamptz,
  delete_error_code text,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_key)
);

create table if not exists application_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  email text not null,
  role_slug text not null,
  role_title text,
  department text,
  section integer not null default 1 check (section between 1 and 16),
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, role_slug)
);

create table if not exists orphaned_storage_objects (
  id uuid primary key default gen_random_uuid(),
  storage_bucket text not null,
  storage_key text not null,
  reason text not null,
  error_code text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_key)
);

create unique index if not exists employment_applications_user_role_uidx on employment_applications(user_id, role_slug) where user_id is not null;
create index if not exists employment_applications_assigned_recruiter_idx on employment_applications(assigned_recruiter_id);
create index if not exists employment_applications_notification_status_idx on employment_applications(notification_status);
create index if not exists employment_application_files_application_idx on employment_application_files(employment_application_id);
create index if not exists employment_application_files_status_idx on employment_application_files(storage_status);
create index if not exists application_drafts_expires_idx on application_drafts(expires_at);
create index if not exists sessions_expires_idx on sessions(expires_at);
create index if not exists sessions_user_idx on sessions(user_id);
create index if not exists activity_log_entity_idx on activity_log(entity_type, entity_id);
