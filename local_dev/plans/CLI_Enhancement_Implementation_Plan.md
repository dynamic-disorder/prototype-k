# CLI Enhancement & CPM Implementation Plan

## Overview
This plan outlines the implementation of Central Package Management (CPM) and enhanced CLI utilities using Spectre.Console with a wrapper library approach for the translations_csv solution.

## Phase 1: Central Package Management (CPM)

### 1.1 Create Directory.Packages.props
Location: `translations_csv/Directory.Packages.props`
```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
    <CentralPackageTransitivePinningEnabled>true</CentralPackageTransitivePinningEnabled>
  </PropertyGroup>
  
  <ItemGroup>
    <!-- Core .NET packages -->
    <PackageVersion Include="Microsoft.Extensions.Logging" Version="10.0.3" />
    <PackageVersion Include="Microsoft.Extensions.DependencyInjection" Version="10.0.3" />
    
    <!-- CSV and Data -->
    <PackageVersion Include="CsvHelper" Version="33.1.0" />
    <PackageVersion Include="Newtonsoft.Json" Version="13.0.4" />
    
    <!-- CLI Enhancements -->
    <PackageVersion Include="Spectre.Console" Version="0.49.1" />
    <PackageVersion Include="Spectre.Console.Cli" Version="0.49.1" />
    
    <!-- Testing (if needed) -->
    <PackageVersion Include="Microsoft.NET.Test.Sdk" Version="17.12.0" />
    <PackageVersion Include="xunit" Version="2.9.2" />
    <PackageVersion Include="xunit.runner.visualstudio" Version="2.8.2" />
    <PackageVersion Include="Shouldly" Version="4.3.0" />
    <PackageVersion Include="NSubstitute" Version="5.3.0" />
  </ItemGroup>
</Project>
```

### 1.2 Create Directory.Build.props
Location: `translations_csv/Directory.Build.props`
```xml
<Project>
  <PropertyGroup>
    <!-- Common build properties -->
    <TargetFramework>net9.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <TreatWarningsAsErrors>false</TreatWarningsAsErrors>
    <WarningsNotAsErrors>NU1605</WarningsNotAsErrors>
    
    <!-- Code analysis -->
    <EnableNETAnalyzers>true</EnableNETAnalyzers>
    <AnalysisMode>Recommended</AnalysisMode>
    
    <!-- Source linking -->
    <PublishRepositoryUrl>true</PublishRepositoryUrl>
    <EmbedUntrackedSources>true</EmbedUntrackedSources>
    <IncludeSymbols>true</IncludeSymbols>
    <SymbolPackageFormat>snupkg</SymbolPackageFormat>
  </PropertyGroup>
  
  <ItemGroup>
    <PackageReference Include="Microsoft.SourceLink.GitHub" Version="8.0.0" PrivateAssets="All" />
  </ItemGroup>
</Project>
```

### 1.3 Create Directory.Build.TTS.props
Location: `translations_csv/Directory.Build.TTS.props`
```xml
<Project>
  <Import Project="Directory.Build.props" />
  
  <PropertyGroup>
    <!-- Override for Windows TTS projects -->
    <TargetFramework>net9.0-windows10.0.19041.0</TargetFramework>
    <UseWinRT>true</UseWinRT>
    <RuntimeIdentifier>win-x64</RuntimeIdentifier>
  </PropertyGroup>
</Project>
```

### 1.4 Update Project Files
For each .csproj:
1. Remove explicit `PackageReference` versions (keep PackageReference entries)
2. Add `Import` for appropriate props file
3. For TextToSpeechApp: use `Directory.Build.TTS.props`

Example update for a standard project:
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <!-- Remove individual properties now in Directory.Build.props -->
  <Import Project="../Directory.Build.props" />
  
  <PropertyGroup>
    <!-- Project-specific properties only -->
    <OutputType>Exe</OutputType>
    <RootNamespace>MyNamespace</RootNamespace>
  </PropertyGroup>
  
  <ItemGroup>
    <!-- Package references without versions -->
    <PackageReference Include="CsvHelper" />
    <PackageReference Include="Microsoft.Extensions.Logging" />
  </ItemGroup>
</Project>
```

## Phase 2: CLI Utilities Library

### 2.1 Create New Project
Location: `translations_csv/CliUtils/CliUtils.csproj`
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <Import Project="../Directory.Build.props" />
  
  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <RootNamespace>CliUtils</RootNamespace>
    <AssemblyName>CliUtils</AssemblyName>
  </PropertyGroup>
  
  <ItemGroup>
    <PackageReference Include="Spectre.Console" />
    <PackageReference Include="Spectre.Console.Cli" />
  </ItemGroup>
  
  <ItemGroup>
    <ProjectReference Include="../TranslationTools/TranslationTools.csproj" />
  </ItemGroup>
</Project>
```

### 2.2 Core Components

#### ConsoleHelper.cs (Backward Compatibility)
```csharp
namespace CliUtils;

/// <summary>
/// Provides backward-compatible ConsoleColorHelper methods using Spectre.Console internally
/// </summary>
public static class ConsoleHelper
{
    // Existing ConsoleColorHelper methods
    public static void WriteSuccess(string message) { /* Spectre.Console implementation */ }
    public static void WriteError(string message) { /* Spectre.Console implementation */ }
    public static void WriteWarning(string message) { /* Spectre.Console implementation */ }
    public static void WriteInfo(string message) { /* Spectre.Console implementation */ }
    public static void WriteTranslation(int counter, int total, string source, string target) { /* Enhanced implementation */ }
    public static void WriteFileResult(string result) { /* Enhanced implementation */ }
}
```

