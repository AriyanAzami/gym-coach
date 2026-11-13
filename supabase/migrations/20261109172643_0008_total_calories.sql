-- Apple Watch reports active and total calories; `calories` stays the active
-- figure it has always held.
alter table sessions add column total_calories int check (total_calories >= 0);
