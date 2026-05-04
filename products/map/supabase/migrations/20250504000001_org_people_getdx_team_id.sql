ALTER TABLE activity.organization_people
  ADD COLUMN getdx_team_id TEXT
  REFERENCES activity.getdx_teams(getdx_team_id) ON DELETE SET NULL;

CREATE INDEX idx_org_people_getdx_team
  ON activity.organization_people(getdx_team_id);
