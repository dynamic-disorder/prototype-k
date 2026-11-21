# UI patterns: MVVM and its platform reality

**TL;DR** — MVVM is first-class in WPF, UWP, WinUI 3, .NET MAUI and Avalonia: the framework supplies binding, change notification and commands, and a ViewModel can be tested without the UI. Vue is MVVM-influenced, not MVVM: it has two-way binding and a reactive ViewModel-like object, but no command abstraction, no ViewModel-first convention and no ViewModel base class. Use MVVM where binding is the view's composition mechanism; do not import the class machinery into Vue.

## The concept card

| Concept | What it does | Use when | Do not use when | Smallest proof |
| :--- | :--- | :--- | :--- | :--- |
| MVVM | Splits the view (XAML or template), the view model (state and commands, with change notification) and the model (domain) | The framework has binding and commands, two or more views share state, or presentation logic must be tested without the UI | One window with no testable presentation logic; no binding layer; the view model would mirror every control | A view-model test runs without instantiating the view; one binding updates; one command executes |
| ViewModel-first / navigation | A conductor, template or router chooses the view from the view model or the route | The framework supports view-model-first resolution (Caliburn conductors, MAUI Shell, Avalonia navigation, Vue Router) | Navigation is one line of code-behind in a one-window tool | The navigation target is resolved from a view-model type or route, not a hard-coded window |
| Commands | `ICommand` binds an action and its `CanExecute` state to a control | Buttons, menu items and toolbar actions need enable/disable logic | The framework has no command abstraction (Vue) | `CanExecute` returning false disables the bound control |
| Two-way binding | An edit in the view flows back to the view model | Form inputs, sliders, editable grids | The value is display-only | Editing the control updates the view model; a view-model change re-renders the control |

## The pattern, in the framework's terms

- **View** — `Window`, `Page`, `UserControl`, or a `.vue` single-file component. Code-behind stays UI-only (focus, animation, a control the binding cannot express).
- **View model** — the properties and commands the view binds to, plus change notification. It does not reference the view or its controls. It may reference the model.
- **Model** — domain data and rules, unaware of the view model.
- **Binding** — the connection. WPF/UWP/WinUI/MAUI/Avalonia bind through `DataContext`/`BindingContext`; Vue binds through its template compiler (`{{ }}`, `:prop`, `v-model`).
- **Commands** — `ICommand` (`Execute`, `CanExecute`, `CanExecuteChanged`) in the .NET XAML frameworks. Vue calls a method from the template and binds `:disabled` to a computed boolean.

The main benefit is not "no code-behind". It is that the presentation logic has a home that a unit test can instantiate without a window, a renderer or a device.

## Platform reality

| Platform | MVVM status | Binding | Commands | Compiled binding | Usual base | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **WPF** | First-class | `{Binding}`, `DataContext`, `DataTemplate` | `ICommand` | No `x:Bind`; `{Binding}` is runtime | `CommunityToolkit.Mvvm` | Caliburn.Micro, Prism and ReactiveUI are established alternatives |
| **UWP** | First-class | `{Binding}` runtime; `{x:Bind}` compiled | `ICommand` | `x:Bind` is compiled and typed; it also binds events | `CommunityToolkit.Mvvm` | `x:Bind` is the performance path; `{Binding}` stays runtime |
| **WinUI 3** | First-class | Same XAML model as UWP | `ICommand` | `x:Bind` | `CommunityToolkit.Mvvm` | Same pattern on the Windows App SDK; the view-model code carries over, the XAML namespaces differ |
| **.NET MAUI** | First-class | `{Binding}`; `x:DataType` for compiled bindings | `ICommand`; the built-in `Command` class | `x:DataType`; `Source` bindings may need `MauiEnableXamlCBindingWithSourceCompilation` | `CommunityToolkit.Mvvm` | Microsoft's own MVVM tutorial installs the Toolkit and uses `ObservableObject` and `AsyncRelayCommand` |
| **Avalonia UI** | First-class | `{Binding}`; `CompiledBinding` via `x:DataType` | `ICommand` | `x:DataType` (with `x:CompileBindings` where not project-wide) | `CommunityToolkit.Mvvm` | Avalonia's docs call the Toolkit "the recommended MVVM framework"; ReactiveUI is the other official template variant |
| **Vue.js** | MVVM-influenced, not MVVM | `{{ }}`, `:prop`, `v-model` (two-way) | No `ICommand`; methods called from the template | Template compilation, not XAML | No MVVM toolkit; `ref`/`reactive`/`computed` | The unit is a component or composable; Vue's docs say it is not strictly MVVM but partly inspired by it, and Vue 3 is component-first |

