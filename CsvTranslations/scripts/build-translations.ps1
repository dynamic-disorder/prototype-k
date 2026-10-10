#!/usr/bin/env pwsh
<#
.SYNOPSIS
Build script for translations_csv projects with proper PowerShell syntax.

.DESCRIPTION
This script builds the translations_csv projects using proper PowerShell syntax
that works with both Windows PowerShell (5.1) and PowerShell 7+.
It avoids the '&&' operator which causes errors in Windows PowerShell.

.PARAMETER Project
Specific project to build (default: all)

.PARAMETER Configuration
Build configuration (Debug or Release, default: Debug)

.PARAMETER Clean
Clean before building

.PARAMETER Test
Run tests after building

.EXAMPLE
.\build-translations.ps1
Build all projects in Debug configuration

.EXAMPLE
.\build-translations.ps1 -Project OllamaTranslatorApi -Configuration Release -Test
Build only OllamaTranslatorApi in Release configuration and run tests
#>

[CmdletBinding()]
param(
    [ValidateSet("All", "OllamaTranslatorApi", "OllamaTranslatorApp", "TranslationTools")]
    [string]$Project = "All",
    
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Debug",
    
    [switch]$Clean,
    
    [switch]$Test
)

$ErrorActionPreference = "Stop"
$currentDir = $PSScriptRoot
$translationsDir = Join-Path $currentDir ".."
$translationsDir = (Resolve-Path -Path $translationsDir -ErrorAction Stop).Path

Write-Host "Building translations_csv projects..." -ForegroundColor Green
Write-Host "Project: $Project" -ForegroundColor Cyan
Write-Host "Configuration: $Configuration" -ForegroundColor Cyan
Write-Host "Working directory: $translationsDir" -ForegroundColor Gray

# Change to the translations directory
Set-Location -Path $translationsDir

# Clean if requested
if ($Clean) {
    Write-Host "Cleaning solution..." -ForegroundColor Yellow
    dotnet clean translations_csv.sln --configuration $Configuration
    
    if (-not $?) {
        Write-Error "Clean failed"
        exit 1
    }
}

# Restore packages
Write-Host "Restoring packages..." -ForegroundColor Yellow
dotnet restore translations_csv.sln

if (-not $?) {
    Write-Error "Restore failed"
    exit 1
}

# Build based on project selection
switch ($Project) {
    "All" {
        Write-Host "Building all projects..." -ForegroundColor Yellow
        dotnet build translations_csv.sln --configuration $Configuration --no-restore
    }
    "OllamaTranslatorApi" {
        Write-Host "Building OllamaTranslatorApi..." -ForegroundColor Yellow
        dotnet build OllamaTranslatorApi/OllamaTranslatorApi.csproj --configuration $Configuration --no-restore
    }
    "OllamaTranslatorApp" {
        Write-Host "Building OllamaTranslatorApp..." -ForegroundColor Yellow
        dotnet build OllamaTranslatorApp/OllamaTranslatorApp.csproj --configuration $Configuration --no-restore
    }
    "TranslationTools" {
        Write-Host "Building TranslationTools..." -ForegroundColor Yellow
        dotnet build TranslationTools/TranslationTools.csproj --configuration $Configuration --no-restore
    }
}

if (-not $?) {
    Write-Error "Build failed"
    exit 1
}

Write-Host "Build completed successfully!" -ForegroundColor Green

# Run tests if requested
if ($Test) {
    Write-Host "Running tests..." -ForegroundColor Yellow
    
    switch ($Project) {
        "All" {
            dotnet test translations_csv.sln --configuration $Configuration --no-build
        }
        "OllamaTranslatorApi" {
            dotnet test OllamaTranslatorApi.Tests/OllamaTranslatorApi.Tests.csproj --configuration $Configuration --no-build
        }
        "OllamaTranslatorApp" {
            # OllamaTranslatorApp doesn't have tests, skip
            Write-Host "OllamaTranslatorApp doesn't have tests, skipping..." -ForegroundColor Gray
        }
        "TranslationTools" {
            dotnet test TranslationTools.Tests/TranslationTools.Tests.csproj --configuration $Configuration --no-build
        }
    }
    
    if (-not $?) {
        Write-Error "Tests failed"
        exit 1
    }
    
    Write-Host "Tests completed successfully!" -ForegroundColor Green
}

Write-Host "Script completed successfully!" -ForegroundColor Green