-- team sharing is now carried by team_id alone; visibility is private|public.
-- legacy rows with visibility='team' keep their team via team_id and become
-- private to the outside world (same effective audience as before).
UPDATE "prompts" SET "visibility" = 'private' WHERE "visibility" = 'team';
