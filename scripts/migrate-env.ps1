param(
    [Parameter(Mandatory = $true)]
    [string]$SourceRoot,

    [string]$DestinationRoot = (Split-Path -Parent $PSScriptRoot),

    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-Directory([string]$Path, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "$Label 폴더를 찾을 수 없습니다: $Path"
    }
    return (Resolve-Path -LiteralPath $Path).Path
}

function Read-EnvFile([string]$Path) {
    $values = @{}
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $values
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
            $values[$matches[1]] = $matches[2]
        }
    }
    return $values
}

function Get-TemplateKeys([string]$TemplatePath) {
    $keys = @{}
    foreach ($line in Get-Content -LiteralPath $TemplatePath) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') {
            $keys[$matches[1]] = $true
        }
    }
    return $keys
}

function Select-KnownValues([string]$TemplatePath, [hashtable]$SourceValues) {
    $selected = @{}
    $known = Get-TemplateKeys $TemplatePath
    foreach ($key in $SourceValues.Keys) {
        if ($known.ContainsKey($key)) {
            $selected[$key] = $SourceValues[$key]
        }
    }
    return $selected
}

function Set-FromAlias(
    [hashtable]$Target,
    [string]$TargetKey,
    [hashtable]$Source,
    [string[]]$SourceKeys
) {
    if ($Target.ContainsKey($TargetKey) -and -not [string]::IsNullOrWhiteSpace($Target[$TargetKey])) {
        return
    }
    foreach ($sourceKey in $SourceKeys) {
        if ($Source.ContainsKey($sourceKey) -and -not [string]::IsNullOrWhiteSpace($Source[$sourceKey])) {
            $Target[$TargetKey] = $Source[$sourceKey]
            return
        }
    }
}

function Write-EnvFromTemplate(
    [string]$TemplatePath,
    [string]$DestinationPath,
    [hashtable]$Values,
    [bool]$Overwrite
) {
    if ((Test-Path -LiteralPath $DestinationPath) -and -not $Overwrite) {
        throw "대상 파일이 이미 있습니다: $DestinationPath (`-Force`로 백업 후 교체)"
    }

    if (Test-Path -LiteralPath $DestinationPath) {
        $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $backup = "$DestinationPath.backup-$stamp"
        Copy-Item -LiteralPath $DestinationPath -Destination $backup
        Write-Host "기존 파일 백업: $backup"
    }

    $output = foreach ($line in Get-Content -LiteralPath $TemplatePath) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') {
            $key = $matches[1]
            if ($Values.ContainsKey($key)) {
                "$key=$($Values[$key])"
                continue
            }
        }
        $line
    }
    Set-Content -LiteralPath $DestinationPath -Value $output -Encoding utf8
    Write-Host "환경설정 생성: $DestinationPath"
}

$source = Resolve-Directory $SourceRoot "기존 프로젝트"
$destination = Resolve-Directory $DestinationRoot "새 프로젝트"
if ($source -eq $destination) {
    throw "기존 프로젝트와 새 프로젝트 경로가 같습니다."
}

$serverTemplate = Join-Path $destination "server/.env.example"
$scenarioTemplate = Join-Path $destination "services/scenario-server/.env.example"
$marketTemplate = Join-Path $destination "services/market-reaction/.env.example"
$judgmentTemplate = Join-Path $destination "services/ai-judgment-service/.env.example"

$serverSource = Read-EnvFile (Join-Path $source "server/.env")
$scenarioSource = Read-EnvFile (Join-Path $source "services/scenario-server/.env")
$judgmentSource = Read-EnvFile (Join-Path $source "services/ai-judgment-service/.env")
$marketSource = Read-EnvFile (Join-Path $source "services/market-reaction/.env")
if ($marketSource.Count -eq 0) {
    $marketSource = Read-EnvFile (Join-Path $source "simulator/market_reaction/.env")
}

if ($serverSource.Count -eq 0) {
    throw "기존 server/.env를 찾지 못했습니다: $source"
}

$serverValues = Select-KnownValues $serverTemplate $serverSource
Set-FromAlias $serverValues "STOTRA_NAVER_CLIENT_ID" $serverSource @("NAVER_CLIENT_ID")
Set-FromAlias $serverValues "STOTRA_NAVER_CLIENT_SECRET" $serverSource @("NAVER_CLIENT_SECRET")

$scenarioValues = Select-KnownValues $scenarioTemplate $scenarioSource
Set-FromAlias $scenarioValues "KIS_APP_KEY" $serverSource @("STOTRA_KIS_APP_KEY")
Set-FromAlias $scenarioValues "KIS_APP_SECRET" $serverSource @("STOTRA_KIS_APP_SECRET")
Set-FromAlias $scenarioValues "KIS_ENV" $serverSource @("STOTRA_KIS_ENV")

$judgmentValues = Select-KnownValues $judgmentTemplate $judgmentSource
Set-FromAlias $judgmentValues "KIS_APP_KEY" $serverSource @("STOTRA_KIS_APP_KEY")
Set-FromAlias $judgmentValues "KIS_APP_SECRET" $serverSource @("STOTRA_KIS_APP_SECRET")

$marketValues = Select-KnownValues $marketTemplate $marketSource
foreach ($key in @(
    "STOTRA_MONGODB_USERNAME",
    "STOTRA_MONGODB_PASSWORD",
    "STOTRA_MONGODB_CLUSTER",
    "MONGO_DB_NAME"
)) {
    Set-FromAlias $marketValues $key $serverSource @($key)
}
Set-FromAlias $marketValues "DART_API_KEY" $serverSource @("STOTRA_DART_API_KEY")
Set-FromAlias $marketValues "OLLAMA_HOST" $serverSource @("OLLAMA_BASE_URL", "STOTRA_LLM_BASE_URL")
Set-FromAlias $marketValues "OLLAMA_MODEL" $serverSource @("STOTRA_LLM_MODEL", "OLLAMA_ASSET_MODEL")

Write-EnvFromTemplate $serverTemplate (Join-Path $destination "server/.env") $serverValues $Force.IsPresent
Write-EnvFromTemplate $scenarioTemplate (Join-Path $destination "services/scenario-server/.env") $scenarioValues $Force.IsPresent
Write-EnvFromTemplate $marketTemplate (Join-Path $destination "services/market-reaction/.env") $marketValues $Force.IsPresent
Write-EnvFromTemplate $judgmentTemplate (Join-Path $destination "services/ai-judgment-service/.env") $judgmentValues $Force.IsPresent

Write-Host "완료: Gemini/OpenAI, 군 급여, 커뮤니티 전용 변수는 옮기지 않았습니다."
Write-Host "비밀값은 출력하지 않았으며 생성된 .env 파일은 Git에서 제외됩니다."
