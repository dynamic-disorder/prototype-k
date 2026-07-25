using System.Text.Json;

using Shouldly;

namespace TextToSpeechApp.Tests;

/// <summary>
/// Tests for <see cref="TtsSettings"/> JSON deserialization and
/// <see cref="TtsSettings.TryParseTtsArg"/> CLI argument parsing.
/// Verifies TtsProvider selector, TtsProviders dictionary mapping,
/// PiperVoices accuracy, Comment field, default-value fallback, and --tts: argument handling.
/// </summary>
public sealed class TtsSettingsTests
{
    [Fact]
    public void Deserialize_FullJson_ShouldPopulateBothProviders()
    {
        // Given: A full settings JSON with Windows and Piper providers
        const string json = """
            {
              "TtsProvider": "Piper",
              "TtsProviders": {
                "Windows": {
                },
                "Piper": {
                  "PiperVoices": {
                    "English": "en_GB-northern_english_male-medium",
                    "Finnish": "fi_FI-harri-medium",
                    "Vietnamese": "vi_VN-vivos-x_low"
                  }
                }
              }
            }
            """;

        // When: Deserializing the JSON
        var actual = JsonSerializer.Deserialize<TtsSettings>(json);

        // Then: Both providers are present and Piper is selected
        actual.ShouldNotBeNull();
        actual.TtsProvider.ShouldBe("Piper");
        actual.TtsProviders.Count.ShouldBe(2);
    }

    [Fact]
    public void Deserialize_ActiveWindows_ShouldNotHavePiperVoices()
    {
        // Given: JSON with Windows as the active provider (no PiperVoices on Windows)
        const string json = """
            {
              "TtsProvider": "Windows",
              "TtsProviders": {
                "Windows": {
                },
                "Piper": {
                  "PiperVoices": {
                    "English": "en_GB-northern_english_male-medium",
                    "Finnish": "fi_FI-harri-medium",
                    "Vietnamese": "vi_VN-vivos-x_low"
                  }
                }
              }
            }
            """;

        // When: Deserializing the JSON
        var sut = JsonSerializer.Deserialize<TtsSettings>(json);

        // Then: Windows provider has no PiperVoices (PiperVoices is only for Piper)
        sut.ShouldNotBeNull();
        sut.TtsProvider.ShouldBe("Windows");

        var windowsConfig = sut.TtsProviders["Windows"];
        windowsConfig.PiperVoices.ShouldBeEmpty();
        windowsConfig.Comment.ShouldBeNull();
    }

    [Fact]
    public void Deserialize_WindowsWithComment_ShouldPreserveComment()
    {
        // Given: JSON with a Comment on the Windows provider
        const string json = """
            {
              "TtsProvider": "Windows",
              "TtsProviders": {
                "Windows": {
                  "Comment": "Windows speech voices are installed on the system."
                }
              }
            }
            """;

        // When: Deserializing the JSON
        var sut = JsonSerializer.Deserialize<TtsSettings>(json);

        // Then: The Comment is preserved
        sut.ShouldNotBeNull();
        var windowsConfig = sut.TtsProviders["Windows"];
        windowsConfig.Comment.ShouldBe("Windows speech voices are installed on the system.");
    }

    [Fact]
    public void Deserialize_ActivePiper_ShouldReturnPiperVoiceMap()
    {
        // Given: JSON with Piper as the active provider
        const string json = """
            {
              "TtsProvider": "Piper",
              "TtsProviders": {
                "Windows": {
                },
                "Piper": {
                  "PiperVoices": {
                    "English": "en_GB-northern_english_male-medium",
                    "Finnish": "fi_FI-harri-medium",
                    "Vietnamese": "vi_VN-vivos-x_low"
                  }
                }
              }
            }
            """;

        // When: Deserializing the JSON
        var expectedEnglish = "en_GB-northern_english_male-medium";
        var expectedFinnish = "fi_FI-harri-medium";
        var expectedVietnamese = "vi_VN-vivos-x_low";
        var sut = JsonSerializer.Deserialize<TtsSettings>(json);

        // Then: The Piper provider voices match the expected values
        sut.ShouldNotBeNull();

        var piperConfig = sut.TtsProviders["Piper"];
        piperConfig.PiperVoices["English"].ShouldBe(expectedEnglish);
        piperConfig.PiperVoices["Finnish"].ShouldBe(expectedFinnish);
        piperConfig.PiperVoices["Vietnamese"].ShouldBe(expectedVietnamese);
    }

    [Fact]
    public void Deserialize_EmptyObject_ShouldUseDefaults()
    {
        // Given: An empty JSON object
        const string json = "{}";

        // When: Deserializing the JSON
        var sut = JsonSerializer.Deserialize<TtsSettings>(json);

        // Then: Default values are applied
        sut.ShouldNotBeNull();
        sut.TtsProvider.ShouldBe("Windows");
        sut.TtsProviders.ShouldBeEmpty();
    }

