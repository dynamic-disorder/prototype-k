using System.Text.Json;

using Shouldly;

namespace TextToSpeechApp.Tests;

/// <summary>
/// Tests for <see cref="TtsSettings"/> JSON deserialization.
/// Verifies TtsProvider selector, TtsProviders dictionary mapping,
/// PiperVoices accuracy, and default-value fallback under various inputs.
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
                  "PiperVoices": {
                    "English": "en_US-lessac-medium",
                    "Finnish": "fi_FI-harri-low"
                  }
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
    public void Deserialize_ActiveWindows_ShouldReturnWindowsVoiceMap()
    {
        // Given: JSON with Windows as the active provider
        const string json = """
            {
              "TtsProvider": "Windows",
              "TtsProviders": {
                "Windows": {
                  "PiperVoices": {
                    "English": "en_US-lessac-medium",
                    "Finnish": "fi_FI-harri-low"
                  }
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
        var expectedEnglish = "en_US-lessac-medium";
        var expectedFinnish = "fi_FI-harri-low";
        var sut = JsonSerializer.Deserialize<TtsSettings>(json);

        // Then: The Windows provider voices match the expected values
        sut.ShouldNotBeNull();
        sut.TtsProvider.ShouldBe("Windows");

        var windowsConfig = sut.TtsProviders["Windows"];
        windowsConfig.PiperVoices["English"].ShouldBe(expectedEnglish);
        windowsConfig.PiperVoices["Finnish"].ShouldBe(expectedFinnish);
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
                  "PiperVoices": {
                    "English": "en_US-lessac-medium",
                    "Finnish": "fi_FI-harri-low"
                  }
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
        // Given: JSON with only the Windows provider defined
        const string json = """
            {
              "TtsProvider": "Windows",
              "TtsProviders": {
                "Windows": {
                  "PiperVoices": {
                    "English": "en_US-lessac-medium"
                  }
                }
              }
            }
            """;

        // When: Deserializing the JSON
        var expectedVoice = "en_US-lessac-medium";
        var sut = JsonSerializer.Deserialize<TtsSettings>(json);

        // Then: The Windows provider is present with the correct voice
        sut.ShouldNotBeNull();
        sut.TtsProvider.ShouldBe("Windows");
        sut.TtsProviders.ContainsKey("Windows").ShouldBeTrue();
        sut.TtsProviders["Windows"].PiperVoices["English"].ShouldBe(expectedVoice);
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
}