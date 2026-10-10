using System.Reflection;
using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;

// ildump <assembly.dll> [typeFullName]
// Prints declared types (or, for a given type, its members) with accessibility flags.

if (args.Length < 1)
{
    Console.Error.WriteLine("usage: ildump <assembly.dll> [typeFullName]");
    return 2;
}

using var fs = File.OpenRead(args[0]);
using var pe = new PEReader(fs);
MetadataReader md = pe.GetMetadataReader();

Console.WriteLine($"assembly: {md.GetString(md.GetAssemblyDefinition().Name)}");
foreach (CustomAttributeHandle ah in md.GetAssemblyDefinition().GetCustomAttributes())
{
    CustomAttribute ca = md.GetCustomAttribute(ah);
    Console.WriteLine($"  [assembly attr] {Dump.AttrName(md, ca)}");
}
Console.WriteLine();

string? filter = args.Length > 1 ? args[1] : null;

foreach (TypeDefinitionHandle th in md.TypeDefinitions)
{
    TypeDefinition td = md.GetTypeDefinition(th);
    string full = Dump.FullName(td, md);
    if (filter is not null
        && !full.Equals(filter, StringComparison.Ordinal)
        && !full.EndsWith("+" + filter, StringComparison.Ordinal))
    {
        continue;
    }

    Console.WriteLine($"type {full}  ({Dump.Access(td.Attributes)})");
    foreach (MethodDefinitionHandle mh in td.GetMethods())
    {
        MethodDefinition m = md.GetMethodDefinition(mh);
        Console.WriteLine($"    method {Dump.Access(m.Attributes),-8} {md.GetString(m.Name)}");
    }
    foreach (FieldDefinitionHandle fh in td.GetFields())
    {
        FieldDefinition f = md.GetFieldDefinition(fh);
        Console.WriteLine($"    field  {Dump.Access(f.Attributes),-8} {md.GetString(f.Name)}");
    }
    Console.WriteLine();
}

return 0;

internal static class Dump
{
    public static string FullName(TypeDefinition td, MetadataReader r)
    {
        string ns = r.GetString(td.Namespace);
        string nm = r.GetString(td.Name);
        return string.IsNullOrEmpty(ns) ? nm : ns + "." + nm;
    }

    public static string AttrName(MetadataReader md, CustomAttribute ca) => ca.Constructor.Kind switch
    {
        HandleKind.MemberReference => md.GetString(md.GetMemberReference((MemberReferenceHandle)ca.Constructor).Name),
        HandleKind.MethodDefinition => md.GetString(md.GetMethodDefinition((MethodDefinitionHandle)ca.Constructor).Name),
        _ => "?",
    };

    public static string Access(TypeAttributes a)
    {
        if (a.HasFlag(TypeAttributes.Public)) return "public";
        if (a.HasFlag(TypeAttributes.NotPublic)) return "internal";
        return "?" + a;
    }

    public static string Access(MethodAttributes a)
    {
        if (a.HasFlag(MethodAttributes.Public)) return "public";
        if (a.HasFlag(MethodAttributes.Assembly)) return "internal";
        if (a.HasFlag(MethodAttributes.Family)) return "protected";
        if (a.HasFlag(MethodAttributes.Private)) return "private";
        return "?";
    }

    public static string Access(FieldAttributes a)
    {
        if (a.HasFlag(FieldAttributes.Public)) return "public";
        if (a.HasFlag(FieldAttributes.Assembly)) return "internal";
        if (a.HasFlag(FieldAttributes.Family)) return "protected";
        if (a.HasFlag(FieldAttributes.Private)) return "private";
        return "?";
    }
}
