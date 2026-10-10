using System.IO;

namespace MediaRenamer.Core.Models;

public class MediaFileInfo
{
    public string FullPath { get; }
    public string Filename => Path.GetFileName(FullPath);
    public string Extension => Path.GetExtension(FullPath);
    public DateTime? MetadataTimestamp { get; }
    public DateTime FileCreationTime { get; }
    public DateTime FileLastWriteTime { get; }

    public MediaFileInfo(string fullPath, DateTime? metadataTimestamp)
    {
        FullPath = fullPath;
        MetadataTimestamp = metadataTimestamp;
        var fi = new FileInfo(fullPath);
        FileCreationTime = fi.CreationTime;
        FileLastWriteTime = fi.LastWriteTime;
    }

    public DateTime GetBestTimestamp()
        => MetadataTimestamp ?? FileCreationTime;
}
