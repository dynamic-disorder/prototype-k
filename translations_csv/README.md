# Translations CSV

A standalone dictionary file (`translations.csv`) used by the CsvTranslations tools. This is the shared data file containing English-to-Finnish word/phrase pairs.

## Purpose

The CSV file serves as the central dictionary for:
- `AddEntryApp` — Adding new entries to the dictionary
- `OllamaTranslatorApp` — Translating entries using offline AI
- `TextToSpeechApp` — Reading entries aloud using Windows SAPI

## Format

The CSV uses a simple two-column format with English words/phrases and their Finnish translations.