#### RichConsole.cs (New Features)
```csharp
namespace CliUtils;

/// <summary>
/// Enhanced console features using Spectre.Console
/// </summary>
public static class RichConsole
{
    // Tables
    public static void WriteTable<T>(IEnumerable<T> items, params string[] columns);
    
    // Progress
    public static Task WithProgressAsync(string title, Func<IProgressContext, Task> action);
    
    // Prompts
    public static T Ask<T>(string prompt, T defaultValue = default);
    public static string Select(string title, params string[] options);
    
    // Status
    public static Task WithStatusAsync(string message, Func<StatusContext, Task> action);
    
    // Panels and Layouts
    public static void WritePanel(string content, string header = null);
    
    // Live displays
    public static IDisposable CreateLiveDisplay(Action<LiveDisplayContext> updateAction);
}
```

#### CommandLineParser.cs (Spectre.Console.Cli wrapper)
```csharp
namespace CliUtils;

/// <summary>
/// Simplified command-line parsing
/// </summary>
public static class CommandLine
{
    public static Task<int> RunAsync<TCommand>(string[] args) 
        where TCommand : class, ICommand;
    
    public static void ConfigureApp(Action<IConfigurator> config);
}
```

### 2.3 Migration Strategy

#### Step 1: Add CliUtils project reference to existing projects
```xml
<ItemGroup>
  <ProjectReference Include="..\CliUtils\CliUtils.csproj" />
</ItemGroup>
```

#### Step 2: Update using statements
Replace `using TranslationTools;` with `using CliUtils;` where ConsoleColorHelper is used.

#### Step 3: Gradual feature adoption
- Start with backward-compatible ConsoleHelper methods
- Gradually replace with RichConsole for new features
- Update command-line parsing in executable projects

## Phase 3: Project Updates

### 3.1 Update Solution
Add CliUtils project to translations_csv.sln.

### 3.2 Update Project Dependencies
1. **TranslationTools**: Reference CliUtils (optional, for internal use)
2. **OllamaTranslatorApi**: Reference CliUtils (replaces TranslationTools for console utilities)
3. **Executable projects (AddEntryApp, OllamaTranslatorApp, TextFileSplitterApp)**: Reference CliUtils
4. **TextToSpeechApp**: Reference CliUtils with TTS props

### 3.3 Example Migration: OllamaTranslator.cs
Before:
```csharp
using TranslationTools;

ConsoleColorHelper.WriteWarning("Warning message");
ConsoleColorHelper.WriteTranslation(counter, total, source, target);
```

After:
```csharp
using CliUtils;

ConsoleHelper.WriteWarning("Warning message"); // Backward compatible
RichConsole.WriteTranslation(counter, total, source, target); // Enhanced version
```

## Phase 4: Enhanced Features Implementation

### 4.1 Progress Reporting
Replace current counter-based output with Spectre.Console progress bars:
```csharp
// Current
ConsoleColorHelper.WriteTranslation(counter, total, sourceText, targetText);

// Enhanced
await RichConsole.WithProgressAsync("Translating...", async ctx =>
{
    var task = ctx.AddTask("Translating", maxValue: total);
    foreach (var entry in entries)
    {
        // Translation logic
        task.Increment(1);
        RichConsole.WriteTranslation(entry.SourceText, entry.TargetText);
    }
});
```

### 4.2 Interactive Prompts
Add interactive features to CLI tools:
```csharp
// Current: Hardcoded file paths
// Enhanced: Interactive selection
var inputFile = RichConsole.Select("Select input file:", 
    Directory.GetFiles(".", "*.csv"));
    
var model = RichConsole.Ask("Select model:", "default");
```

### 4.3 Improved Output Formatting
```csharp
// Tables for batch results
var tableData = translatedEntries.Select(e => new 
{ 
    Source = e.SourceText, 
    Translation = e.TargetText 
});
RichConsole.WriteTable(tableData, "Source", "Translation");
```

## Phase 5: Testing and Validation

### 5.1 Build Verification
1. Ensure all projects compile with CPM
2. Verify backward compatibility
3. Test TextToSpeechApp with TTS-specific props

### 5.2 Functionality Testing
1. Console output colors and formatting
2. Progress reporting
3. Interactive prompts
4. Command-line parsing

### 5.3 Performance Testing
1. Verify no significant overhead from Spectre.Console
2. Test large batch translations with progress reporting

## Implementation Timeline

### Week 1: CPM Foundation
1. Create props files
2. Update project files
3. Test builds

### Week 2: CliUtils Library
1. Create project and core components
2. Implement backward compatibility
3. Add new features

### Week 3: Migration
1. Update project references
2. Migrate ConsoleColorHelper usage
3. Test individual projects

### Week 4: Enhanced Features
1. Add progress reporting
2. Implement interactive prompts
3. Update command-line interfaces

### Week 5: Testing & Polish
1. Comprehensive testing
2. Performance verification
3. Documentation updates

## Risk Mitigation

### Backward Compatibility
- ConsoleHelper maintains exact same API as ConsoleColorHelper
- Gradual migration allows testing at each step
- Fallback to basic console output if Spectre.Console fails

### Build System
- CPM changes made incrementally
- Git commits after each successful build
- Rollback plan for props files

### Windows TTS Compatibility
- Separate props file for Windows-specific requirements
- Test on Windows 10 environment
- Maintain existing UseWinRT and RID settings

## Success Criteria

1. All projects build successfully with CPM
2. No breaking changes to existing functionality
3. Enhanced CLI features available for adoption
4. TextToSpeechApp continues to work on Windows
5. Performance equal to or better than current implementation

## Next Steps

1. **Toggle to Act Mode** to begin implementation
2. Start with Phase 1 (CPM foundation)
3. Progress through each phase with testing at each step
4. Provide status updates after each major milestone