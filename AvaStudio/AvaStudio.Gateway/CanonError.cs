/*
 * CANON ERROR TAXONOMY ENFORCEMENT
 * Authority: _CANON/SEMANTICS/ERROR_TAXONOMY.md v1.1
 * Status: ENFORCEMENT REQUIRED
 */

namespace AvaStudio.Gateway;

/// <summary>
/// Canonical error classes (from ERROR_TAXONOMY.md)
/// </summary>
public static class ErrorClass
{
    public const string Infra = "infra";
    public const string User = "user";
    public const string Model = "model";
    public const string Quota = "quota";
    public const string Fatal = "fatal";
    
    public static readonly HashSet<string> AllClasses = new()
    {
        Infra, User, Model, Quota, Fatal
    };
    
    public static bool IsValid(string errorClass) => AllClasses.Contains(errorClass);
}

/// <summary>
/// Stable error codes with canonical prefix
/// </summary>
public static class ErrorCode
{
    // Infrastructure
    public const string INFRA_TIMEOUT = "INFRA_TIMEOUT";
    public const string INFRA_NETWORK_ERROR = "INFRA_NETWORK_ERROR";
    public const string INFRA_UPSTREAM_UNAVAILABLE = "INFRA_UPSTREAM_UNAVAILABLE";
    public const string INFRA_MISCONFIG = "INFRA_MISCONFIG";
    
    // User
    public const string USER_INVALID_INPUT = "USER_INVALID_INPUT";
    public const string USER_UNAUTHORIZED = "USER_UNAUTHORIZED";
    public const string USER_NOT_FOUND = "USER_NOT_FOUND";
    
    // Quota
    public const string QUOTA_RATE_LIMIT = "QUOTA_RATE_LIMIT";
    
    // Fatal
    public const string FATAL_INTERNAL = "FATAL_INTERNAL";
    public const string FATAL_UNSUPPORTED_SSOT_VERSION = "FATAL_UNSUPPORTED_SSOT_VERSION";
}

/// <summary>
/// Canonical error object structure
/// </summary>
public record CanonError(
    string @class,
    string code,
    string message
);

/// <summary>
/// API error envelope with trace ID for correlation
/// </summary>
public record ErrorEnvelope(
    string trace_id,
    CanonError error
);
