using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AvaStudio.Gateway.Controllers;

[ApiController]
[Route("api/auth/debug")]
public class AuthDebugController : ControllerBase
{
    [HttpGet("whoami")]
    [Authorize]
    public IActionResult WhoAmI()
    {
        var sub = User.FindFirst("sub")?.Value;
        var email = User.FindFirst("email")?.Value;
        return Ok(new { sub, email });
    }
}

