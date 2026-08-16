alter table public.teams   add column if not exists roster    jsonb not null default '[]';
alter table public.teams   add column if not exists plans     jsonb not null default '{}';
alter table public.teams   add column if not exists note      text;
alter table public.battles add column if not exists turns     jsonb not null default '[]';
alter table public.battles add column if not exists mega      text;
alter table public.battles add column if not exists opp_mega  text;
alter table public.battles add column if not exists pred_lead text;
