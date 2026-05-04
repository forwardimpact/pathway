CREATE UNIQUE INDEX idx_evidence_upsert_key
  ON activity.evidence(artifact_id, skill_id, level_id, marker_text);
