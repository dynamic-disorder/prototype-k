```markdown
# CLI Library Recommendation: Spectre.Console

## Why Spectre.Console
For "Claude Code style" rich terminal UX in .NET hobby projects.

## Installation
```bash
dotnet add package Spectre.Console
```

## Key Features for Your Use Case

### 1. Argument Parsing
```csharp
using Spectre.Console.Cli;

class Settings : CommandSettings
{
    [CommandOption("-n|--name")]
    public string Name { get; set; }
}

class MyCommand : Command<Settings>
{
    public override int Execute(CommandContext context, Settings settings)
    {
        AnsiConsole.MarkupLine($"[green]Hello, {settings.Name ?? "world"}![/]");
        return 0;
    }
}

// In Main
var app = new CommandApp<MyCommand>();
return app.Run(args);
```

### 2. Colorful Output
```csharp
AnsiConsole.Markup("[bold red]Error![/] [blue]Info[/]");
AnsiConsole.Write(new FigletText("Hello"));
```

### 3. Interactive Prompts
```csharp
var name = AnsiConsole.Ask<string>("What's your [green]name[/]?");
var choice = AnsiConsole.Prompt(
    new SelectionPrompt<string>()
        .Title("Select [blue]option[/]:")
        .AddChoices("Option1", "Option2"));
```

### 4. Live Status Display
```csharp
await AnsiConsole.Status()
    .StartAsync("Working...", async ctx =>
    {
        ctx.Status("Step 1");
        await Task.Delay(1000);
        ctx.Status("Step 2");
        await Task.Delay(1000);
    });
```

### 5. Tables & Layouts
```csharp
var table = new Table();
table.AddColumn("Name");
table.AddColumn("Value");
table.AddRow("Key", "Value");
AnsiConsole.Write(table);
```

## Alternative: Terminal.Gui
- For full TUI (windows, buttons, mouse)
- Install: `dotnet add package Terminal.Gui`

## Alternative: Gui.cs
- Lightweight UI toolkit
- Install: `dotnet add package Gui.cs`

## Bottom Line
Start with **Spectre.Console** for 90% of "Claude Code style" needs. Only switch to Terminal.Gui if you need complex multi-window interfaces.
```
