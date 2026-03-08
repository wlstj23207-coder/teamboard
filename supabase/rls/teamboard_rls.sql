-- TeamBoard RLS hardening
-- Apply this file in Supabase SQL Editor.

-- 1) Helper functions
create or replace function public.is_board_member(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.board_members bm
    where bm.board_id = p_board_id
      and bm.user_id::text = auth.uid()::text
  );
$$;

create or replace function public.is_board_owner(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.boards b
    where b.id = p_board_id
      and b.created_by::text = auth.uid()::text
  );
$$;

create or replace function public.is_task_member(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and public.is_board_member(t.board_id)
  );
$$;

-- Safe join API to avoid exposing boards by invite code query.
create or replace function public.join_board_by_invite(
  p_invite_code text,
  p_member_name text
)
returns table (
  id uuid,
  name text,
  invite_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_board public.boards%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select *
    into v_board
  from public.boards b
  where b.invite_code = p_invite_code
  limit 1;

  if not found then
    raise exception 'INVITE_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.board_members bm
    where bm.board_id = v_board.id
      and bm.user_id::text = auth.uid()::text
  ) then
    insert into public.board_members (board_id, user_id, name)
    values (v_board.id, auth.uid(), nullif(trim(p_member_name), ''));
  else
    update public.board_members
    set name = coalesce(nullif(trim(p_member_name), ''), name)
    where board_id = v_board.id
      and user_id::text = auth.uid()::text;
  end if;

  return query
  select v_board.id, v_board.name, v_board.invite_code;
end;
$$;

revoke all on function public.is_board_member(uuid) from public;
revoke all on function public.is_board_owner(uuid) from public;
revoke all on function public.is_task_member(uuid) from public;
revoke all on function public.join_board_by_invite(text, text) from public;

grant execute on function public.is_board_member(uuid) to authenticated;
grant execute on function public.is_board_owner(uuid) to authenticated;
grant execute on function public.is_task_member(uuid) to authenticated;
grant execute on function public.join_board_by_invite(text, text) to authenticated;

-- 2) Enable RLS
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.tasks enable row level security;
alter table public.notices enable row level security;
alter table public.task_comments enable row level security;

-- 3) Drop old policies (idempotent)
drop policy if exists boards_select on public.boards;
drop policy if exists boards_insert on public.boards;
drop policy if exists boards_update on public.boards;
drop policy if exists boards_delete on public.boards;

drop policy if exists board_members_select on public.board_members;
drop policy if exists board_members_insert on public.board_members;
drop policy if exists board_members_update on public.board_members;
drop policy if exists board_members_delete on public.board_members;

drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_insert on public.tasks;
drop policy if exists tasks_update on public.tasks;
drop policy if exists tasks_delete on public.tasks;

drop policy if exists notices_select on public.notices;
drop policy if exists notices_insert on public.notices;
drop policy if exists notices_update on public.notices;
drop policy if exists notices_delete on public.notices;

drop policy if exists task_comments_select on public.task_comments;
drop policy if exists task_comments_insert on public.task_comments;
drop policy if exists task_comments_update on public.task_comments;
drop policy if exists task_comments_delete on public.task_comments;

-- 4) Create policies
create policy boards_select
on public.boards
for select
using (
  public.is_board_member(id)
  or created_by::text = auth.uid()::text
);

create policy boards_insert
on public.boards
for insert
with check (
  auth.uid() is not null
  and created_by::text = auth.uid()::text
);

create policy boards_update
on public.boards
for update
using (public.is_board_owner(id))
with check (public.is_board_owner(id));

create policy boards_delete
on public.boards
for delete
using (public.is_board_owner(id));

create policy board_members_select
on public.board_members
for select
using (
  public.is_board_member(board_id)
  or public.is_board_owner(board_id)
);

create policy board_members_insert
on public.board_members
for insert
with check (
  auth.uid() is not null
  and public.is_board_owner(board_id)
);

create policy board_members_update
on public.board_members
for update
using (public.is_board_owner(board_id))
with check (public.is_board_owner(board_id));

create policy board_members_delete
on public.board_members
for delete
using (
  public.is_board_owner(board_id)
  or user_id::text = auth.uid()::text
);

create policy tasks_select
on public.tasks
for select
using (public.is_board_member(board_id));

create policy tasks_insert
on public.tasks
for insert
with check (public.is_board_member(board_id));

create policy tasks_update
on public.tasks
for update
using (public.is_board_member(board_id))
with check (public.is_board_member(board_id));

create policy tasks_delete
on public.tasks
for delete
using (public.is_board_member(board_id));

create policy notices_select
on public.notices
for select
using (public.is_board_member(board_id));

create policy notices_insert
on public.notices
for insert
with check (public.is_board_member(board_id));

create policy notices_update
on public.notices
for update
using (public.is_board_member(board_id))
with check (public.is_board_member(board_id));

create policy notices_delete
on public.notices
for delete
using (public.is_board_member(board_id));

create policy task_comments_select
on public.task_comments
for select
using (public.is_task_member(task_id));

create policy task_comments_insert
on public.task_comments
for insert
with check (public.is_task_member(task_id));

create policy task_comments_update
on public.task_comments
for update
using (public.is_task_member(task_id))
with check (public.is_task_member(task_id));

create policy task_comments_delete
on public.task_comments
for delete
using (public.is_task_member(task_id));
