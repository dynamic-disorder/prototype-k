using System.IO;

namespace MediaRenamer.Core.Models;

public class RenamePlanItem
{
    public string OriginalPath { get; }
    public string OriginalName => Path.GetFileName(OriginalPath);
    public string NewName { get; }
    public string NewPath { get; }
    public string Reason { get; }

    public RenamePlanItem(string originalPath, string newName, string reason)
    {
        OriginalPath = originalPath;
        NewName = newName;
        NewPath = Path.Combine(Path.GetDirectoryName(originalPath)!, newName);
        Reason = reason;
    }
}
