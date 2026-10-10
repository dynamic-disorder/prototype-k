using MediaRenamer.Core.Models;

namespace MediaRenamer.Core.Services;

public interface IMetadataProvider
{
    DateTime? GetMetadataTimestamp(string path);
}
