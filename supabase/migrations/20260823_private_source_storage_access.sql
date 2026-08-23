-- Private Atlas library publications may be read only by the workspace Owner
-- and explicitly authorized Developers. Other storage categories retain their
-- existing member-access rules.
alter policy atlas_storage_select_member
on storage.objects
using (
  bucket_id = any (array[
    'atlas-documents'::text,
    'nautical-publications'::text,
    'nautical-charts'::text,
    'crew-confidential'::text,
    'vessel-technical'::text,
    'passage-media'::text,
    'exports'::text
  ])
  and private.is_workspace_member(private.storage_workspace_id(name))
  and (
    (
      bucket_id = any (array['atlas-documents'::text, 'nautical-publications'::text])
      and private.has_workspace_role(
        private.storage_workspace_id(name),
        array['owner'::workspace_role, 'developer'::workspace_role]
      )
    )
    or
    (
      bucket_id <> all (array['atlas-documents'::text, 'nautical-publications'::text])
      and (
        (
          bucket_id = 'crew-confidential'::text
          and private.has_workspace_role(
            private.storage_workspace_id(name),
            array[
              'owner'::workspace_role,
              'administrator'::workspace_role,
              'captain'::workspace_role,
              'chief_officer'::workspace_role,
              'dpa'::workspace_role,
              'auditor'::workspace_role
            ]
          )
        )
        or
        (
          bucket_id <> 'crew-confidential'::text
          and (
            private.has_workspace_role(
              private.storage_workspace_id(name),
              array[
                'owner'::workspace_role,
                'administrator'::workspace_role,
                'captain'::workspace_role,
                'chief_officer'::workspace_role,
                'chief_engineer'::workspace_role,
                'dpa'::workspace_role,
                'auditor'::workspace_role
              ]
            )
            or exists (
              select 1
              from public.documents d
              where d.workspace_id = private.storage_workspace_id(objects.name)
                and d.bucket_id = objects.bucket_id
                and d.object_path = objects.name
                and d.status = 'active'::document_status
                and d.classification = 'standard'::classification_level
                and d.deleted_at is null
            )
          )
        )
      )
    )
  )
);
