do $$
begin
  if to_regclass('public.users') is not null then
    alter table users drop constraint if exists users_role_check;
    alter table users add constraint users_role_check
      check (role in ('admin','recruiter','hr','manager','read_only','contractor','applicant'));
  end if;

  if to_regclass('public.invites') is not null then
    alter table invites drop constraint if exists invites_role_check;
    alter table invites add constraint invites_role_check
      check (role in ('admin','recruiter','hr','manager','read_only','contractor','applicant'));
  end if;
end $$;
