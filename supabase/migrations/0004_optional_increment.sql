-- An exercise's increment is an override, not a requirement.
--
-- engine.js already falls back to rules.progression.increments for the
-- exercise's equipment when the exercise carries none, so demanding one per
-- exercise forced the Notion import to invent a number it had no source for.
-- A null increment now means "use the rules", which is what the rules are for.

alter table exercises alter column increment drop not null;
alter table exercises alter column unit drop not null;

-- If one is given, both must be, or the value has no unit.
alter table exercises add constraint exercises_increment_has_unit
  check ((increment is null and unit is null) or (increment is not null and unit is not null));
