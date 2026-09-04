-- Emergency feature rollback: disable every Human Review mutation while retaining
-- all package, question, decision and audit evidence for recovery or re-apply.
begin;
revoke execute on function public.human_review_import_package(uuid,uuid,text,text,text,text,integer,integer,integer,integer,jsonb,uuid) from service_role;
revoke execute on function public.human_review_authorize_reviewer(uuid,uuid,uuid,text,uuid,text) from service_role;
revoke execute on function public.human_review_claim_package(uuid,uuid,uuid,bigint,uuid) from service_role;
revoke execute on function public.human_review_transfer_package(uuid,uuid,uuid,uuid,bigint,uuid,text) from service_role;
revoke execute on function public.human_review_save_decision(uuid,uuid,text,uuid,text,text,bigint,bigint,uuid) from service_role;
revoke execute on function public.human_review_submit_package(uuid,uuid,uuid,bigint,bigint,uuid) from service_role;
revoke execute on function public.human_review_owner_finalize_package(uuid,uuid,uuid,text,text,bigint,uuid) from service_role;
commit;
