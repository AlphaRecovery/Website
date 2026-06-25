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
  if to_regrole('anon') is not null then
    revoke all on schema public from anon;
    revoke all on all tables in schema public from anon;
    alter default privileges in schema public revoke all on tables from anon;
  end if;

  if to_regrole('authenticated') is not null then
    revoke all on schema public from authenticated;
    revoke all on all tables in schema public from authenticated;
    alter default privileges in schema public revoke all on tables from authenticated;
  end if;

  foreach table_name in array protected_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists server_only_access on public.%I', table_name);
      execute format(
        'create policy server_only_access on public.%I for all to public using (current_user not in (''anon'', ''authenticated'')) with check (current_user not in (''anon'', ''authenticated''))',
        table_name
      );
    end if;
  end loop;
end $$;
