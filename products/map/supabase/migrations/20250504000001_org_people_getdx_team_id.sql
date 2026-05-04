-- Spec 800: Person → GetDX team mapping
--
-- Add a single nullable foreign key column to organization_people so that
-- manager-scoped views (health --manager, snapshot trend --manager) can
-- resolve a manager's direct reports to GetDX team_ids without depending on
-- the broken getdx_teams.manager_email chain (which the GetDX teams.list API
-- never populates).
--
-- See specs/800-landmark-evidence-pipeline/design-a.md § Manager-scoping
-- query patterns.

alter table activity.organization_people
  add column if not exists getdx_team_id text
  references activity.getdx_teams(getdx_team_id) on delete set null;

create index if not exists idx_org_people_getdx_team
  on activity.organization_people(getdx_team_id);
