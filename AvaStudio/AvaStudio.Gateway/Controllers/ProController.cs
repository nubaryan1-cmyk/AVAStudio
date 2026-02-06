using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using System.Security.Claims;

namespace AvaStudio.Gateway.Controllers;

[ApiController]
[Route("api/pro")]
public class ProController : ControllerBase
{
    private readonly IConfiguration _config;

    public ProController(IConfiguration config)
    {
        _config = config;
    }

    [HttpGet("ping")]
    [Authorize]
    public async Task<IActionResult> Ping()
    {
        // supabase user id (UUID) из JWT
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue("sub");

        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized(new { error = "no_user_id_in_token" });

        var connStr = _config.GetConnectionString("Supabase");
        if (string.IsNullOrWhiteSpace(connStr))
            return StatusCode(500, new { error = "missing_connection_string", key = "ConnectionStrings:Supabase" });

        await using var conn = new NpgsqlConnection(connStr);
        await conn.OpenAsync();

        // Вариант 1 (типично для Supabase): profiles.id == auth.users.id (sub)
        const string sql = @"select plan_id from public.profiles where user_id = @uid limit 1;";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("uid", Guid.Parse(userId));

        var plan = (await cmd.ExecuteScalarAsync())?.ToString();

        if (!string.Equals(plan, "pro", StringComparison.OrdinalIgnoreCase))
            return StatusCode(403, new { allowed = false, plan_id = plan ?? "null" });

        return Ok(new { allowed = true, plan_id = plan });
    }
}

