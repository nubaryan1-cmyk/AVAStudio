/*
 * ERROR MAPPER - HTTP Status to Canon Error
 * Authority: _CANON/SEMANTICS/ERROR_TAXONOMY.md v1.1
 */

namespace AvaStudio.Gateway;

public static class ErrorMapper
{
    /// <summary>
    /// Map HTTP status code and response body to canonical error
    /// </summary>
    public static CanonError FromHttpUpstream(int statusCode, string? body = null)
    {
        var (errorClass, errorCode, defaultMessage) = statusCode switch
        {
            400 or 422 => (ErrorClass.User, ErrorCode.USER_INVALID_INPUT, "Invalid request"),
            401 or 403 => (ErrorClass.User, ErrorCode.USER_UNAUTHORIZED, "Unauthorized"),
            404 => (ErrorClass.User, ErrorCode.USER_NOT_FOUND, "Resource not found"),
            408 or 504 => (ErrorClass.Infra, ErrorCode.INFRA_TIMEOUT, "Request timed out"),
            429 => (ErrorClass.Quota, ErrorCode.QUOTA_RATE_LIMIT, "Rate limit exceeded"),
            502 or 503 => (ErrorClass.Infra, ErrorCode.INFRA_UPSTREAM_UNAVAILABLE, "Upstream service unavailable"),
            _ => (ErrorClass.Fatal, ErrorCode.FATAL_INTERNAL, "Internal server error")
        };
        
        // Use body if available, but truncate for safety
        var message = !string.IsNullOrEmpty(body) && body.Length <= 200 
            ? body 
            : defaultMessage;
        
        return new CanonError(errorClass, errorCode, message);
    }
    
    /// <summary>
    /// Map exception to canonical error
    /// </summary>
    public static CanonError FromException(Exception ex)
    {
        return ex switch
        {
            TimeoutException or TaskCanceledException => 
                new CanonError(ErrorClass.Infra, ErrorCode.INFRA_TIMEOUT, "Operation timed out"),
            
            HttpRequestException httpEx when httpEx.Message.Contains("connection") =>
                new CanonError(ErrorClass.Infra, ErrorCode.INFRA_NETWORK_ERROR, "Network error"),
            
            UnauthorizedAccessException =>
                new CanonError(ErrorClass.User, ErrorCode.USER_UNAUTHORIZED, "Access denied"),
            
            ArgumentException or FormatException =>
                new CanonError(ErrorClass.User, ErrorCode.USER_INVALID_INPUT, "Invalid input"),
            
            InvalidOperationException when ex.Message.Contains("not configured") =>
                new CanonError(ErrorClass.Infra, ErrorCode.INFRA_MISCONFIG, ex.Message),
            
            _ => new CanonError(ErrorClass.Fatal, ErrorCode.FATAL_INTERNAL, "Internal server error")
        };
    }
    
    /// <summary>
    /// Create error for missing configuration
    /// </summary>
    public static CanonError MissingConfig(string configName)
    {
        return new CanonError(
            ErrorClass.Infra,
            ErrorCode.INFRA_MISCONFIG,
            $"{configName} not configured"
        );
    }
    
    /// <summary>
    /// Create error for invalid input
    /// </summary>
    public static CanonError InvalidInput(string message)
    {
        return new CanonError(
            ErrorClass.User,
            ErrorCode.USER_INVALID_INPUT,
            message
        );
    }
}
