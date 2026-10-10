# Text-to-Speech Options & .NET 10 Compatibility

This note summarizes compatibility of SAPI with .NET 10, alternative NuGet/cloud SDKs, and recommended project settings for `TextToSpeechApp`.

## Will SAPI work on .NET 10?

- Yes. SAPI is a native COM-based API provided by Windows; managed code running on .NET 10 can call COM via COM interop just like earlier .NET versions. The runtime (CoreCLR/.NET 10) runs on top of Windows and can P/Invoke or use COM interop to talk to SAPI.
- Caveat: `System.Speech` is a .NET Framework assembly (not part of modern .NET by default). You can either:
  - Use COM interop directly (e.g., `SAPI.SpVoice`), or
  - Use a modern API such as WinRT `Windows.Media.SpeechSynthesis` (available when `UseWinRT` is enabled).

## NuGet / SDK alternatives (quality vs tradeoffs)

- Microsoft Cognitive Services (Azure Speech)
  - NuGet: `Microsoft.CognitiveServices.Speech` (AKA Speech SDK)
  - Quality: very high (neural voices); supports SSML, streaming, and advanced features.
  - Tradeoffs: requires Azure subscription/keys (or paid container/offline options).

- Amazon Polly
  - NuGet: `AWSSDK.Polly`
  - Quality: very good (standard and neural voices); pay-as-you-go.
  - Tradeoffs: requires AWS credentials and internet access.

- Google Cloud Text-to-Speech
  - NuGet: `Google.Cloud.TextToSpeech.V1`
  - Quality: WaveNet neural voices; cloud-based.
  - Tradeoffs: requires GCP credentials and internet access.

- Windows.Media.SpeechSynthesis (WinRT)
  - Not a NuGet package — built into Windows. Accessible from .NET 10 when `UseWinRT` is enabled.
  - Quality: decent and fully local (no cloud). Good choice for simple local TTS with reasonable clarity.
  - Tradeoffs: limited voice selection compared to cloud neural voices; Windows-only.

- Legacy `System.Speech` / SAPI wrappers
  - Works by invoking local SAPI voices; quality depends on installed voices (generally less natural than modern neural cloud voices).
  - Use via COM interop if you need existing installed voices and no cloud dependencies.

## Recommendation

- For highest naturalness and intelligibility: use `Microsoft.CognitiveServices.Speech` (Azure Speech SDK) or other cloud neural TTS (AWS/Google). Integrates cleanly via NuGet and supports .NET 10.
- For fully offline and no-cloud: prefer `Windows.Media.SpeechSynthesis` (WinRT) for minimal changes — your project already sets `<UseWinRT>true` which makes this straightforward.
- If you must keep local SAPI voices: call them via COM interop from .NET 10; this continues to work but voice quality is limited to installed Windows voices.

## Project / csproj notes for `TextToSpeechApp`

- Keep these in the project when targeting Windows APIs:

```xml
<PropertyGroup>
  <TargetFramework>net10.0-windows10.0.19041.0</TargetFramework>
  <UseWinRT>true</UseWinRT>
  <RuntimeIdentifier>win-x64</RuntimeIdentifier>
</PropertyGroup>
```

- `TargetFramework` change to `net10.0-windows...` is optional but recommended when migrating to .NET 10.
- Keep `UseWinRT` and `RuntimeIdentifier` if you plan to use `Windows.Media.SpeechSynthesis` or other Windows-only APIs.

## Quick usage hints

- WinRT (`Windows.Media.SpeechSynthesis`) basic flow:
  - Create a `SpeechSynthesizer`, generate a `SpeechSynthesisStream`, then play via `MediaElement` or convert to WAV/MP3 for output.

- Azure Speech SDK basic flow:
  - Install `Microsoft.CognitiveServices.Speech`, create a `SpeechConfig` with your key/region, then create a `SpeechSynthesizer` and call `SpeakTextAsync`.

## Next steps I can do for you

- Add an example implementation (a) `Windows.Media.SpeechSynthesis` snippet, or (b) `Microsoft.CognitiveServices.Speech` example + `PackageReference` and config guidance.
- Update `TextToSpeechApp.csproj` to `net10.0-windows10.0.19041.0` and keep `UseWinRT`/`RuntimeIdentifier`.

---

File created to summarize options and migration guidance for `.NET 10` migration.