    [Fact]
    public void Deserialize_OnlyActiveProvider_ShouldDefaultOthers()
    {
        // Given: JSON with only TtsProvider set
        const string json = """
            {
              "TtsProvider": "Piper"
            }
            """;

        // When: Deserializing the JSON
        var sut = JsonSerializer.Deserialize<TtsSettings>(json);

        // Then: TtsProvider is set and TtsProviders is empty
        sut.ShouldNotBeNull();
        sut.TtsProvider.ShouldBe("Piper");
        sut.TtsProviders.ShouldBeEmpty();
    }

    [Fact]
    public void Deserialize_WindowsProviderOnly_ShouldWork()
    {
        // Given: JSON with only the Windows provider defined (no PiperVoices)
        const string json = """
            {
              "TtsProvider": "Windows",
              "TtsProviders": {
                "Windows": {
                }
              }
            }
            """;

        // When: Deserializing the JSON
        var sut = JsonSerializer.Deserialize<TtsSettings>(json);

        // Then: The Windows provider is present with no PiperVoices
        sut.ShouldNotBeNull();
        sut.TtsProvider.ShouldBe("Windows");
        sut.TtsProviders.ContainsKey("Windows").ShouldBeTrue();
        sut.TtsProviders["Windows"].PiperVoices.ShouldBeEmpty();
    }

    [Fact]
    public void Deserialize_PiperProviderOnly_ShouldWork()
    {
        // Given: JSON with only the Piper provider defined
        const string json = """
            {
              "TtsProvider": "Piper",
              "TtsProviders": {
                "Piper": {
                  "PiperVoices": {
                    "English": "en_GB-northern_english_male-medium",
                    "Finnish": "fi_FI-harri-medium",
                    "Vietnamese": "vi_VN-vivos-x_low"
                  }
                }
              }
            }
            """;

        // When: Deserializing the JSON
        var sut = JsonSerializer.Deserialize<TtsSettings>(json);

        // Then: The Piper provider is present with three voice mappings
        sut.ShouldNotBeNull();
        sut.TtsProvider.ShouldBe("Piper");
        sut.TtsProviders.ContainsKey("Piper").ShouldBeTrue();
        sut.TtsProviders["Piper"].PiperVoices.Count.ShouldBe(3);
    }

    [Fact]
    public void Deserialize_ProviderConfigWithoutVoices_ShouldReturnEmptyDictionary()
    {
        // Given: A provider entry with no PiperVoices
        const string json = """
            {
              "TtsProvider": "Windows",
              "TtsProviders": {
                "Windows": {}
              }
            }
            """;

        // When: Deserializing the JSON
        var sut = JsonSerializer.Deserialize<TtsSettings>(json);

        // Then: The provider config exists but has an empty PiperVoices dictionary
        sut.ShouldNotBeNull();
        var config = sut.TtsProviders["Windows"];
        config.ShouldNotBeNull();
        config.PiperVoices.ShouldBeEmpty();
    }

    // ---------- TryParseTtsArg tests ----------

    [Theory]
    [InlineData("--tts:piper", "Piper")]
    [InlineData("--tts:windows", "Windows")]
    [InlineData("-tts:piper", "Piper")]
    [InlineData("-tts:windows", "Windows")]
    [InlineData("--tts:Piper", "Piper")]
    [InlineData("--tts:PiPeR", "Piper")]
    [InlineData("-tts:WINDOWS", "Windows")]
    [InlineData("--tts:pIpEr", "Piper")]
    public void TryParseTtsArg_ValidProvider_ReturnsTrueAndTitleCasedProvider(string arg, string expected)
    {
        // When: Parsing the argument
        var result = TtsSettings.TryParseTtsArg(arg, out var provider);

        // Then: The provider is recognised and normalised to title case
        result.ShouldBeTrue();
        provider.ShouldBe(expected);
    }

    [Theory]
    [InlineData("--tts:")]
    [InlineData("-tts:")]
    [InlineData("--tts:invalid")]
    [InlineData("--tts:unknown")]
    [InlineData("-tts:badvalue")]
    public void TryParseTtsArg_EmptyOrUnknownValue_ReturnsTrueWithNullProvider(string arg)
    {
        // Given: A --tts argument with an empty or unknown provider value

        // When: Parsing the argument
        var result = TtsSettings.TryParseTtsArg(arg, out var provider);

        // Then: The argument is recognised as a TTS arg, but no valid provider was found
        result.ShouldBeTrue();
        provider.ShouldBeNull();
    }

    [Theory]
    [InlineData("")]
    [InlineData("somefile.csv")]
    [InlineData("--help")]
    [InlineData("-h")]
    [InlineData("--tts")]
    [InlineData("-tts")]
    [InlineData("randomstring")]
    [InlineData("100")]
    public void TryParseTtsArg_NonTtsArgument_ReturnsFalse(string arg)
    {
        // Given: An argument that is not a TTS provider argument

        // When: Parsing the argument
        var result = TtsSettings.TryParseTtsArg(arg, out var provider);

        // Then: It is not recognised as a TTS argument
        result.ShouldBeFalse();
        provider.ShouldBeNull();
    }
}