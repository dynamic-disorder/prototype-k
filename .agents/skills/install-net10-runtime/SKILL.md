---
name: install-net10-runtime
description: Install the .NET 10 runtime on an end-user Windows machine that will run the published apps.
disable-model-invocation: true
---

# Install the .NET 10 runtime

Run `local_dev/scripts/install-net10-runtime.ps1` on the end-user Windows machine:

```powershell
powershell -ExecutionPolicy Bypass -File local_dev/scripts/install-net10-runtime.ps1
```

It checks `dotnet --list-runtimes` for `Microsoft.NETCore.App 10.0` and, when missing, downloads
the official installer and installs the runtime user-locally, then prints the install directory
to add to `PATH`. No elevated rights are needed.

It stays PowerShell on purpose: it runs on end-user Windows machines, where PowerShell is always
present and Node is not.
