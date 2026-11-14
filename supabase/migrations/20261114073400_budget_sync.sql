-- Personal budget app (my-budget) — device mirror + remote edit queue.
-- Applied to the Supabase project the app's NEXT_PUBLIC_SUPABASE_URL points at.
-- Lives in its own schema; the only public object is the budget_sync() RPC the
-- app calls with its device key (see src/lib/cloud-sync.ts).

create schema if not exists budget;
revoke all on schema budget from public, anon, authenticated;

create table budget.vaults (
  id text primary key,                         -- sha256(device key), hex — the key itself is never stored
  label text not null default '',
  approved boolean not null default false,     -- nothing is uploaded or served until approved
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);

create table budget.state (
  vault_id text not null references budget.vaults (id) on delete cascade,
  key text not null,                           -- localStorage key, e.g. asset/accounts/v2
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (vault_id, key)
);

create table budget.ops (
  id bigint generated always as identity primary key,
  vault_id text not null references budget.vaults (id) on delete cascade,
  op jsonb not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  result text
);
create index ops_pending_idx on budget.ops (vault_id, id) where applied_at is null;

alter table budget.vaults enable row level security;
alter table budget.state enable row level security;
alter table budget.ops enable row level security;

-- One round trip per tick: register/heartbeat, upload changed keys, ack applied
-- ops, fetch pending ops.
create or replace function public.budget_sync(
  p_key text,
  p_label text default '',
  p_state jsonb default '{}'::jsonb,
  p_acks jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
  v_approved boolean;
  v_ops jsonb;
begin
  if p_key is null or p_key !~ '^[A-Za-z0-9_-]{32,64}$' then
    raise exception 'bad key' using errcode = '22023';
  end if;
  v_id := encode(sha256(convert_to(p_key, 'UTF8')), 'hex');

  insert into budget.vaults (id, label)
  values (v_id, left(coalesce(p_label, ''), 120))
  on conflict (id) do update set seen_at = now(), label = excluded.label
  returning approved into v_approved;

  if not v_approved then
    -- Unapproved registrations hold no data; keep only the 20 most recent.
    delete from budget.vaults
    where not approved
      and id in (select id from budget.vaults where not approved order by seen_at desc offset 20);
    return jsonb_build_object('status', 'pending', 'code', upper(left(v_id, 4)));
  end if;

  if jsonb_typeof(p_state) = 'object' then
    insert into budget.state (vault_id, key, value)
    select v_id, e.key, e.value
    from jsonb_each(p_state) e
    where e.key ~ '^asset/[a-z0-9/-]{1,60}$' and octet_length(e.value::text) <= 3000000
    on conflict (vault_id, key) do update set value = excluded.value, updated_at = now();
  end if;

  if jsonb_typeof(p_acks) = 'array' then
    update budget.ops o
    set applied_at = now(), result = left(a.value ->> 'result', 300)
    from jsonb_array_elements(p_acks) a
    where o.vault_id = v_id and o.applied_at is null and o.id::text = a.value ->> 'id';
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object('id', o.id, 'op', o.op, 'note', o.note) order by o.id),
    '[]'::jsonb
  )
  into v_ops
  from budget.ops o
  where o.vault_id = v_id and o.applied_at is null;

  return jsonb_build_object('status', 'approved', 'code', upper(left(v_id, 4)), 'ops', v_ops);
end
$$;

revoke all on function public.budget_sync(text, text, jsonb, jsonb) from public;
grant execute on function public.budget_sync(text, text, jsonb, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
