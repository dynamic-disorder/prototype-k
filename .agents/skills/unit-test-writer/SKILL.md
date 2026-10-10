---
name: unit-test-writer
description: Write xUnit tests with Shouldly assertions and NSubstitute substitutes for this repo's C# code.
---

# unit-test-writer

xUnit, **Shouldly** for assertions, **NSubstitute** for substitutes. **Moq is banned** (its
SponsorLink history) — use `Substitute.For<T>()` or a hand-written fake.

## Where tests live

Flat beside the code in a sibling `{Project}.Tests/` directory — this repo does not mirror
production subfolders — with namespace `{Project}.Tests`:

- `FilenameTools/FilenameSanitizer/FilenameNormalizer.cs` →
  `FilenameTools/FilenameSanitizer.Tests/FilenameNormalizerTests.cs`

Directory casing must match the disk exactly: a wrong-case `ProjectReference` is silently skipped
at restore on Linux.

## Conventions

- `public sealed class <ClassName>Tests` in `<ClassName>Tests.cs`; one `/// <summary>` on the class,
  not on individual test methods.
- Test names: `MethodName_StateUnderTest_ExpectedBehaviour`. The underscores are why each test
  `.csproj` carries `<NoWarn>CA1707</NoWarn>`.
- `// Given:` / `// When:` / `// Then:` sections; `[Theory]` + `[InlineData]` for parameterized cases.
- Name the system under test `sut`, built by a small scenario-specific factory rather than a field.
- Assert observable outcomes; reach for `Received()` mainly on error paths where there is no state
  to observe. Prefer one hand-written fake over repeated substitute setup shared by many tests.
- Don't run the tests unless asked.

```csharp
namespace FilenameSanitizer.Tests;

/// <summary>Covers renaming files for OS requirements and applying configured patterns.</summary>
public sealed class FilenameNormalizerTests
{
    private readonly IFileSystem _fileSystem = Substitute.For<IFileSystem>();

    [Fact]
    public void RenameFiles_DirtyName_RenamesToSanitizedForm()
    {
        // Given: a file whose name needs sanitizing
        _fileSystem.GetFiles(Arg.Any<string>()).Returns(["bad name.txt"]);
        var sut = CreateNormalizerWithPatterns();

        // When: the renamer runs
        sut.RenameFilesToMeetOsRequirements();

        // Then: the file has the sanitized name
        _fileSystem.Received().MoveFile("bad name.txt", "bad_name.txt");
    }
}
```
