# Test Helper Method Patterns

## Anti-Pattern: Generic Helper with Many Parameters

**DON'T** create a single helper with 10+ optional parameters:

```csharp
// WRONG - impossible to read at call site
private OrderProcessor CreateOrderProcessor(
    OrderProcessorConfiguration config,
    List<IOrderMessage> orders,
    bool canProcess,
    int processDelayMs = 0,
    bool processThrows = false,
    bool archiveThrows = false,
    Action<CallInfo>? onFetchOrders = null,
    Action<CallInfo>? onCanProcess = null,
    Action<CallInfo>? onProcess = null,
    Action<CallInfo>? onArchive = null) { ... }
```

## Pattern: Scenario-Specific Factories

**DO** create specialized factory methods per scenario (≤3 params):

```csharp
// CORRECT - each factory has a clear purpose
private OrderProcessor CreateOrderProcessorWithOrders(Action<CallInfo>? onArchive = null) { ... }
private OrderProcessor CreateOrderProcessorWithNoOrders(Action<CallInfo>? onFetchOrders = null) { ... }
private OrderProcessor CreateOrderProcessorWithSlowProcessing(int thresholdSeconds, int delayMs, Action<CallInfo>? onArchive = null) { ... }
private OrderProcessor CreateOrderProcessorWithArchiveFailure(Action<CallInfo>? onArchive = null) { ... }
private OrderProcessor CreateOrderProcessorWithProcessFailure(Action<CallInfo>? onProcess = null) { ... }
```

## Pattern: SetupSut() with Optional Overrides

Use `SetupSut()` when multiple tests share 80%+ identical setup. Add optional parameters for variations:

```csharp
[Fact]
public async Task Process_ValidData_ReturnsSuccess()
{
    // Given: Use defaults from SetupSut() with expected success
    const bool expectedSuccess = true;
    var sut = SetupSut();
    var input = new ProcessRequest { Data = "valid" };
    ProcessResult? actualResult = null;
    _processor.Process(Arg.Any<ProcessRequest>()).Returns(x => (actualResult = new ProcessResult { Success = true }));

    // When: Processing and capturing actual result
    actualResult = await sut.Process(input);

    // Then: Actual result is success
    Assert.Equal(expectedSuccess, actualResult.Success);
}

[Fact]
public async Task Process_ValidData_LogsOperation()
{
    // Given: Defaults with logging setup
    var sut = SetupSut();
    var input = new ProcessRequest { Data = "valid" };

    // When: Processing
    await sut.Process(input);

    // Then: Logged
    _logger.Received(1).Log("Processing started");
}

[Fact]
public async Task Process_WhenProcessorFails_PropagatesException()
{
    // Given: Override processor to fail
    var sut = SetupSut(processorThrows: true);
    var input = new ProcessRequest { Data = "bad" };

    // When/Then: Throws
    await Assert.ThrowsAsync<InvalidOperationException>(() => sut.Process(input));
}

private Handler SetupSut(bool processorThrows = false, string? environment = null)
{
    environment ??= "test";
    
    if (processorThrows)
    {
        _processor.Process(Arg.Any<ProcessRequest>()).Returns(Task.FromException(new InvalidOperationException()));
    }
    else
    {
        _processor.Process(Arg.Any<ProcessRequest>()).Returns(new ProcessResult { Success = true });
    }

    return new Handler(_processor, _logger, environment);
}
```

**SetupSut() guidelines:**
- **≤3 parameters**: Optional booleans or enums for variations (`processorThrows`, `userRole`)
- **Null coalescing for defaults**: Use `??` to set sensible defaults
- **Returns a fully-configured SUT**: All mocks and dependencies wired up
- **Extract when**: Same 5+ line setup appears in 2+ tests, changing only 1-2 mock behaviors

## Guidelines

- **Name reveals intent**: `CreateHandlerWithInvalidUser()`, not `CreateHandler(userValid: false)`
- **≤3 parameters**: If you need more, create a new specialized helper
- **Single responsibility**: Each helper sets up one specific test scenario
- **Optional callbacks only**: Use `Action<CallInfo>?` parameters ONLY for test lifecycle hooks
- **No boolean flags for scenarios**: Create separate methods instead of `CreateHandler(bool valid)` - EXCEPTION: use flags in `SetupSut(processorThrows: true)` for variations
- **Distinguish helpers**: Use `CreateHandlerWith*()` for scenario-specific factories, `SetupSut()` for reusable base setup with optional overrides
