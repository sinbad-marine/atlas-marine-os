-- Run read-only before backup, after restore rehearsal, and after migration.
select 'human_reviewer_authorizations' relation,count(*) row_count from public.human_reviewer_authorizations
union all select 'human_review_packages',count(*) from public.human_review_packages
union all select 'human_review_package_questions',count(*) from public.human_review_package_questions
union all select 'human_question_reviews',count(*) from public.human_question_reviews
union all select 'human_review_audit',count(*) from public.human_review_audit order by relation;

select count(*) as invalid_completeness_rows from public.human_review_packages
where package_complete<>(expected_count=present_count and missing_count=0 and deferred_count=0)
   or present_count+missing_count+deferred_count<>expected_count;

select count(*) as orphan_review_rows from public.human_question_reviews r
left join public.human_review_package_questions q using(package_id,question_id)
where q.package_id is null;

select count(*) as owner_without_actor_rows from public.human_question_reviews
where owner_decision<>'PENDING' and (owner_id is null or owner_reviewed_at is null);
