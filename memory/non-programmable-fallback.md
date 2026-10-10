---
name: non-programmable-fallback
description: Provide manual instructions to user when programmatic execution is impossible due to environment/permission constraints
metadata:
  type: feedback
---

Tell me what to do if you cannot do it programmatically. If a task requires changes that require specific privileges, system-level permissions, or interaction outside the standard tool set (e.g., PowerShell Execution Policy), clearly explain the situation and provide the exact commands/steps for the user to perform manually.
**Why:** The user wants clear guidance when my internal tools are insufficient due to external environment limitations.
**How to apply:** When blocked by system settings or permissions, provide a "manual fix" block with instructions like "Run [command] in your terminal."