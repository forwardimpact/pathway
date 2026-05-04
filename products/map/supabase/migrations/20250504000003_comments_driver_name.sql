-- Spec 800: Capture driver_name on snapshot comments
--
-- The real GetDX snapshots.driverComments.list endpoint returns a driver_name
-- field per comment that the current schema does not capture. Add a nullable
-- column so the transform can preserve it when present (older comments and
-- non-driver comments leave it null).

alter table activity.getdx_snapshot_comments
  add column if not exists driver_name text;
