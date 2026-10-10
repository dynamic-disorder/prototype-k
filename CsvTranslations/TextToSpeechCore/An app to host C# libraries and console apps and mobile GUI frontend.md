An app to host C# libraries and console apps and mobile GUI frontend.

Pragmatic with **pure DI in MAUI** + **tiny static factory in console apps** gives clean dependency flow, easy mocking later if needed, almost zero ceremony, and no Clean Architecture overhead.

Here’s a concrete, minimal implementation you can copy-paste and adapt right now.

### 1. The shared interface (already decided)

```csharp
// TextToSpeechCore/ITtsService.cs
namespace TextToSpeechCore;

public interface ITtsService
{
    Task SpeakAsync(
        string text,
        string? voiceName = null,
        double rate   = 1.0,
        double volume = 1.0
    );

    IReadOnlyList<string> GetAvailableVoices();
}
```

### 2. Concrete implementations (as before)

```csharp
// TextToSpeechCore/WindowsSapiTtsService.cs
#if WINDOWS
using System.Speech.Synthesis;

public class WindowsSapiTtsService : ITtsService
{
    private readonly SpeechSynthesizer _synthesizer = new();

    public IReadOnlyList<string> GetAvailableVoices()
        => _synthesizer.GetInstalledVoices()
                       .Select(v => v.VoiceInfo.Name)
                       .ToList()
                       .AsReadOnly();

    public async Task SpeakAsync(string text, string? voiceName = null, double rate = 1.0, double volume = 1.0)
    {
        if (!string.IsNullOrEmpty(voiceName))
            _synthesizer.SelectVoice(voiceName);

        _synthesizer.Rate   = (int)Math.Clamp(rate * 10 - 10, -10, 10);
        _synthesizer.Volume = (int)(volume * 100);

        await Task.Run(() => _synthesizer.Speak(text));
    }
}
#endif
```

```csharp
// TextToSpeechCore/MauiTtsService.cs
#if MAUI
using Microsoft.Maui.Media;

public class MauiTtsService : ITtsService
{
    public async Task SpeakAsync(string text, string? voiceName = null, double rate = 1.0, double volume = 1.0)
    {
        var options = new SpeechOptions
        {
            Volume = (float)Math.Clamp(volume, 0.0, 1.0),
            // No reliable rate control in current MAUI TTS → ignored or approximated via pitch if needed later
        };

        await TextToSpeech.Default.SpeakAsync(text, options);
    }

    public async Task<IReadOnlyList<string>> GetAvailableVoices()
    {
        var locales = await TextToSpeech.Default.GetLocalesAsync();
        return locales
            .Select(l => $"{l.Language} – {l.Name ?? l.Country ?? "Default"}")
            .Distinct()
            .OrderBy(x => x)
            .ToList();
    }
}
#endif
```

### 3. Tiny static factory (only for console apps)

```csharp
// TextToSpeechCore/TtsFactory.cs
namespace TextToSpeechCore;

public static class TtsFactory
{
    public static ITtsService Create()
    {
#if WINDOWS
        return new WindowsSapiTtsService();
#else
        // This path should almost never be hit in a pure console app
        // (unless you're running dotnet run on macOS/Linux without MAUI context)
        return new MauiTtsService();  // fallback — or throw if you prefer strictness
#endif
    }
}
```

Usage in any console app (`TextToSpeechApp/Program.cs` example):

```csharp
class Program
{
    static async Task Main(string[] args)
    {
        var tts = TtsFactory.Create();

        // your normal logic
        var voices = tts.GetAvailableVoices();
        Console.WriteLine("Available voices:");
        foreach (var voice in voices) Console.WriteLine($"  • {voice}");

        await tts.SpeakAsync("Testing the factory pattern", rate: 0.9, volume: 0.95);

        // ... rest of your app
    }
}
```

### 4. Pure DI – MAUI composition root (the cleanest part)

In your future MAUI Blazor Hybrid project (`MauiProgram.cs`):

```csharp
public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();
        builder
            .UseMauiApp<App>()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
            });

        // ── The only place that knows about concrete types ──
        builder.Services.AddSingleton<ITtsService>(provider =>
        {
#if WINDOWS
            return new WindowsSapiTtsService();
#else
            return new MauiTtsService();
#endif
        });

        // Register your other services (TranslationTools stuff, view models, etc.)
        // builder.Services.AddSingleton<TranslationEntryLoader>();
        // builder.Services.AddSingleton<YourViewModel>();

        return builder.Build();
    }
}
```

Then in any page, view model or service:

```csharp
public partial class MainPage : ContentPage
{
    private readonly ITtsService _tts;

    public MainPage(ITtsService tts)
    {
        InitializeComponent();
        _tts = tts;
    }

    private async void OnPlayButtonClicked(object sender, EventArgs e)
    {
        await _tts.SpeakAsync("Hello from dependency injection", volume: 1.0);
    }
}
```

Or with property injection in Blazor components:

```razor
@inject ITtsService Tts

<button @onclick="SpeakTest">Speak</button>

@code {
    private async Task SpeakTest()
    {
        await Tts.SpeakAsync("Blazor + DI works!");
    }
}
```

### Summary – Why this is pragmatic and maintainable

- No global state
- No service locator
- Composition root makes the wiring explicit
- Console apps stay dead simple (tiny factory)
- MAUI gets proper DI (the natural way in .NET MAUI)
- Zero Clean Architecture layers / use-case boilerplate
- Easy to swap implementations later (Azure TTS, offline neural model, etc.)
- Testable (you can register a mock `ITtsService` in tests)

You can start using this pattern **today** in the console app (just add the factory + interface), and when you later add the MAUI project the DI part will feel completely natural.

If you run into any small friction points while moving the old `TextToSpeechService` code over (constructor parameters, async/sync mismatches, voice selection logic, etc.), just paste the relevant snippet and I’ll help you adapt it precisely.