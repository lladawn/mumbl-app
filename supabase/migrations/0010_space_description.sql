alter table spaces
add column if not exists description text check (description is null or char_length(description) <= 180);