## Vue is the same separation with different machinery

Do not port a WPF view model into Vue. Map the intent:

| MVVM | Vue 3 |
| :--- | :--- |
| View | `.vue` single-file component `<template>` |
| View model | `setup()` returning `ref`/`reactive`/`computed`, or a composable for reuse |
| Model | The same domain types; keep them out of the template |
| `{Binding}` / `x:Bind` | `{{ }}`, `:prop`, `v-model` |
| `ICommand` | A method called by `@click`; disabled state via `:disabled` |
| `CanExecute` | A computed boolean bound to `:disabled` |
| View-model-first navigation | Vue Router plus component composition |
| `INotifyPropertyChanged` | Vue reactivity (`ref`/`reactive`) |
| Constructor injection | Props, `provide`/`inject`, or a Pinia store |
| View-model unit test | Vitest plus `@vue/test-utils`, or a composable test |

The separation survives; the class, the command object and the `PropertyChanged` event do not. Vue's idiom is the component, not the view model. That is not a downgrade: it is the framework's composition model.

## Why it pays, and what it costs

**Pays when.**

- The view model is testable without the UI; that is the main return.
- Two or more views share the same state or commands.
- A designer and a developer work on the same screen.
- Navigation, validation and enable/disable logic would otherwise live in code-behind.
- The framework already supplies binding; MVVM is mostly free at that point.

**Costs.**

- Boilerplate: change notification, commands, converters, navigation services, dependency injection.
- Bindings are late-bound strings unless compiled bindings are on; errors then surface at runtime.
- A view model that mirrors every control is a second view with extra steps.
- Logic leaks into converters and attached behaviors, where it is harder to test.
- Convention-based frameworks (Caliburn) buy less code at the price of magic and a stronger lock-in.

## When not to use it

- **A one-window tool with no testable presentation logic.** Code-behind is cheaper, and Microsoft's own MAUI tutorial warns that MVVM can encourage overengineering.
- **No binding or command layer.** Immediate-mode UI, a game loop, or a framework where the view is rebuilt every frame.
- **The view model is a property bag** that copies each control's state. That is ceremony, not separation.
- **Nobody will test the view model.** The main benefit is gone; keep the simpler path.
- **Vue.** Use components, composables and Pinia. A ViewModel base class, a command object and a `PropertyChanged` event are foreign to the framework.

## Toolkit selection

| Toolkit | Use it when | Notes |
| :--- | :--- | :--- |
| **CommunityToolkit.Mvvm** | Default for WPF, UWP, WinUI 3, MAUI and Avalonia | Targets .NET Standard and .NET 6+, so it is platform-agnostic; source generators for `[ObservableProperty]` and `[RelayCommand]`; messenger; maintained by Microsoft and the .NET Foundation. Both MAUI's tutorial and Avalonia's docs use it |
| **Caliburn.Micro** | You want convention-based, view-model-first screens and conductors, and you already use it | An opinionated MVVM framework for XAML platforms. V5 (14 Oct 2025) adds beta adapters for Avalonia and MAUI plus WinUI 3; the site still lists 4.x as current, so treat the new adapters as beta |
| **Prism** | Modules, regions, navigation and DI in a large WPF or MAUI app | Heavier than the Toolkit; the value is the modularity and navigation, not the binding |
| **ReactiveUI** | The team already thinks in reactive pipelines (`WhenAny`, `ReactiveCommand`) | Avalonia's official template offers a ReactiveUI variant; the non-reactive variant uses the Toolkit |
| **Vue's own stack** | Any Vue app | Pinia for shared state, Vue Router for navigation, Vitest and `@vue/test-utils` for tests. There is no MVVM toolkit to add |

