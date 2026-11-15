-- Course Voices / Run once in a NEW Supabase project's SQL editor.
-- No demo professors or fake reviews are inserted into the live database.
begin;
create schema cv_private;
revoke all on schema cv_private from public, anon, authenticated;
create table cv_private.admins (user_id uuid primary key references auth.users(id) on delete cascade);
create table cv_private.courses (
 id uuid primary key default gen_random_uuid(), professor text not null check(length(professor) between 1 and 150),
 code text not null check(length(code) between 1 and 150), title text not null check(length(title) between 1 and 150),
 department text not null check(length(department) between 1 and 150), active boolean not null default true,
 unique(professor,code)
);
create table cv_private.reviews (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references cv_private.courses(id),
 author uuid not null references auth.users(id) on delete cascade, term text not null,
 rating integer not null check(rating between 1 and 5), difficulty integer not null check(difficulty between 1 and 5),
 body text not null check(length(body) between 30 and 3000),
 status text not null default 'pending' check(status in ('pending','published','hidden')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(course_id,author,term)
);
create table cv_private.reports (
 id uuid primary key default gen_random_uuid(), review_id uuid not null references cv_private.reviews(id) on delete cascade,
 reporter uuid not null references auth.users(id) on delete cascade, reason text not null check(length(reason) between 10 and 1000),
 resolved boolean not null default false, created_at timestamptz not null default now(), unique(review_id,reporter)
);
create table cv_private.audit (
 id bigint generated always as identity primary key, actor uuid, action text not null, target uuid,
 reason text, created_at timestamptz not null default now()
);
create index on cv_private.reviews(course_id,status,created_at desc);
create index on cv_private.reviews(author);
create index on cv_private.reports(resolved);
create index on cv_private.audit(actor,created_at);
alter table cv_private.admins enable row level security;
alter table cv_private.courses enable row level security;
alter table cv_private.reviews enable row level security;
alter table cv_private.reports enable row level security;
alter table cv_private.audit enable row level security;
revoke all on all tables in schema cv_private from public,anon,authenticated;
revoke all on all sequences in schema cv_private from public,anon,authenticated;

create function cv_private.require_student() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid();
begin
 if u is null or not exists(select 1 from auth.users where id=u and email_confirmed_at is not null and lower(split_part(email,'@',2))='utah.edu' and (banned_until is null or banned_until<now())) then
 raise exception 'A verified @utah.edu account is required.' using errcode='42501'; end if;
 return u;
end $$;
create function public.cv_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from cv_private.admins a join auth.users u on u.id=a.user_id where a.user_id=auth.uid() and u.email_confirmed_at is not null and lower(split_part(u.email,'@',2))='utah.edu' and (u.banned_until is null or u.banned_until<now()));
$$;
create function cv_private.require_admin() returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not public.cv_is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
 return cv_private.require_student();
end $$;
-- Serialized per-account write limits. Audit survives review deletion to prevent quota bypass.
create function cv_private.rate_limit(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,0));
 if (select count(*) from cv_private.audit where actor=p_user and created_at>now()-interval '1 hour' and action in ('review_save','report','review_delete'))>=20 then
 raise exception 'Too many changes. Please try again in an hour.'; end if;
end $$;
create function public.cv_catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by x.professor),'[]'::jsonb) from (
 select c.*,round(avg(r.rating)::numeric,1) as average,count(r.id)::int as review_count
 from cv_private.courses c left join cv_private.reviews r on r.course_id=c.id and r.status='published'
 where c.active group by c.id) x;
$$;
create function public.cv_reviews(p_course uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) from (
 select r.id,r.term,r.rating,r.difficulty,r.body,r.created_at,r.status,(r.author=auth.uid()) as is_mine
 from cv_private.reviews r join cv_private.courses c on c.id=r.course_id
 where c.active and r.course_id=p_course and r.status='published' order by r.created_at desc limit 500) x;
$$;
create function public.cv_my_reviews() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=cv_private.require_student(); result jsonb;
begin
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into result from (
 select r.id,r.course_id,r.term,r.rating,r.difficulty,r.body,r.status,r.created_at,true as is_mine,c.code,c.professor,
 c.code||' · '||c.professor as course_label from cv_private.reviews r join cv_private.courses c on c.id=r.course_id where r.author=u) x;
 return result;
