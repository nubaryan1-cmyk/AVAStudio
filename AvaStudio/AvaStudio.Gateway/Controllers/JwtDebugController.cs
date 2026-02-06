using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Linq;

namespace AvaStudio.Gateway.Controllers;

[ApiController]
[Route("api/auth")]
public class JwtDebugController : ControllerBase
{
    [HttpGet("claims")]
    [Authorize]
    public IActionResult Claims()
    {
        var claims = User.Claims
            .Select(c => new { c.Type, c.Value })
            .OrderBy(x => x.Type)
            .ToList();

        return Ok(new { count = claims.Count, claims });
    }
}
