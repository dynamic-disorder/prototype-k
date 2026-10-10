# GitHub Copilot — Custom Instructions (translations_csv)

**Note:** This section is designed for small Python utilities and CSV tooling within the `translations_csv` folder.
- These instructions are complementary to the root `.github/copilot-instructions.md`. Apply root rules first; use these Python/CSV specifics inside this folder.

## Purpose
- Guidance for small Python utilities and CSV tooling in `translations_csv`.

## Additional/override guidelines (in addition to root)
- Primary language: Python. Prefer small, dependency-free scripts using the standard `csv` module unless a clear benefit from `pandas` is documented.
- Ensure scripts handle UTF-8 and common CSV edge cases (quoting, newlines, encodings).
- Keep CLI scripts simple and idempotent; provide `--help` text and examples in the README.
- When modifying `translations.csv` or helper scripts, keep backup or versioned changes and ensure tests or checks (like CSV schema validations) are added if format changes.
