create table if not exists public.translation_cache (
  id uuid primary key default gen_random_uuid(),
  lang text not null,
  source_hash text not null,
  source_text text not null,
  translated text not null,
  created_at timestamptz not null default now(),
  unique (lang, source_hash)
);
create index if not exists translation_cache_lang_idx on public.translation_cache (lang);
grant select on public.translation_cache to anon, authenticated;
grant all on public.translation_cache to service_role;
alter table public.translation_cache enable row level security;
create policy "translation_cache readable by all" on public.translation_cache for select to anon, authenticated using (true);