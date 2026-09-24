-- ============================================================
-- ASTB-E Prep — Supabase 스키마 (AFOQT Master와 같은 프로젝트에 추가)
-- ------------------------------------------------------------
-- 사용법: supabase.com → (AFOQT 앱 프로젝트) → SQL Editor → 아래 전체 붙여넣고 RUN.
--        여러 번 다시 실행해도 안전합니다. AFOQT 테이블은 건드리지 않습니다.
-- 데이터 구분은 로그인 대신 '동기화 코드'(user_key, astb-로 시작).
-- ============================================================

-- 오답노트·모의고사 기록·약점·용어 카드 등 전체 진도 (JSON 한 덩어리)
create table if not exists public.astb_app_state (
  user_key    text        primary key,
  data        jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- 날짜별 학습량 (스트릭·달력)
create table if not exists public.astb_daily_log (
  user_key    text        not null,
  day         date        not null,
  studied     integer     not null default 0,
  correct     integer     not null default 0,
  seconds     integer     not null default 0,
  goal_met    boolean     not null default false,
  updated_at  timestamptz not null default now(),
  primary key (user_key, day)
);

-- 설정 (응시 예정일·단계·옵션)
create table if not exists public.astb_settings (
  user_key    text        primary key,
  start_date  date,
  exam_date   date,
  data        jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- 실시간(Realtime) — 이미 추가돼 있으면 건너뜀
do $$
declare t text;
begin
  foreach t in array array['astb_app_state','astb_daily_log','astb_settings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- RLS — 개인용(로그인 없음). 추측 불가능한 동기화 코드로 구분.
alter table public.astb_app_state enable row level security;
alter table public.astb_daily_log enable row level security;
alter table public.astb_settings  enable row level security;

drop policy if exists "anon all astb_app_state" on public.astb_app_state;
drop policy if exists "anon all astb_daily_log" on public.astb_daily_log;
drop policy if exists "anon all astb_settings"  on public.astb_settings;

create policy "anon all astb_app_state" on public.astb_app_state for all to anon using (true) with check (true);
create policy "anon all astb_daily_log" on public.astb_daily_log for all to anon using (true) with check (true);
create policy "anon all astb_settings"  on public.astb_settings  for all to anon using (true) with check (true);
