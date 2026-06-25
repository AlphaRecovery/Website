do $$
declare
  table_name text;
  protected_tables text[] := array[
    'portal_app_state',
    'portal_sessions',
    'users',
    'invites',
    'sessions',
    'password_reset_tokens',
    'companies',
    'contractors',
    'applications',
    'application_notes',
    'employment_application_drafts',
    'employment_applications',
    'employment_application_submissions',
    'employment_application_files',
    'application_drafts',
    'documents',
    'tasks',
    'messages',
    'activity_log',
    'orphaned_storage_objects'
  ];
begin
  foreach table_name in array protected_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop policy if exists server_only_access on public.%I', table_name);
      execute format('alter table public.%I disable row level security', table_name);
    end if;
  end loop;
end $$;
