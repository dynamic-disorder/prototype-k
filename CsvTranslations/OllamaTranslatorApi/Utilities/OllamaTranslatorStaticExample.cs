using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace OllamaTranslatorApi.Utilities.Examples;

/// <summary>
/// Example demonstrating usage of OllamaTranslatorStatic wrapper.
/// This shows how to use the static wrapper without dependency injection,
/// with dynamic model switching based on aliases defined in configuration.
/// </summary>
public static class OllamaTranslatorStaticExample
{
    public static async Task RunExample()
    {
        Console.WriteLine("=== OllamaTranslatorStatic Example ===\n");
        
        // Option 1: Automatic initialization (loads default "ollama-config.json")
        // The static wrapper will auto-initialize on first use.
        // You can also explicitly call OllamaTranslatorStatic.Initialize("path/to/config.json");
        
        Console.WriteLine("1. Getting model aliases from configuration:");
        var aliases = OllamaTranslatorStatic.GetModelAliases();
        foreach (var alias in aliases)
        {
            Console.WriteLine($"   - {alias.Key}: {alias.Value}");
        }
        
        Console.WriteLine("\n2. Translating with different model aliases:");
        
        // Translate using default model (from config)
        var text = "Hello world";
        var resultDefault = await OllamaTranslatorStatic.TranslateAsync(text, "default");
        Console.WriteLine($"   Default model ('{OllamaTranslatorStatic.GetModelForAlias("default")}'): {resultDefault}");
        
        // Translate using 'fast' model alias (if defined in config)
        var resultFast = await OllamaTranslatorStatic.TranslateAsync(text, "fast");
        Console.WriteLine($"   Fast model ('{OllamaTranslatorStatic.GetModelForAlias("fast")}'): {resultFast}");
        
        // Translate using 'accurate' model alias (if defined in config)
        var resultAccurate = await OllamaTranslatorStatic.TranslateAsync(text, "accurate");
        Console.WriteLine($"   Accurate model ('{OllamaTranslatorStatic.GetModelForAlias("accurate")}'): {resultAccurate}");
        
        Console.WriteLine("\n3. Batch translation example:");
        var texts = new List<string> { "Good morning", "Thank you", "How are you?" };
        Console.WriteLine($"   Translating {texts.Count} texts with default model...");
        
        var batchResults = await OllamaTranslatorStatic.BatchTranslateAsync(texts, "default");
        for (int i = 0; i < texts.Count; i++)
        {
            Console.WriteLine($"   - '{texts[i]}' â†’ '{batchResults[i]}'");
        }
        
        Console.WriteLine("\n4. Using custom prompt override:");
        var customPrompt = "Translate '{text}' to Finnish and add emoji at the end.";
        var customResult = await OllamaTranslatorStatic.TranslateAsync("Good night", "default", customPrompt);
        Console.WriteLine($"   Custom prompt result: {customResult}");
        
        Console.WriteLine("\n=== Example Complete ===");
    }
    
    // Simple console program entry point for demonstration
    public static async Task Main(string[] args)
    {
        try
        {
            await RunExample();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
        }
    }
}