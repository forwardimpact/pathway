UPDATE activity.evidence SET rationale = 'synthetic' WHERE rationale IS NULL;
UPDATE activity.evidence SET level_id = 'working' WHERE level_id IS NULL;

ALTER TABLE activity.evidence ALTER COLUMN rationale SET NOT NULL;
ALTER TABLE activity.evidence ALTER COLUMN level_id SET NOT NULL;