end $$;
create function public.cv_save_review(p_id uuid,p_course uuid,p_term text,p_rating integer,p_difficulty integer,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=cv_private.require_student(); saved uuid;
begin
 perform cv_private.rate_limit(u);
 if p_term is null or p_term !~ '^(Spring|Summer|Fall) (20[0-9]{2})$' then raise exception 'Choose a valid term.'; end if;
 if right(p_term,4)::int>extract(year from now()) then raise exception 'Choose a completed term, not a future year.'; end if;
 if p_id is null then
  if not exists(select 1 from cv_private.courses where id=p_course and active) then raise exception 'Course unavailable.'; end if;
  insert into cv_private.reviews(course_id,author,term,rating,difficulty,body) values(p_course,u,p_term,p_rating,p_difficulty,btrim(p_body)) returning id into saved;
 else
  update cv_private.reviews set term=p_term,rating=p_rating,difficulty=p_difficulty,body=btrim(p_body),status='pending',updated_at=now()
  where id=p_id and author=u and course_id=p_course returning id into saved;
  if saved is null then raise exception 'Review not found or not owned by you.' using errcode='42501'; end if;
 end if;
 insert into cv_private.audit(actor,action,target) values(u,'review_save',saved);
 return saved;
exception when unique_violation then raise exception 'You already have a review for this course and term. Edit it in My reviews.';
end $$;
create function public.cv_delete_review(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=cv_private.require_student();
begin
 perform cv_private.rate_limit(u);
 delete from cv_private.reviews where id=p_id and author=u;
 if not found then raise exception 'Review not found or not owned by you.' using errcode='42501'; end if;
 insert into cv_private.audit(actor,action,target) values(u,'review_delete',p_id);
end $$;
create function public.cv_report(p_review uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=cv_private.require_student();
begin
 perform cv_private.rate_limit(u);
 perform 1 from cv_private.reviews r join cv_private.courses c on c.id=r.course_id where r.id=p_review and r.status='published' and r.author<>u and c.active;
 if not found then raise exception 'Review unavailable for reporting.'; end if;
 insert into cv_private.reports(review_id,reporter,reason) values(p_review,u,btrim(p_reason));
 insert into cv_private.audit(actor,action,target) values(u,'report',p_review);
exception when unique_violation then raise exception 'You have already reported this review.';
end $$;
create function public.cv_admin_courses() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform cv_private.require_admin();
 return (select coalesce(jsonb_agg(to_jsonb(c) order by c.professor),'[]'::jsonb) from cv_private.courses c);
end $$;
create function public.cv_save_course(p_id uuid,p_professor text,p_code text,p_title text,p_department text,p_active boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=cv_private.require_admin(); saved uuid;
begin
 if p_id is null then
 insert into cv_private.courses(professor,code,title,department,active) values(btrim(p_professor),btrim(p_code),btrim(p_title),btrim(p_department),p_active) returning id into saved;
 else
 update cv_private.courses set professor=btrim(p_professor),code=btrim(p_code),title=btrim(p_title),department=btrim(p_department),active=p_active where id=p_id returning id into saved;
 if saved is null then raise exception 'Course not found.'; end if;
 end if;
 insert into cv_private.audit(actor,action,target) values(u,'course_save',saved);return saved;
end $$;
create function public.cv_admin_queue(p_mode text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform cv_private.require_admin();
 if p_mode='pending' then
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
 select r.id,r.body,r.status,c.code||' · '||c.professor as course_label from cv_private.reviews r join cv_private.courses c on c.id=r.course_id where r.status='pending' order by r.created_at limit 200) x);
 elsif p_mode='reports' then
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
 select r.id,r.body,r.status,p.id as report_id,p.reason,c.code||' · '||c.professor as course_label from cv_private.reports p join cv_private.reviews r on r.id=p.review_id join cv_private.courses c on c.id=r.course_id where not p.resolved order by p.created_at limit 200) x);
 else raise exception 'Invalid queue.'; end if;
end $$;
create function public.cv_moderate(p_review uuid,p_action text,p_report uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=cv_private.require_admin();
begin
 if p_action is null or p_action not in ('publish','hide') or p_reason is null or length(btrim(p_reason)) not between 5 and 1000 then raise exception 'Choose a valid decision and provide a reason.'; end if;
 perform 1 from cv_private.reviews where id=p_review for update;
 if not found then raise exception 'Review no longer exists.'; end if;
 if p_report is not null and not exists(select 1 from cv_private.reports where id=p_report and review_id=p_review and not resolved) then raise exception 'Report already resolved or not found.'; end if;
 update cv_private.reviews set status=case when p_action='publish' then 'published' else 'hidden' end,updated_at=now() where id=p_review;
 update cv_private.reports set resolved=true where review_id=p_review and not resolved;
 insert into cv_private.audit(actor,action,target,reason) values(u,p_action,p_review,btrim(p_reason));
end $$;
revoke all on all functions in schema cv_private from public,anon,authenticated;
-- Limit permissions to this application's functions; leave other project functions alone.
do $$ declare f record;
begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and left(p.proname,3)='cv_' loop
 execute format('revoke all on function %s from public, anon, authenticated',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
grant execute on function public.cv_catalog(),public.cv_reviews(uuid) to anon;
commit;
