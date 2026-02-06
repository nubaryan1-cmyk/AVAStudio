using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Stripe;
using Stripe.Checkout;
using System.Security.Claims;

namespace AvaStudio.Gateway.Controllers;

[ApiController]
[Route("api/stripe")]
public class StripeController : ControllerBase
{
    private readonly IConfiguration _config;

    public StripeController(IConfiguration config)
    {
        _config = config;

        var apiKey = _config["STRIPE__STAGING__SECRET_KEY"];
        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            StripeConfiguration.ApiKey = apiKey;
        }
    }

    [HttpPost("checkout")]
    [Authorize]
    public IActionResult CreateCheckoutSession()
    {
        var priceId = _config["STRIPE__STAGING__PRICE_ID"];
        if (string.IsNullOrWhiteSpace(priceId))
            return BadRequest("STRIPE__STAGING__PRICE_ID not configured");

        // JWT user id:
        // В ASP.NET Core "sub" часто мапится в ClaimTypes.NameIdentifier
        var userId =
            User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        if (string.IsNullOrWhiteSpace(userId))
            return Unauthorized("No user id in JWT (missing sub/NameIdentifier)");

        var options = new SessionCreateOptions
        {
            Mode = "subscription",

            // ВАЖНО: именно это и нужно для webhook -> связка Stripe checkout с user_id
            ClientReferenceId = userId,

            LineItems = new List<SessionLineItemOptions>
            {
                new()
                {
                    Price = priceId,
                    Quantity = 1
                }
            },

            SuccessUrl = "http://localhost:3000/billing/success",
            CancelUrl  = "http://localhost:3000/billing/cancel"
        };

        var service = new SessionService();
        var session = service.Create(options);

        return Ok(new { url = session.Url });
    }
}
