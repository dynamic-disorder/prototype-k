using System.Text.Json;

using Shouldly;

namespace TextToSpeechApp.Tests;

public sealed class TtsSettingsTests
{
    [Fact]
    public void Deserialize_WithFullJson_ShouldPopulateAllProperties()
    {
        // Arrange
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

        // Act
        var settings = JsonSerializer.Deserialize<TtsSettings>(json);

        // Assert
        settings.ShouldNotBeNull();
        settings.TtsProvider.ShouldBe("Piper");
        settings.TtsProviders.ShouldNotBeNull();
        settings.TtsProviders.Count.ShouldBe(2);
    }

    [Fact]
    public void Deserialize_WithFullJson_WindowsProvider_ShouldHaveCorrectVoices()
    {
        // Arrange
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

        // Act
        var settings = JsonSerializer.Deserialize<TtsSettings>(json);

        // Assert
        settings.ShouldNotBeNull();
        settings.TtsProvider.ShouldBe("Windows");

        var windowsConfig = settings.TtsProviders["Windows"];
        windowsConfig.ShouldNotBeNull();
        windowsConfig.PiperVoices["English"].ShouldBe("en_US-lessac-medium");
        windowsConfig.PiperVoices["Finnish"].ShouldBe("fi_FI-harri-low");
    }

    [Fact]
    public void Deserialize_WithFullJson_PiperProvider_ShouldHaveCorrectVoices()
    {
        // Arrange
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

        // Act
        var settings = JsonSerializer.Deserialize<TtsSettings>(json);

        // Assert
        settings.ShouldNotBeNull();

        var piperConfig = settings.TtsProviders["Piper"];
        piperConfig.ShouldNotBeNull();
        piperConfig.PiperVoices["English"].ShouldBe("en_GB-northern_english_male-medium");
        piperConfig.PiperVoices["Finnish"].ShouldBe("fi_FI-harri-medium");
        piperConfig.PiperVoices["Vietnamese"].ShouldBe("vi_VN-vivos-x_low");
    }

    [Fact]
    public void Deserialize_WithEmptyJson_ShouldUseDefaults()
    {
        // Arrange
        const string json = "{}";

        // Act
        var settings = JsonSerializer.Deserialize<TtsSettings>(json);

        // Assert
        settings.ShouldNotBeNull();
        settings.TtsProvider.ShouldBe("Windows");
        settings.TtsProviders.ShouldBeEmpty();
    }

    [Fact]
    public void Deserialize_WithMinimalJson_ShouldSetDefaults()
    {
        // Arrange
        const string json = """
            {
              "TtsProvider": "Piper"
            }
            """;

        // Act
        var settings = JsonSerializer.Deserialize<TtsSettings>(json);

        // Assert
        settings.ShouldNotBeNull();
        settings.TtsProvider.ShouldBe("Piper");
        settings.TtsProviders.ShouldBeEmpty();
    }

    [Fact]
    public void Deserialize_WithOnlyWindowsProvider_ShouldWork()
    {
        // Arrange
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

        // Act
        var settings = JsonSerializer.Deserialize<TtsSettings>(json);

        // Assert
        settings.ShouldNotBeNull();
        settings.TtsProvider.ShouldBe("Windows");
        settings.TtsProviders.ContainsKey("Windows").ShouldBeTrue();
        settings.TtsProviders["Windows"].PiperVoices["English"].ShouldBe("en_US-lessac-medium");
    }

    [Fact]
    public void Deserialize_WithOnlyPiperProvider_ShouldWork()
    {
        // Arrange
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

        // Act
        var settings = JsonSerializer.Deserialize<TtsSettings>(json);

        // Assert
        settings.ShouldNotBeNull();
        settings.TtsProvider.ShouldBe("Piper");
        settings.TtsProviders.ContainsKey("Piper").ShouldBeTrue();
        settings.TtsProviders["Piper"].PiperVoices.Count.ShouldBe(3);
    }

    [Fact]
    public void Deserialize_ProviderConfig_WithoutPiperVoices_ShouldBeEmpty()
    {
        // Arrange
        const string json = """
            {
              "TtsProvider": "Windows",
              "TtsProviders": {
                "Windows": {}
              }
            }
            """;

        // Act
        var settings = JsonSerializer.Deserialize<TtsSettings>(json);

        // Assert
        settings.ShouldNotBeNull();
        var config = settings.TtsProviders["Windows"];
        config.ShouldNotBeNull();
        config.PiperVoices.ShouldBeEmpty();
    }
}