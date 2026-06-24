alter table spaces
  add column if not exists read_token_hash text;

alter table slack_space_handoffs
  add column if not exists access_token_ciphertext text,
  add column if not exists access_token_iv text,
  add column if not exists access_token_tag text;

notify pgrst, 'reload schema';
