create extension if not exists pgcrypto;

create table if not exists portal_app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
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
  created_at timestamptz not null default now()
);

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('admin','recruiter','contractor','applicant')),
  token_hash text not null,
  invited_by uuid references users(id),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  ip_address text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('individual','private investigation firm','security company','social service organization','interpreter organization','other')),
  status text not null default 'pending_review' check (status in ('active','inactive','pending_review')),
  point_of_contact text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists contractors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  company_id uuid references companies(id),
  full_name text not null,
  role text,
  phone text,
  location text,
  onboard_date date,
  status text not null default 'pending' check (status in ('pending','active','inactive','suspended')),
  created_at timestamptz not null default now()
);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  company_id uuid references companies(id),
  full_name text not null,
  email text not null,
  phone text,
  role_applied text,
  experience text,
  message text,
  status text not null default 'submitted' check (status in ('submitted','received','review','interview','approved','rejected','onboarding')),
  assigned_recruiter_id uuid references users(id),
  created_at timestamptz not null default now()
);

create table if not exists application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  author_id uuid references users(id),
  note text not null,
  visibility text not null default 'internal' check (visibility in ('internal','admin_only')),
  created_at timestamptz not null default now()
);

create table if not exists employment_application_drafts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role_slug text not null,
  section integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (email, role_slug)
);

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
  status text not null default 'New' check (status in ('New','Under Review','Interview Scheduled','Offer Extended','Hired','Rejected')),
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
  delivery text not null default 'email',
  email_to text,
  email_cc text,
  uploaded_files jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, role_slug)
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references users(id),
  contractor_id uuid references contractors(id),
  company_id uuid references companies(id),
  application_id uuid references applications(id),
  requested_by uuid references users(id),
  name text not null,
  type text not null check (type in ('resume','w9','nda','training_certificate','license','insurance','background_check','id','other')),
  file_path text,
  status text not null default 'requested' check (status in ('requested','pending','uploaded','signed','cleared','rejected','expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  assigned_to uuid references users(id),
  assigned_by uuid references users(id),
  related_application_id uuid references applications(id),
  related_contractor_id uuid references contractors(id),
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open','in_progress','complete','blocked')),
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references users(id),
  recipient_id uuid references users(id),
  related_application_id uuid references applications(id),
  related_contractor_id uuid references contractors(id),
  subject text,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  action text not null check (action in (
    'login','logout','failed_login','file_upload','file_download','status_change',
    'invite_sent','invite_accepted','profile_change','document_requested',
    'document_status_change','task_created','task_completed','message_sent',
    'note_added','company_created','contractor_deactivated','application_submitted'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sessions_token_hash_idx on sessions(token_hash);
create index if not exists users_email_idx on users(lower(email));
create index if not exists applications_recruiter_idx on applications(assigned_recruiter_id);
create index if not exists employment_applications_submitted_idx on employment_applications(submitted_at desc);
create index if not exists employment_applications_status_idx on employment_applications(status);
create index if not exists employment_application_submissions_submitted_idx on employment_application_submissions(submitted_at desc);
create index if not exists employment_application_drafts_email_idx on employment_application_drafts(lower(email));
create index if not exists documents_owner_idx on documents(owner_user_id);
create index if not exists tasks_assigned_to_idx on tasks(assigned_to);
create index if not exists messages_recipient_idx on messages(recipient_id);
create index if not exists activity_log_created_idx on activity_log(created_at desc);
