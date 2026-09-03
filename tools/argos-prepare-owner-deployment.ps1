param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$output=[IO.Path]::GetFullPath($OutputDirectory)
if (-not $output.StartsWith((Join-Path $root 'tmp')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'WORKSPACE_TEMP_OUTPUT_REQUIRED' }
if (Test-Path -LiteralPath $output) { throw 'FRESH_DEPLOYMENT_DIRECTORY_REQUIRED' }
New-Item -ItemType Directory -Path $output | Out-Null
$files=@('20260829_founder_owner_step_up.sql','20260903_founder_owner_atomic_issuance.sql','20260903000100_founder_owner_consumption_lock.sql','20260903000200_founder_owner_consumption_expiry.sql','20260903000300_argos_bridge_identity.sql')
$owner='de35f9f8-3361-4af1-81ac-3be27c32f4d4';$workspace='3bf379f2-56c7-4687-84f8-e5537fcb7aad';$instance=[guid]::NewGuid().ToString()
$random=[byte[]]::new(32);$rng=[Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($random) } finally { $rng.Dispose() }
$credential=([BitConverter]::ToString($random)).Replace('-','').ToLowerInvariant()
$secure=ConvertTo-SecureString -String $credential -AsPlainText -Force
try { $sealed=ConvertFrom-SecureString $secure } finally { $secure.Dispose() }
$sha=[Security.Cryptography.SHA256]::Create()
try { $credentialHash=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($credential)))).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose();$credential=$null;[Array]::Clear($random,0,$random.Length) }
$config=@{schemaVersion='sinbad-argos-bridge-owner/1';instanceId=$instance;workspaceId=$workspace;projectUrl='https://kcvyftrvteqmabvxfebu.supabase.co';publishableKey='sb_publishable_ZBHFlbhQAnhUAOyVg20Szw_nW0QDj_l';protectedCredential=$sealed}
$utf8=[Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText((Join-Path $output 'bridge-owner.json'),($config | ConvertTo-Json),$utf8)
$sql=@"
begin;
set local lock_timeout='10s';
do `$guard`$ begin
 if to_regclass('public.founder_principals') is not null or to_regclass('public.argos_bridge_instances') is not null then raise exception 'EXPECTED_FIRST_ARGOS_DEPLOYMENT'; end if;
 if not exists(select 1 from public.workspace_members m join auth.users u on u.id=m.user_id where m.user_id='$owner' and m.workspace_id='$workspace' and m.role='owner' and m.is_active=true and u.email_confirmed_at is not null) then raise exception 'VERIFIED_OWNER_BINDING_CHANGED'; end if;
end `$guard`$;
"@
$manifest=@()
foreach($file in $files){
 $source=Join-Path $root ('supabase\migrations\'+$file)
 $text=[IO.File]::ReadAllText($source)
 $sql+="`n-- SOURCE: $file`n"+$text
 $manifest+=@{path=('supabase/migrations/'+$file);sha256=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$sql+=@"

insert into public.founder_principals(user_id,activated_at) values ('$owner',clock_timestamp());
insert into public.founder_security_audit(principal_user_id,event_type,action,resource_type,resource_id,details) values ('$owner','principal_seeded','identity.founder.enroll','auth_user','$owner','{"authorization":"Owner standing completion approval; verified existing Auth UUID and active workspace Owner"}'::jsonb);
insert into public.argos_bridge_instances(id,workspace_id,owner_user_id,credential_hash) values ('$instance','$workspace','$owner','$credentialHash');
commit;
select 'ARGOS_OWNER_SCHEMA_INSTALLED' as status;
"@
[IO.File]::WriteAllText((Join-Path $output 'install.sql'),$sql,$utf8)
[IO.File]::WriteAllText((Join-Path $output 'manifest.json'),(@{projectRef='kcvyftrvteqmabvxfebu';instanceId=$instance;files=$manifest;installSha256=(Get-FileHash -LiteralPath (Join-Path $output 'install.sql') -Algorithm SHA256).Hash.ToLowerInvariant();rollback='Before clients are released, suspend the new founder and Bridge registration. Retain audit records; do not drop shared user tables.'} | ConvertTo-Json -Depth 6),$utf8)
Write-Output ('OWNER_DEPLOYMENT_PREPARED '+$output)
