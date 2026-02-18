create table if not exists profiles (
  id uuid primary key,
  email text not null unique,
  role text not null check (role in ('admin','teacher','student'))
);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'profiles'
      and constraint_name = 'profiles_user_fk'
  ) then
    alter table public.profiles
      add constraint profiles_user_fk
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end
$$;

alter table profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on profiles
  for update using (auth.uid() = id);

drop policy if exists profiles_insert_admin_only on public.profiles;
create policy profiles_insert_admin_only on profiles
  for insert with check (role = 'admin');
