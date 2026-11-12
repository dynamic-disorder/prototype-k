# Test Anti-Patterns

Shared by `test-unit-generate`.

## Array access

Never index directly (`results[0]`, `jsonNode["documents"][0]`): it throws `IndexOutOfRangeException` when the data is smaller than assumed. Assert the count first, then use `First()`, `Single()` or `ElementAt()`.

```csharp
const int expectedMinCount = 2;
var actualItems = response.Items;
Assert.That(actualItems.Count, Is.GreaterThanOrEqualTo(expectedMinCount),
    "the API should return at least 2 items for the test query");
var actualFirstItem = actualItems.First();

var actualDocuments = jsonNode?["documents"]?.AsArray();
Assert.That(actualDocuments, Is.Not.Null, "the response should contain a documents array");
var actualFirstDoc = actualDocuments!.First();
```

## Assertion messages

Every assertion states the expected behavior, not just "should be true".
- **NUnit** (API E2E): message as the last parameter.
- **xUnit built-in** (new unit tests): `Assert.Equal` has no message parameter, so rely on `expected`/`actual` naming and `Assert.Multiple`.

```csharp
Assert.That(response.Ok, Is.True,
    "the request was well-formed and the user is authorized to access this endpoint");
```

## Naming

`const`/`var` named `expectedX` for expected values, `actualX` for results from the code under test.

## FakeItEasy (unit tests)

Mock interfaces, not concrete classes derived from abstracts.

