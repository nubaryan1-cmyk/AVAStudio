using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace AvaStudio.Gateway.Controllers;

[ApiController]
[Route("api/storage")]
[Authorize]
public class StorageController : ControllerBase
{
    private readonly IHttpClientFactory _http;
    private readonly IConfiguration _cfg;

    public StorageController(IHttpClientFactory http, IConfiguration cfg)
    {
        _http = http;
        _cfg = cfg;
    }

    public record PresignRequest(string jobId, string artifactType, string filename, int expiresIn = 3600);

    // POST /api/storage/presign-upload
    [HttpPost("presign-upload")]
    public async Task<IActionResult> PresignUpload([FromBody] PresignRequest req)
    {
        var (bucket, objectKeyOrErr) = BuildKey(req.jobId, req.artifactType, req.filename);
        if (bucket == null) return BadRequest(objectKeyOrErr);

        var urlBase = _cfg["SUPABASE__STAGING__URL"]?.TrimEnd('/');
        var anonKey  = _cfg["SUPABASE__STAGING__ANON_KEY"];

        if (string.IsNullOrWhiteSpace(urlBase) || string.IsNullOrWhiteSpace(anonKey))
            return StatusCode(500, "Missing SUPABASE__STAGING__URL or SUPABASE__STAGING__ANON_KEY");

        // Supabase Storage REST: signed upload URL endpoint uses /storage/v1/object/upload/sign/{bucket}/{path}
        // (см. reference в storage-js: object/upload/sign/{bucketName}/{uploadPath}) :contentReference[oaicite:0]{index=0}
        var path = EscapePath(objectKeyOrErr);
        var endpoint = $"{urlBase}/storage/v1/object/upload/sign/{bucket}/{path}";

        var client = _http.CreateClient();
        client.DefaultRequestHeaders.Clear();
        client.DefaultRequestHeaders.Add("apikey", anonKey);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", GetJwt());

        var payload = JsonSerializer.Serialize(new { expiresIn = req.expiresIn });
        var resp = await client.PostAsync(endpoint, new StringContent(payload, Encoding.UTF8, "application/json"));
        var text = await resp.Content.ReadAsStringAsync();

        return StatusCode((int)resp.StatusCode, text);
    }

    // GET /api/storage/presign-download?jobId=...&artifactType=...&filename=...
    [HttpGet("presign-download")]
    public async Task<IActionResult> PresignDownload([FromQuery] string jobId, [FromQuery] string artifactType, [FromQuery] string filename, [FromQuery] int expiresIn = 3600)
    {
        var (bucket, objectKeyOrErr) = BuildKey(jobId, artifactType, filename);
        if (bucket == null) return BadRequest(objectKeyOrErr);

        var urlBase = _cfg["SUPABASE__STAGING__URL"]?.TrimEnd('/');
        var anonKey  = _cfg["SUPABASE__STAGING__ANON_KEY"];

        if (string.IsNullOrWhiteSpace(urlBase) || string.IsNullOrWhiteSpace(anonKey))
            return StatusCode(500, "Missing SUPABASE__STAGING__URL or SUPABASE__STAGING__ANON_KEY");

        // Supabase Storage REST: presign download endpoint /storage/v1/object/sign/{bucket}/{path} :contentReference[oaicite:1]{index=1}
        var path = EscapePath(objectKeyOrErr);
        var endpoint = $"{urlBase}/storage/v1/object/sign/{bucket}/{path}";

        var client = _http.CreateClient();
        client.DefaultRequestHeaders.Clear();
        client.DefaultRequestHeaders.Add("apikey", anonKey);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", GetJwt());

        var payload = JsonSerializer.Serialize(new { expiresIn });
        var resp = await client.PostAsync(endpoint, new StringContent(payload, Encoding.UTF8, "application/json"));
        var text = await resp.Content.ReadAsStringAsync();

        return StatusCode((int)resp.StatusCode, text);
    }

    private (string? bucket, string objectKeyOrErr) BuildKey(string jobId, string artifactType, string filename)
    {
        // защита от ../
        if (string.IsNullOrWhiteSpace(jobId) || string.IsNullOrWhiteSpace(artifactType) || string.IsNullOrWhiteSpace(filename))
            return (null, "jobId/artifactType/filename required");

        if (jobId.Contains("..") || artifactType.Contains("..") || filename.Contains("..") || filename.Contains("/") || filename.Contains("\\"))
            return (null, "Invalid path parts");

        var uid = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrWhiteSpace(uid)) return (null, "No user id in JWT");

        string bucket = artifactType switch
        {
            "images" => "staging-images",
            "videos" => "staging-videos",
            "lora"   => "staging-lora",
            _ => ""
        };
        if (bucket == "") return (null, "artifactType must be: images | videos | lora");

        // КАНОН: <env>/<user_id>/<job_id>/<artifact_type>/<filename>
        var objectKey = $"staging/{uid}/{jobId}/{artifactType}/{filename}";
        return (bucket, objectKey);
    }

    private string GetJwt()
    {
        var auth = Request.Headers.Authorization.ToString();
        return auth.StartsWith("Bearer ") ? auth.Substring("Bearer ".Length) : auth;
    }

    private static string EscapePath(string s)
        => string.Join("/", s.Split('/').Select(Uri.EscapeDataString));
}