## In C#

A minimal view model with the Toolkit:

```csharp
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

public partial class RenameViewModel : ObservableObject
{
    private readonly IFileStore _service;

    public RenameViewModel(IFileStore service) => _service = service;

    [ObservableProperty]
    private string _newName = "";

    [RelayCommand(CanExecute = nameof(CanRename))]
    private void Rename() => _service.Rename(NewName);

    private bool CanRename() => !string.IsNullOrWhiteSpace(NewName);
}
```

The view binds `NewName` two-way and `RenameCommand` to the button; `CanRename` disables the button without code-behind. The test constructs `RenameViewModel` with a fake service and asserts the call, with no window.

## Applying it here

- **The WPF/UWP MVVM habit transfers to MAUI and Avalonia.** The binding, change notification and command model is the same; the Toolkit is the low-risk base on all four. Caliburn.Micro's conventions remain a good fit for existing WPF/UWP work, but its MAUI and Avalonia adapters are beta.
- **Vue is not MVVM.** Keep the separation (state and logic outside the template), use components and composables, and use Pinia for shared state; do not add a ViewModel base class.
- **One WPF tool does not need MVVM by default.** Add it when a second view appears or the presentation logic must be tested; code-behind is the honest choice before that.
- **The proof is a view-model test without the UI.** If the screen cannot be tested that way, the pattern is not paying for itself.

## Sources

Checked 2026-11-21. The corpus has no MVVM, WPF, UWP, MAUI, Avalonia or Vue content; this reference is outside it.

- [Introduction to the MVVM Toolkit](https://learn.microsoft.com/en-us/dotnet/communitytoolkit/mvvm/) — platforms, package scope, when to use it.
- [WPF data binding overview](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/data/) — the WPF `Binding` and `DataContext` model.
- [Data binding and MVVM](https://learn.microsoft.com/en-us/dotnet/maui/xaml/fundamentals/mvvm) — the MAUI view/view-model/model model.
- [Upgrade your app with MVVM concepts](https://learn.microsoft.com/en-us/dotnet/maui/tutorials/notes-mvvm) — installs `CommunityToolkit.Mvvm`, uses `ObservableObject` and `AsyncRelayCommand`, and warns that MVVM can encourage overengineering.
- [Compiled bindings](https://learn.microsoft.com/en-us/dotnet/maui/fundamentals/data-binding/compiled-bindings) — `x:DataType` and the compiled-binding diagnostics.
- [How to: Implement common MVVM patterns](https://docs.avaloniaui.net/docs/how-to/mvvm-how-to) — Avalonia calls `CommunityToolkit.Mvvm` the recommended MVVM framework.
- [Compiled bindings](https://docs.avaloniaui.net/docs/data-binding/compiled-bindings) — `x:DataType` and `x:CompileBindings`.
- [Caliburn.Micro V5 release notes](https://caliburnmicro.com/announcements/Caliburn-Micro-V5) — Avalonia and MAUI beta adapters, WinUI 3 support, 14 Oct 2025.
- [Prism](https://prismlibrary.com/) — modules, regions and navigation for WPF and MAUI.
- [ReactiveUI and Avalonia](https://www.reactiveui.net/vs/avalonia/) — the Avalonia template's ReactiveUI variant and when the Toolkit is the simpler stack.
- [x:Bind markup extension](https://learn.microsoft.com/en-us/windows/uwp/xaml-platform/x-bind-markup-extension) — compiled binding and event binding in UWP.
- [Vue 2 instance docs](https://v2.vuejs.org/v2/guide/instance.html) — Vue's own wording: "not strictly associated with the MVVM pattern" but "partly inspired by it", with `vm` as a convention; Vue 2 is EOL.
- [Vue v-model](https://vuejs.org/guide/components/v-model.html) and [Composition API FAQ](https://vuejs.org/guide/extras/composition-api-faq.html) — the Vue 3 binding and composition model.
