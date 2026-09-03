function Select-SinbadModelTier {
  param(
    [Parameter(Mandatory=$true)][string]$Question,
    [int]$HistoryCount = 0,
    [int]$EvidenceLength = 0,
    [string]$RequestedDepth = '',
    [string]$FastModel = 'qwen3:4b',
    [string]$DeepModel = 'qwen3:14b',
    [string[]]$AvailableModels = @()
  )

  $reasons = [Collections.Generic.List[string]]::new()
  $complexityScore = 0
  if ($RequestedDepth -match '^(?i:deep|derin|thorough|expert)$') { $reasons.Add('explicit-deep-request'); $complexityScore += 3 }
  if ($Question.Length -ge 420) { $reasons.Add('long-question'); $complexityScore++ }
  if ($HistoryCount -ge 8) { $reasons.Add('long-conversation'); $complexityScore++ }
  if ($EvidenceLength -ge 6000) { $reasons.Add('large-evidence-set'); $complexityScore++ }
  if ($Question -match '(?i)(derin(?:lemesine)?|ayrıntılı|detaylı|karşılaştır|analiz|kanıtla|eleştir|mimari|algoritma|debug|hata ayıkla|hukuki değerlendirme|risk değerlendirmesi|passage plan|rota planı|stability|seakeeping|compare|analyse|analyze|architecture|algorithm|prove|critique|legal assessment|risk assessment|ausführlich|analysiere|vergleiche)') {
    $reasons.Add('complex-intent')
    $complexityScore += 2
  }

  $tier = if ($complexityScore -ge 2) { 'deep' } else { 'fast' }
  $preferred = if ($tier -eq 'deep') { $DeepModel } else { $FastModel }
  $fallbackUsed = $false
  $selected = $preferred
  if ($AvailableModels.Count -gt 0 -and $AvailableModels -notcontains $selected) {
    $alternative = if ($tier -eq 'deep') { $FastModel } else { $DeepModel }
    if ($AvailableModels -contains $alternative) { $selected = $alternative; $fallbackUsed = $true; $reasons.Add('preferred-model-unavailable') }
  }
  if (-not $reasons.Count) { $reasons.Add('default-fast-path') }

  [pscustomobject]@{
    tier = $tier
    model = $selected
    preferredModel = $preferred
    fallbackUsed = $fallbackUsed
    complexityScore = $complexityScore
    reasons = @($reasons)
  }
}
