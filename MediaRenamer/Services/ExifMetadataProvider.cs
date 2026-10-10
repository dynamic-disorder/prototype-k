using MetadataExtractor;
using MetadataExtractor.Formats.Exif;

namespace MediaRenamer.Core.Services;

public class ExifMetadataProvider : IMetadataProvider
{
    private static readonly string[] ImageExtensions = 
        [".jpg", ".jpeg", ".tif", ".tiff", ".png"];

    public DateTime? GetMetadataTimestamp(string path)
    {
        var ext = System.IO.Path.GetExtension(path).ToLowerInvariant();
        if (!ImageExtensions.Contains(ext))
            return null;

        try
        {
            var directories = ImageMetadataReader.ReadMetadata(path);
            var subIfd = directories.OfType<ExifSubIfdDirectory>().FirstOrDefault();
            var date = subIfd?.GetDateTime(ExifDirectoryBase.TagDateTimeOriginal);
            return date;
        }
        catch
        {
            return null;
        }
    }
}
/*
If you want video support later, you can add e.g. VideoMetadataProvider that uses ffprobe and then wrap both in a CompositeMetadataProvider.
*/