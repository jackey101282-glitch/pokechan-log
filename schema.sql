-- ============================================================
-- ポケモンチャンピオンズ バトルログDB スキーマ（v2）
-- Supabase の SQL Editor に貼って Run。
-- 何度実行してもデータは消えません（IF NOT EXISTS / ADD COLUMN IF NOT EXISTS のみ）。
-- ============================================================

-- ---------- 構築（パーティ）テーブル ----------
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  members     text[] not null default '{}',   -- 自分の6匹（名前のみ・互換用）
  roster      jsonb  not null default '[]',   -- 6匹の詳細 [{name,ability,nature,item,sp:{h,a,b,c,d,s},moves:[]}]
  note        text,
  plans       jsonb  not null default '{}',   -- 対策すべき並びごとの選出プラン
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.teams add column if not exists roster jsonb not null default '[]';
alter table public.teams add column if not exists plans  jsonb not null default '{}';
alter table public.teams add column if not exists note   text;

-- ---------- 対戦ログテーブル ----------
create table if not exists public.battles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  team_id     uuid references public.teams(id) on delete set null,

  played_at   date not null default current_date,
  season      text,                            -- 例: M-5
  rule        text not null default 'single',  -- single / double
  rank        text,                            -- 例: マスターボール級II

  opp_team    text[] not null default '{}',    -- 相手の6匹
  my_pick     text[] not null default '{}',    -- 自分の選出
  opp_pick    text[] not null default '{}',    -- 相手の選出
  mega        text,                            -- 自分がメガシンカさせた枠

  turns       jsonb not null default '[]',     -- ターンごとの行動ログ
  -- turns の1要素:
  -- { n:1, myMon:'メガライチュウY', oppMon:'ガブリアス',
  --   myAct:{type:'move'|'switch'|'protect'|'mega'|'other', move:'でんじほう', to:'アーマーガア'},
  --   oppAct:{...}, note:'' }

  result      text not null,                   -- win / lose
  reason      text,                            -- 勝因/敗因 1文
  key_turn    text,
  next_plan   text,
  opp_sets    text,
  notes       text,

  created_at  timestamptz not null default now()
);
alter table public.battles add column if not exists mega  text;
alter table public.battles add column if not exists turns jsonb not null default '[]';

create index if not exists battles_user_played_idx on public.battles (user_id, played_at desc, created_at desc);
create index if not exists battles_team_idx        on public.battles (team_id);

-- ---------- 行レベルセキュリティ（自分のデータしか見えない） ----------
alter table public.teams   enable row level security;
alter table public.battles enable row level security;

drop policy if exists teams_own   on public.teams;
drop policy if exists battles_own on public.battles;

create policy teams_own on public.teams
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy battles_own on public.battles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Data API への公開（この2テーブルだけ明示的に許可） ----------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.teams   to authenticated;
grant select, insert, update, delete on public.battles to authenticated;
