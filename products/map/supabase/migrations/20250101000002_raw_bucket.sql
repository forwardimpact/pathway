-- =============================================================================
-- Raw storage bucket
-- =============================================================================
-- Private bucket for the ELT pipeline's Extract phase.
-- Stores raw webhook payloads, API responses, and uploads as JSON files.
-- Only service-role access — no RLS policies needed.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('raw', 'raw', false)
ON CONFLICT (id) DO NOTHING;
