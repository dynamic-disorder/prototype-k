# PowerShell script to update all .csproj files for CPM

$projects = @(
    "..\AddEntryApp\AddEntryApp.csproj",
    "..\OllamaTranslatorApp\OllamaTranslatorApp.csproj", 
    "..\TextFileSplitterApp\TextFileSplitterApp.csproj",
    "..\OllamaTranslatorApi.Tests\OllamaTranslatorApi.Tests.csproj",
    "..\TranslationTools.Tests\TranslationTools.Tests.csproj"
)

foreach ($project in $projects) {
    $fullPath = Join-Path $PSScriptRoot $project
    Write-Host "Processing: $project"
    
    $content = Get-Content $fullPath -Raw
    
    # Remove existing TargetFramework, ImplicitUsings, Nullable if they exist
    $content = $content -replace '(?s)<PropertyGroup>.*?<TargetFramework>.*?</TargetFramework>.*?</PropertyGroup>', '<PropertyGroup>'
    $content = $content -replace '(?s)<PropertyGroup>.*?<ImplicitUsings>.*?</ImplicitUsings>.*?</PropertyGroup>', '<PropertyGroup>'
    $content = $content -replace '(?s)<PropertyGroup>.*?<Nullable>.*?</Nullable>.*?</PropertyGroup>', '<PropertyGroup>'
    
    # Clean up empty PropertyGroup tags
    $content = $content -replace '<PropertyGroup>\s*</PropertyGroup>', ''
    
    # Add Import statement after Project tag
    if ($content -match '(<Project Sdk="Microsoft\.NET\.Sdk">)') {
        $content = $content -replace '(<Project Sdk="Microsoft\.NET\.Sdk">)', "`$1`n  <Import Project=`"../Directory.Build.props`" />"
    }
    
    # Remove package versions (keep PackageReference entries)
    $content = $content -replace '<PackageReference Include="([^"]+)" Version="[^"]+"\s*/>', '<PackageReference Include="$1" />'
    
    # For TTS projects, we need special handling but only TextToSpeechApp is TTS
    
    # Save the file
    Set-Content -Path $fullPath -Value $content -Encoding UTF8
    Write-Host "  Updated: $project"
}

Write-Host "All projects updated for CPM!"