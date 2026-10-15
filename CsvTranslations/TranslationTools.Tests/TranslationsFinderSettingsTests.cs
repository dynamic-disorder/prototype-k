using System.Text.Json;

using Shouldly;

using TranslationTools;

namespace TranslationTools.Tests;

/// <summary>
///     Tests for <see cref="TranslationsFinder.GetTranslationFilePathFromSettings" /> covering the
///     <c>translation_filepath</c> settings.json property, malformed settings and the absent file.
///     The tests write <c>settings.json</c> next to the test assembly and run sequentially within
///     this class so they cannot observe each other's file.
/// </summary>
public sealed class TranslationsFinderSettingsTests
{
    /// <summary>
    ///     Verifies that without a settings.json next to the test assembly no translation
    ///     file path can be resolved from settings.
    /// </summary>
    [Fact]
    public void GetTranslationFilePathFromSettings_NoSettingsFile_ReturnsEmptyString()
    {
        // Given: the test output directory does not contain settings.json
        var settingsPath = Path.Combine(AppContext.BaseDirectory, "settings.json");

        // When: resolving the translation file path from settings
        var actual = TranslationsFinder.GetTranslationFilePathFromSettings();

        // Then: an empty string is returned (the environment variable is never consulted without the file)
        File.Exists(settingsPath).ShouldBeFalse();
        actual.ShouldBeEmpty();
    }

    /// <summary>
    ///     Verifies that the <c>translation_filepath</c> property from settings.json is read and
    ///     resolved to a full path.
    /// </summary>
    [Fact]
    public void GetTranslationFilePathFromSettings_TranslationFilepathInJson_ReturnsResolvedFullPath()
    {
        // Given: a settings.json that declares a translation file path
        var expectedPath = Path.Combine(Path.GetTempPath(), "TranslationToolsSettingsTests", "translations.csv");
        var json = JsonSerializer.Serialize(new { translation_filepath = expectedPath });

        // When: resolving the translation file path from settings
        WithSettingsFile(json, () =>
        {
            var actual = TranslationsFinder.GetTranslationFilePathFromSettings();

            // Then: the configured path is returned as a full path
            actual.ShouldBe(Path.GetFullPath(expectedPath));
        });
    }

    /// <summary>
    ///     Verifies that a relative <c>translation_filepath</c> is resolved against the current
    ///     working directory, matching the existing path handling.
    /// </summary>
    [Fact]
    public void GetTranslationFilePathFromSettings_RelativePath_IsResolvedToFullPath()
    {
        // Given: a settings.json with a relative translation file path
        const string relativePath = "data/translations.csv";
        var json = JsonSerializer.Serialize(new { translation_filepath = relativePath });

        // When: resolving the translation file path from settings
        WithSettingsFile(json, () =>
        {
            var actual = TranslationsFinder.GetTranslationFilePathFromSettings();

            // Then: the relative path is expanded to a full path
            actual.ShouldBe(Path.GetFullPath(relativePath));
        });
    }

    /// <summary>
    ///     Verifies that malformed settings JSON is tolerated and yields an empty path.
    /// </summary>
    [Fact]
    public void GetTranslationFilePathFromSettings_MalformedJson_ReturnsEmptyString()
    {
        // Given: a settings.json that is not valid JSON
        const string json = "{ \"translation_filepath\": ";

        // When: resolving the translation file path from settings
        WithSettingsFile(json, () =>
        {
            var actual = TranslationsFinder.GetTranslationFilePathFromSettings();

            // Then: the malformed file does not throw and no path is reported
            actual.ShouldBeEmpty();
        });
    }

    /// <summary>
    ///     Verifies that settings JSON without the <c>translation_filepath</c> property yields
    ///     an empty path.
    /// </summary>
    [Fact]
    public void GetTranslationFilePathFromSettings_JsonWithoutTranslationFilepath_ReturnsEmptyString()
    {
        // Given: a valid settings.json that does not declare a translation file path
        var json = JsonSerializer.Serialize(new { TtsProvider = "Windows" });

        // When: resolving the translation file path from settings
        WithSettingsFile(json, () =>
        {
            var actual = TranslationsFinder.GetTranslationFilePathFromSettings();

            // Then: no path is reported
            actual.ShouldBeEmpty();
        });
    }

    /// <summary>
    ///     Verifies that a <c>translation_filepath</c> property with a non-string JSON value
    ///     yields an empty path.
    /// </summary>
    [Fact]
    public void GetTranslationFilePathFromSettings_NonStringTranslationFilepath_ReturnsEmptyString()
    {
        // Given: a settings.json whose translation file path is not a string
        var json = JsonSerializer.Serialize(new { translation_filepath = 42 });

        // When: resolving the translation file path from settings
        WithSettingsFile(json, () =>
        {
            var actual = TranslationsFinder.GetTranslationFilePathFromSettings();

            // Then: no path is reported
            actual.ShouldBeEmpty();
        });
    }

    /// <summary>
    ///     Writes a settings.json next to the test assembly for the duration of the assertion.
    /// </summary>
    /// <param name="json">The JSON content to write.</param>
    /// <param name="assertion">The assertion to run while the file exists.</param>
    private static void WithSettingsFile(string json, Action assertion)
    {
        var settingsPath = Path.Combine(AppContext.BaseDirectory, "settings.json");

        try
        {
            File.WriteAllText(settingsPath, json);
            assertion();
        }
        finally
        {
            if (File.Exists(settingsPath))
            {
                File.Delete(settingsPath);
            }
        }
    }
}
