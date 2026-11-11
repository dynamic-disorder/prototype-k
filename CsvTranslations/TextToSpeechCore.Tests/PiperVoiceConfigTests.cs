using Shouldly;

namespace TextToSpeechCore.Tests;

/// <summary>
///     Tests for <see cref="PiperVoiceConfig" />, in particular <see cref="PiperVoiceConfig.BuildModelKey" />,
///     which the service uses to name and download Piper voice models.
/// </summary>
public sealed class PiperVoiceConfigTests
{
    /// <summary>
    ///     Verifies the model key joins language code, model card and quality with dashes.
    /// </summary>
    [Fact]
    public void BuildModelKey_ComposesLanguageCodeModelCardAndQuality()
    {
        var config = new PiperVoiceConfig
        {
            LanguageCode = "vi_VN",
            ModelCard = "vivos",
            ModelQuality = "x_low"
        };

        config.BuildModelKey().ShouldBe("vi_VN-vivos-x_low");
    }

    /// <summary>
    ///     Verifies an unset config still joins its empty parts, giving two dashes.
    /// </summary>
    [Fact]
    public void BuildModelKey_DefaultConfig_IsTwoDashes()
    {
        // Documents that the parts are joined unconditionally, even when unset.
        new PiperVoiceConfig().BuildModelKey().ShouldBe("--");
    }

    /// <summary>
    ///     Verifies the key keeps the exact casing of each part, joined by dashes.
    /// </summary>
    [Theory]
    [InlineData("en_GB", "northern_english_male", "medium")]
    [InlineData("fi_FI", "harri", "medium")]
    [InlineData("en_US", "lessac", "high")]
    public void BuildModelKey_SeparatesPartsWithDashes(string languageCode, string modelCard, string quality)
    {
        var config = new PiperVoiceConfig
        {
            LanguageCode = languageCode,
            ModelCard = modelCard,
            ModelQuality = quality
        };

        config.BuildModelKey().ShouldBe($"{languageCode}-{modelCard}-{quality}");
    }

    /// <summary>
    ///     Verifies a new config starts with empty strings and no speaker.
    /// </summary>
    [Fact]
    public void Defaults_AreEmptyStringsAndNullSpeakers()
    {
        var config = new PiperVoiceConfig();

        config.LanguageCode.ShouldBe(string.Empty);
        config.ModelCard.ShouldBe(string.Empty);
        config.ModelQuality.ShouldBe(string.Empty);
        config.SpeakerName.ShouldBeNull();
        config.SpeakerId.ShouldBeNull();
    }

    /// <summary>
    ///     Verifies the optional speaker fields round-trip the values assigned.
    /// </summary>
    [Fact]
    public void SpeakerFields_AreOptionalAndSettable()
    {
        var config = new PiperVoiceConfig { SpeakerName = "VIVOSDEV09", SpeakerId = "54" };

        config.SpeakerName.ShouldBe("VIVOSDEV09");
        config.SpeakerId.ShouldBe("54");
    }
}
