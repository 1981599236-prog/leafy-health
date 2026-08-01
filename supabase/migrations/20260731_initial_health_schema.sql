-- 一叶健康记录：第一版数据结构
-- 在 Supabase Dashboard 的 SQL Editor 中一次性运行本文件。

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '叶' check (char_length(display_name) between 1 and 2),
  gender text check (gender in ('男', '女')),
  age smallint check (age between 1 and 120),
  height_cm numeric(5, 1) check (height_cm between 50 and 300),
  weight_kg numeric(5, 1) check (weight_kg between 10 and 500),
  activity_level text check (activity_level in ('久坐', '轻度活动', '经常运动')),
  goal text check (goal in ('减脂', '保持', '增肌')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blood_pressure_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  systolic smallint not null check (systolic between 40 and 300),
  diastolic smallint not null check (diastolic between 20 and 200),
  recorded_at timestamptz not null default now()
);

create table if not exists public.food_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  calories integer not null check (calories >= 0),
  protein_g numeric(6, 1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(6, 1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(6, 1) not null default 0 check (fat_g >= 0),
  image_path text,
  recorded_at timestamptz not null default now()
);

create table if not exists public.exercise_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('散步', '跑步', '力量训练', '骑车')),
  duration_minutes smallint not null check (duration_minutes between 1 and 1440),
  calories integer not null check (calories >= 0),
  recorded_at timestamptz not null default now()
);

create index if not exists blood_pressure_records_user_date_idx on public.blood_pressure_records (user_id, recorded_at desc);
create index if not exists food_records_user_date_idx on public.food_records (user_id, recorded_at desc);
create index if not exists exercise_records_user_date_idx on public.exercise_records (user_id, recorded_at desc);

alter table public.profiles enable row level security;
alter table public.blood_pressure_records enable row level security;
alter table public.food_records enable row level security;
alter table public.exercise_records enable row level security;

create policy "Users manage own profile" on public.profiles
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users manage own blood pressure" on public.blood_pressure_records
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own food records" on public.food_records
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own exercise records" on public.exercise_records
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
