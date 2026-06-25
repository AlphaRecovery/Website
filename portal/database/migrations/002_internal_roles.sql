alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('admin','recruiter','hr','manager','read_only','contractor','applicant'));

alter table invites drop constraint if exists invites_role_check;
alter table invites add constraint invites_role_check
  check (role in ('admin','recruiter','hr','manager','read_only','contractor','applicant'));
