-- Store the iBuild report's CYCLE column per comment. For a Resolved comment this
-- is the cycle it was resolved in (the cycle David submitted). Drives the
-- "Comentarios resueltos por ciclo" section. Paste + Run.
alter table comments add column if not exists cycle int;
