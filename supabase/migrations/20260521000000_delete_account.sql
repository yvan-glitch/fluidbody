-- delete_my_account: allow an authenticated user to wipe their own account.
--
-- Required by Apple App Store guideline 5.1.1(v): apps that let users create
-- an account must also let them delete it in-app. Without this RPC, the
-- iOS submission is rejected.
--
-- Cascade strategy:
--   - We DELETE explicitly from every user-owned public table the app
--     currently uses (progression, user_programs, user_favorites). Some of
--     these tables have ON DELETE CASCADE on auth.users(id), so they would
--     also clear from the auth.users DELETE below — but doing it
--     explicitly first means we can return row counts to the client (useful
--     for the support log) and stays correct even if a future migration
--     removes the cascade.
--   - tv_pairings is intentionally guarded with to_regclass: it only
--     exists on branches that have shipped the TV pairing feature. The
--     function must remain runnable on dev/staging environments that
--     don't have it yet.
--   - profiles is deleted last among the public tables. auth.users(id) is
--     the very last step — once that row is gone, RLS no longer authorizes
--     anything on the session JWT.
--
-- Security: SECURITY DEFINER so the function can DELETE from auth.users
-- (regular `authenticated` role cannot). Inside the body we only ever
-- reference auth.uid() — there is no parameter that could be used to
-- delete someone else's account. EXECUTE is granted to authenticated only;
-- anon/public are revoked explicitly.
--
-- search_path is pinned to public,auth to make the SECURITY DEFINER call
-- resistant to schema-shadowing attacks (Supabase lint rule).

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted_progression integer := 0;
  v_deleted_programs    integer := 0;
  v_deleted_favorites   integer := 0;
  v_deleted_pairings    integer := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  -- progression: optional table (used by App.js for cross-device session
  -- completion sync). Guarded in case the schema hasn't shipped it.
  if to_regclass('public.progression') is not null then
    execute 'delete from public.progression where user_id = $1' using v_user_id;
    get diagnostics v_deleted_progression = row_count;
  end if;

  -- user_programs: present from the algorithmic programs feature.
  if to_regclass('public.user_programs') is not null then
    execute 'delete from public.user_programs where user_id = $1' using v_user_id;
    get diagnostics v_deleted_programs = row_count;
  end if;

  -- user_favorites: present from the biblio favorites feature.
  if to_regclass('public.user_favorites') is not null then
    execute 'delete from public.user_favorites where user_id = $1' using v_user_id;
    get diagnostics v_deleted_favorites = row_count;
  end if;

  -- tv_pairings: TV-feature branch only. Skipped on environments where
  -- the table hasn't been created yet.
  if to_regclass('public.tv_pairings') is not null then
    execute 'delete from public.tv_pairings where user_id = $1 or redeemed_user_id = $1' using v_user_id;
    get diagnostics v_deleted_pairings = row_count;
  end if;

  -- Profile row (also clears referral linkage on the user side).
  delete from public.profiles where id = v_user_id;

  -- Auth user — final step. Cascade FKs on auth.users(id) will clean up
  -- any remaining children. After this point auth.uid() in the same
  -- transaction is still v_user_id, but the JWT is effectively orphaned;
  -- the client must signOut() right after this RPC returns.
  delete from auth.users where id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'deleted', jsonb_build_object(
      'progression', v_deleted_progression,
      'programs',    v_deleted_programs,
      'favorites',   v_deleted_favorites,
      'tv_pairings', v_deleted_pairings
    )
  );
end;
$$;

revoke execute on function public.delete_my_account() from public;
revoke execute on function public.delete_my_account() from anon;
grant  execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'Authenticated user wipes their own account: cascades through user-owned tables, deletes profile, then auth.users row. Returns {ok, deleted:{...row counts}}. Required for App Store 5.1.1(v).';
