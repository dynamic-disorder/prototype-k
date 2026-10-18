namespace TextToSpeechApp;

/// <summary>
///     Decides which text-to-speech provider the app runs, given the provider it was asked for.
/// </summary>
/// <remarks>
///     There is exactly one provider, <c>Piper</c>: the app is a single platform-independent build,
///     and Piper is the only engine that runs on Windows, Linux and macOS alike. <c>Windows</c> is
///     still recognised so the app can explain that it has been removed rather than reporting an
///     unknown value.
/// </remarks>
internal static class TtsProviderSelection
{
    /// <summary>
    ///     The provider that speaks through the Piper neural TTS engine. The only provider.
    /// </summary>
    public const string PiperProvider = "Piper";

    /// <summary>
    ///     The provider name the app used to accept. Recognised only so the message can say what
    ///     happened to it.
    /// </summary>
    public const string RemovedWindowsProvider = "Windows";

    /// <summary>
    ///     Resolves the provider to use, always to <see cref="PiperProvider"/>, reporting anything the
    ///     user should know about the value they asked for.
    /// </summary>
    /// <param name="requestedProvider">The provider named by the settings file or the command line.</param>
    /// <param name="notice">
    ///     A message for the user when the requested provider is not the one that will run, or
    ///     <c>null</c> when it was accepted as is. The caller decides how loudly to print it.
    /// </param>
    /// <returns>The provider to create.</returns>
    public static string Resolve(string requestedProvider, out string? notice)
    {
        notice = null;

        if (requestedProvider.Equals(PiperProvider, StringComparison.OrdinalIgnoreCase))
        {
            return PiperProvider;
        }

        if (requestedProvider.Equals(RemovedWindowsProvider, StringComparison.OrdinalIgnoreCase))
        {
            notice = $"The '{RemovedWindowsProvider}' TTS provider has been removed: the app is a single "
                     + $"platform-independent build and speaks through '{PiperProvider}'. Using '{PiperProvider}'. "
                     + $"Set \"TtsProvider\": \"{PiperProvider}\" in settings.json to make that choice explicit.";

            return PiperProvider;
        }

        notice = $"TTS provider '{requestedProvider}' is not recognised; '{PiperProvider}' is the only provider. "
                 + $"Using '{PiperProvider}' instead.";

        return PiperProvider;
    }
}
