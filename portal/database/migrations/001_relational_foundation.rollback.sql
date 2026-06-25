drop table if exists orphaned_storage_objects;
drop table if exists application_drafts;
drop table if exists employment_application_files;

drop index if exists employment_applications_user_role_uidx;
drop index if exists employment_applications_assigned_recruiter_idx;
drop index if exists employment_applications_notification_status_idx;

alter table employment_application_submissions drop column if exists email_error_code;
alter table employment_application_submissions drop column if exists email_status;
alter table employment_application_submissions drop column if exists employment_application_id;

alter table employment_applications drop column if exists updated_at;
alter table employment_applications drop column if exists purged_at;
alter table employment_applications drop column if exists withdrawn_at;
alter table employment_applications drop column if exists rejected_at;
alter table employment_applications drop column if exists notification_error_code;
alter table employment_applications drop column if exists notification_status;
alter table employment_applications drop column if exists confirmation_number;
alter table employment_applications drop column if exists assigned_at;
alter table employment_applications drop column if exists assigned_recruiter_id;
