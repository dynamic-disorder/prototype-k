using System.Text.Json;

using Shouldly;

using TextToSpeechCore;

namespace TextToSpeechApp.Tests;

/// <summary>
/// Tests for <see cref="TtsSettings"/> JSON deserialization and
/// <see cref="TtsSettings.TryParseTtsArg"/> CLI argument parsing.
/// Verifies TtsProvider selector, TtsProviders dictionary mapping,
/// PiperVoices detailed config accuracy, Comment field, default-value fallback, and --tts: argument handling.
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
                    "English": {
                      "LanguageCode": "en_GB",
                      "ModelCard": "northern_english_male",
                      "ModelQuality": "medium",
                      "SpeakerName": "default",
                      "SpeakerId": "1"
                    },
                    "Finnish": {
                      "LanguageCode": "fi_FI",
                      "ModelCard": "harri",
                      "ModelQuality": "medium",
                      "SpeakerName": "default",
                      "SpeakerId": "1"
                    },
                    "Vietnamese": {
                      "LanguageCode": "vi_VN",
                      "ModelCard": "vivos",
                      "ModelQuality": "x_low",
                      "SpeakerName": "VIVOSDEV09",
                      "SpeakerId": "54"
                    }
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
                    "English": {
                      "LanguageCode": "en_GB",
                      "ModelCard": "northern_english_male",
                      "ModelQuality": "medium"
                    }
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
    public void Deserialize_ActivePiper_ShouldReturnPiperVoiceConfigs()
    {
        // Given: JSON with Piper as the active provider with detailed voice configs
        const string json = """
            {
              "TtsProvider": "Piper",
              "TtsProviders": {
                "Windows": {
                },
                "Piper": {
                  "PiperVoices": {
                    "English": {
                      "LanguageCode": "en_GB",
                      "ModelCard": "northern_english_male",
                      "ModelQuality": "medium",
                      "SpeakerName": "default",
                      "SpeakerId": "1"
                    },
                    "Finnish": {
                      "LanguageCode": "fi_FI",
                      "ModelCard": "harri",
                      "ModelQuality": "medium",
                      "SpeakerName": "default",
                      "SpeakerId": "1"
                    },
                    "Vietnamese": {
                      "LanguageCode": "vi_VN",
                      "ModelCard": "vivos",
                      "ModelQuality": "x_low",
                      "SpeakerName": "VIVOSDEV09",
                      "SpeakerId": "54"
                    }
                  }
                }
              }
            }
            """;

        // When: Deserializing the JSON
        var sut = JsonSerializer.Deserialize<TtsSettings>(json);

        // Then: The Piper provider voice configs match the expected values
        sut.ShouldNotBeNull();

        var piperConfig = sut.TtsProviders["Piper"];

        var english = piperConfig.PiperVoices["English"];
        english.LanguageCode.ShouldBe("en_GB");
        english.ModelCard.ShouldBe("northern_english_male");
        english.ModelQuality.ShouldBe("medium");
        english.SpeakerName.ShouldBe("default");
        english.SpeakerId.ShouldBe("1");
        english.BuildModelKey().ShouldBe("en_GB-northern_english_male-medium");

        var finnish = piperConfig.PiperVoices["Finnish"];
        finnish.LanguageCode.ShouldBe("fi_FI");
        finnish.ModelCard.ShouldBe("harri");
        finnish.ModelQuality.ShouldBe("medium");
        finnish.SpeakerName.ShouldBe("default");
        finnish.SpeakerId.ShouldBe("1");
        finnish.BuildModelKey().ShouldBe("fi_FI-harri-medium");

        var vietnamese = piperConfig.PiperVoices["Vietnamese"];
        vietnamese.LanguageCode.ShouldBe("vi_VN");
        vietnamese.ModelCard.ShouldBe("vivos");
        vietnamese.ModelQuality.ShouldBe("x_low");
        vietnamese.SpeakerName.ShouldBe("VIVOSDEV09");
        vietnamese.SpeakerId.ShouldBe("54");
        vietnamese.BuildModelKey().ShouldBe("vi_VN-vivos-x_low");
    }

    [Fact]
    public void Deserialize_ActivePiper_ShouldHandleMissingSpeakerFields()
    {
        // Given: JSON with Piper voice configs that omit optional speaker fields
        const string json = """
            {
              "TtsProvider": "Piper",
              "TtsProviders": {
                "Piper": {
                  "PiperVoices": {
                    "Vietnamese": {
                      "LanguageCode": "vi_VN",
                      "ModelCard": "vivos",
                      "ModelQuality": "x_low"
                    }
                  }
                }
              }
            }
            """;

        // When: Deserializing the JSON
        var sut = JsonSerializer.Deserialize<TtsSettings>(json);

        // Then: Speaker fields default to null and the model key is correctly composed
        sut.ShouldNotBeNull();
        var piperConfig = sut.TtsProviders["Piper"];
        var vietnamese = piperConfig.PiperVoices["Vietnamese"];
        vietnamese.SpeakerName.ShouldBeNull();
        vietnamese.SpeakerId.ShouldBeNull();
        vietnamese.BuildModelKey().ShouldBe("vi_VN-vivos-x_low");
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
                    "English": {
                      "LanguageCode": "en_GB",
                      "ModelCard": "northern_english_male",
                      "ModelQuality": "medium"
                    },
                    "Finnish": {
                      "LanguageCode": "fi_FI",
                      "ModelCard": "harri",
                      "ModelQuality": "medium"
                    },
                    "Vietnamese": {
                      "LanguageCode": "vi_VN",
                      "ModelCard": "vivos",
                      "ModelQuality": "x_low"
                    }
                  }
                }
              }
            }
            """;

        // When: Deserializing the JSON
        var sut = JsonSerializer.Deserialize<TtsSettings>(json);

        // Then: The Piper provider is present with three voice configurations
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