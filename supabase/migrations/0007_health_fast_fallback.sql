-- The first fallback was as slow as the primary; a small fast model is what a
-- fallback is for.
alter table health_settings alter column fallback_model set default 'deepseek-ai/deepseek-v4.1-flash';
