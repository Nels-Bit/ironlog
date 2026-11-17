-- Private rollback snapshot. Original rows remain untouched.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE SCHEMA ironlog_exercise_backup_20261116;
REVOKE ALL ON SCHEMA ironlog_exercise_backup_20261116 FROM PUBLIC, anon, authenticated;
CREATE TABLE ironlog_exercise_backup_20261116.workouts AS TABLE public.workouts;
CREATE TABLE ironlog_exercise_backup_20261116.exercises AS TABLE public.exercises;
CREATE TABLE ironlog_exercise_backup_20261116.policies AS
  SELECT * FROM pg_policies WHERE schemaname='public' AND tablename IN ('workouts','exercises');
CREATE TABLE ironlog_exercise_backup_20261116.grants AS
  SELECT * FROM information_schema.table_privileges WHERE table_schema='public' AND table_name IN ('workouts','exercises');
ALTER TABLE ironlog_exercise_backup_20261116.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ironlog_exercise_backup_20261116.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE ironlog_exercise_backup_20261116.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ironlog_exercise_backup_20261116.grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA ironlog_exercise_backup_20261116 FROM PUBLIC, anon, authenticated;
