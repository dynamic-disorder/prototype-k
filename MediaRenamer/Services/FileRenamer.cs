using System.IO;

using MediaRenamer.Core.Models;

namespace MediaRenamer.Core.Services;

public class FileRenamer
{
    private readonly IMetadataProvider _metadataProvider;

    public FileRenamer(IMetadataProvider metadataProvider)
    {
        _metadataProvider = metadataProvider;
    }

    public IReadOnlyList<RenamePlanItem> BuildRenamePlan(
        IEnumerable<string> files,
        string pattern = "yyyyMMdd_HHmmss")
    {
        var result = new List<RenamePlanItem>();

        foreach (var file in files)
        {
            var metaTs = _metadataProvider.GetMetadataTimestamp(file);
            var info = new MediaFileInfo(file, metaTs);
            var ts = info.GetBestTimestamp();

            var baseName = ts.ToString(pattern);
            var ext = System.IO.Path.GetExtension(file).ToLowerInvariant();

            var newName = baseName + ext;
            var reason = metaTs.HasValue ? "EXIF/metadata" : "File creation time";

            // Avoid collisions by appending counter if needed
            var dir = System.IO.Path.GetDirectoryName(file)!;
            var finalName = newName;
            var counter = 1;
            while (File.Exists(Path.Combine(dir, finalName)))
            {
                finalName = $"{baseName}_{counter}{ext}";
                counter++;
            }

            result.Add(new RenamePlanItem(file, finalName, reason));
        }

        return result;
    }

    public void ApplyRename(IEnumerable<RenamePlanItem> plan, bool dryRun)
    {
        foreach (var item in plan)
        {
            if (dryRun)
                continue;

            if (!File.Exists(item.OriginalPath))
                continue;

            if (File.Exists(item.NewPath))
                continue;

            File.Move(item.OriginalPath, item.NewPath);
        }
    }
}
