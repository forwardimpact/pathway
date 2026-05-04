-- Spec 800: Evidence required-field enforcement
--
-- Spec 800 § Evidence output contract requires every row to carry a non-null
-- rationale and level_id. The svcmap WriteEvidence boundary validates this
-- at the application layer; this migration is the DB backstop so that any
-- future writer cannot bypass the contract.
--
-- Synthetic seed rows produced before this migration may carry NULL values;
-- backfill them with sentinel values before adding the constraint so the
-- migration does not fail on existing installations.

update activity.evidence
  set rationale = 'synthetic'
  where rationale is null;

update activity.evidence
  set level_id = 'working'
  where level_id is null;

alter table activity.evidence
  alter column rationale set not null;

alter table activity.evidence
  alter column level_id set not null;
