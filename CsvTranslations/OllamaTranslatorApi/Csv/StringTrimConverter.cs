using CsvHelper;
using CsvHelper.Configuration;
using CsvHelper.TypeConversion;

namespace OllamaTranslatorApi.Csv;

public class StringTrimConverter : DefaultTypeConverter
{
    public StringTrimConverter()
    {
    }

    public override string? ConvertToString(object? value, IWriterRow row, MemberMapData memberMapData)
    {
        if (value == null)
        {
            return "\"\""; // Return empty quoted string for null values
        }

        if (value is not string)
        {
            throw new InvalidOperationException($"StringTrimConverter can only be applied to string properties. Invalid value: {value}");
        }

        return "\"" + value.ToString()!.Trim() + "\"";
    }

    public override object ConvertFromString(string? text, IReaderRow row, MemberMapData memberMapData)
    {
        return text?.Trim('\"') ?? string.Empty;
    }
}