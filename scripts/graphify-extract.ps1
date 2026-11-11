#Requires -Version 5.1
param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string]$LmStudioUrl = "http://localhost:1234/v1",
    [string]$Model = "qwen/qwen3.5-9b",
    [int]$MaxConcurrency = 1,
    [int]$TokenBudget = 4000,
    [switch]$SkipExtract,
    [switch]$SkipCluster,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Test-LmStudio {
    param([string]$BaseUrl)
    try {
        $modelsUrl = ($BaseUrl.TrimEnd("/")) + "/models"
        $null = Invoke-RestMethod -Uri $modelsUrl -Method Get -TimeoutSec 5
        return $true
    }
    catch {
        return $false
    }
}

function Invoke-Graphify {
    param([string[]]$GraphifyArgs)
    $env:PYTHONHASHSEED = "0"
    & graphify @GraphifyArgs
    if ($LASTEXITCODE -ne 0) {
        throw "graphify failed (exit $LASTEXITCODE): graphify $($GraphifyArgs -join ' ')"
    }
}

if (-not (Get-Command graphify -ErrorAction SilentlyContinue)) {
    throw "graphify not found on PATH. Install with: uv tool install `"graphifyy[openai]`" --force"
}

Push-Location $ProjectRoot
try {
    $env:OPENAI_API_KEY = if ($env:OPENAI_API_KEY) { $env:OPENAI_API_KEY } else { "local" }
    $env:OPENAI_BASE_URL = $LmStudioUrl
    $env:OPENAI_MODEL = $Model

    Write-Host "Project:       $ProjectRoot"
    Write-Host "LM Studio:     $LmStudioUrl"
    Write-Host "Model:         $Model"
    Write-Host "Concurrency:   $MaxConcurrency"
    Write-Host "Token budget:  $TokenBudget"
    Write-Host "PYTHONHASHSEED=0 (Windows re-exec workaround)"
    Write-Host ""

    if (-not (Test-LmStudio -BaseUrl $LmStudioUrl)) {
        throw "LM Studio is not reachable at $LmStudioUrl. Start the local server and load a model first."
    }

    if (-not $SkipExtract) {
        $extractArgs = @(
            "extract", ".",
            "--backend", "openai",
            "--max-concurrency", "$MaxConcurrency",
            "--token-budget", "$TokenBudget"
        )
        if ($Force) {
            $extractArgs += "--force"
        }

        Write-Host "==> graphify extract"
        Invoke-Graphify -GraphifyArgs $extractArgs
        Write-Host ""
    }

    if (-not $SkipCluster) {
        Write-Host "==> graphify cluster-only (report + community labels)"
        Invoke-Graphify -GraphifyArgs @("cluster-only", ".")
        Write-Host ""
    }

    $graphPath = Join-Path $ProjectRoot "graphify-out\graph.json"
    $reportPath = Join-Path $ProjectRoot "graphify-out\GRAPH_REPORT.md"
    if (Test-Path $graphPath) {
        Write-Host "Done."
        Write-Host "  graph:   $graphPath"
        if (Test-Path $reportPath) {
            Write-Host "  report:  $reportPath"
        }
        Write-Host ""
        Write-Host "Query examples:"
        Write-Host "  graphify query `"How does transaction classification work?`""
        Write-Host "  graphify path `"AuthModule`" `"Database`""
    }
}
finally {
    Pop-Location
}
