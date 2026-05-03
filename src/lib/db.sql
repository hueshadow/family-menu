-- family-menu Supabase schema
-- Apply in Supabase SQL Editor.

create extension if not exists "uuid-ossp";

create table if not exists family_members (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  role text not null check (role in ('yeye','nainai','baba','mama','baby')),
  age int not null,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists health_reports (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references family_members(id) on delete cascade,
  year int not null,
  storage_path text not null,
  ocr_used boolean not null default false,
  parsed jsonb,
  created_at timestamptz not null default now()
);

create table if not exists dietary_profiles (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references family_members(id) on delete cascade,
  version int not null,
  tags text[] not null default '{}',
  recommend text[] not null default '{}',
  avoid text[] not null default '{}',
  rationale text,
  generated_at timestamptz not null default now()
);

create table if not exists recipes (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  ingredients jsonb not null,
  steps text not null,
  tags text[] not null default '{}',
  suitable_for text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists recipes_name_idx on recipes(name);

create table if not exists weekly_menus (
  id uuid primary key default uuid_generate_v4(),
  week_start date not null unique,
  status text not null check (status in ('draft','reviewing','locked','archived')) default 'draft',
  days jsonb not null,
  locked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table weekly_menus add column if not exists analysis jsonb;
alter table weekly_menus add column if not exists analyzed_at timestamptz;
alter table weekly_menus add column if not exists auto_generated boolean not null default false;

create table if not exists shopping_lists (
  id uuid primary key default uuid_generate_v4(),
  week_id uuid not null references weekly_menus(id) on delete cascade,
  items jsonb not null,
  created_at timestamptz not null default now()
);
