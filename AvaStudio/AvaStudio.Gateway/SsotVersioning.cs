/*
 * SSOT VERSIONING ENFORCEMENT
 * Authority: _CANON/SEMANTICS/SSOT_VERSIONING.md v1.1
 */

namespace AvaStudio.Gateway;

public static class SsotVersioning
{
    public const string DEFAULT_VERSION = "1.0";
    public const string CURRENT_VERSION = "1.1";
    
    private static readonly HashSet<int> SupportedMajorVersions = new() { 1 };
    
    /// <summary>
    /// Normalize ssot_version: return default if null/empty
    /// </summary>
    public static string Normalize(string? version)
    {
        return string.IsNullOrWhiteSpace(version) ? DEFAULT_VERSION : version;
    }
    
    /// <summary>
    /// Parse version string to (major, minor)
    /// </summary>
    public static (int major, int minor) Parse(string version)
    {
        var parts = version.Split('.');
        if (parts.Length != 2)
            throw new FormatException($"Invalid version format: {version}");
        
        return (int.Parse(parts[0]), int.Parse(parts[1]));
    }
    
    /// <summary>
    /// Check if version is supported
    /// </summary>
    public static bool IsSupported(string version)
    {
        try
        {
            var (major, _) = Parse(Normalize(version));
            return SupportedMajorVersions.Contains(major);
        }
        catch
        {
            return false;
        }
    }
    
    /// <summary>
    /// Validate version, throw if unsupported
    /// </summary>
    public static void Validate(string? version)
    {
        var normalized = Normalize(version);
        if (!IsSupported(normalized))
        {
            throw new UnsupportedSsotVersionException(normalized);
        }
    }
}

public class UnsupportedSsotVersionException : Exception
{
    public string Version { get; }
    
    public UnsupportedSsotVersionException(string version) 
        : base($"Unsupported SSOT version: {version}")
    {
        Version = version;
    }
    
    public CanonError ToCanonError()
    {
        return new CanonError(
            ErrorClass.Fatal,
            ErrorCode.FATAL_UNSUPPORTED_SSOT_VERSION,
            $"Unsupported SSOT version: {Version}. Only major version 1 is supported."
        );
    }
}
