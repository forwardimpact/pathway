-- Spec 800: Evidence required-field enforcement and idempotency key
--
-- Spec 800 § Evidence output contract requires every row to carry a non-null
-- rationale and level_id. The svcmap WriteEvidence boundary validates this
-- at the application layer; the NOT NULL constraints are the DB backstop so
-- that any future writer cannot bypass the contract.
--
-- WriteEvidence also relies on idempotency: re-running the same prompt must
-- not duplicate rows. Postgres enforces this only when a UNIQUE constraint
-- exists on the columns named in `ON CONFLICT`; without it the upsert call
-- aborts with "no unique or exclusion constraint matching the ON CONFLICT
-- specification". Add the constraint here so the
-- (artifact_id, skill_id, level_id, marker_text) tuple is the idempotency
-- key both at the DB and the application layer.
--
-- Synthetic seed rows produced before this migration may carry NULL values
-- and may have duplicate triples; backfill and dedupe before adding the
-- constraints so the migration does not fail on existing installations.

update activity.evidence
  set rationale = 'synthetic'
  where rationale is null;

update activity.evidence
  set level_id = 'working'
  where level_id is null;

-- Drop any pre-existing duplicate (artifact_id, skill_id, level_id,
-- marker_text) tuples from synthetic seeds. Keep the lowest evidence_id
-- per tuple so the surviving row is deterministic.
delete from activity.evidence e1
  using activity.evidence e2
  where e1.evidence_id > e2.evidence_id
    and e1.artifact_id = e2.artifact_id
    and e1.skill_id = e2.skill_id
    and e1.level_id = e2.level_id
    and e1.marker_text = e2.marker_text;

alter table activity.evidence
  alter column rationale set not null;

alter table activity.evidence
  alter column level_id set not null;

alter table activity.evidence
  add constraint evidence_artifact_skill_level_marker_key
  unique (artifact_id, skill_id, level_id, marker_text);
