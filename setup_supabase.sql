-- 47 小助手 v0.3 · Supabase 初始化
-- 在 Supabase -> SQL Editor 中执行一次。

create extension if not exists pgcrypto;

create table if not exists public.kb_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text default '',
  status text not null default 'active' check (status in ('active','draft')),
  keywords text[] default '{}',
  content text default '',
  assets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kb_articles enable row level security;

-- 这是当前“你自己使用”的原型策略：允许 anon key 读写知识库。
-- 正式接真实用户和售后数据前，必须改成管理员登录 + Auth/RLS。
drop policy if exists "prototype anon read kb" on public.kb_articles;
drop policy if exists "prototype anon insert kb" on public.kb_articles;
drop policy if exists "prototype anon update kb" on public.kb_articles;
drop policy if exists "prototype anon delete kb" on public.kb_articles;

create policy "prototype anon read kb" on public.kb_articles for select to anon using (true);
create policy "prototype anon insert kb" on public.kb_articles for insert to anon with check (true);
create policy "prototype anon update kb" on public.kb_articles for update to anon using (true) with check (true);
create policy "prototype anon delete kb" on public.kb_articles for delete to anon using (true);

insert into storage.buckets (id, name, public)
values ('kb-assets', 'kb-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "prototype anon read kb assets" on storage.objects;
drop policy if exists "prototype anon insert kb assets" on storage.objects;
drop policy if exists "prototype anon update kb assets" on storage.objects;
drop policy if exists "prototype anon delete kb assets" on storage.objects;

create policy "prototype anon read kb assets" on storage.objects for select to anon using (bucket_id = 'kb-assets');
create policy "prototype anon insert kb assets" on storage.objects for insert to anon with check (bucket_id = 'kb-assets');
create policy "prototype anon update kb assets" on storage.objects for update to anon using (bucket_id = 'kb-assets') with check (bucket_id = 'kb-assets');
create policy "prototype anon delete kb assets" on storage.objects for delete to anon using (bucket_id = 'kb-assets');
