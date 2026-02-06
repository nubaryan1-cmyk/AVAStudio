using System.IO;
using Microsoft.AspNetCore.Mvc;
using Stripe;
using Stripe.Checkout;
using Npgsql;
using Dapper;

namespace AvaStudio.Gateway.Controllers;

[ApiController]
[Route("api/stripe/webhook")]
public class StripeWebhookController : ControllerBase
{
    private readonly IConfiguration _config;

    public StripeWebhookController(IConfiguration config)
    {
        _config = config;
    }

    [HttpPost]
    public async Task<IActionResult> Handle()
    {
        var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
        var signatureHeader = Request.Headers["Stripe-Signature"].ToString();
        var webhookSecret = _config["STRIPE__STAGING__WEBHOOK_SECRET"];

        Stripe.Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(json, signatureHeader, webhookSecret);
        }
        catch
        {
            return BadRequest();
        }

        var connString = _config.GetConnectionString("Supabase");
        await using var conn = new NpgsqlConnection(connString);

        // Stripe event types as strings (works with all Stripe.net versions)
        if (stripeEvent.Type == "checkout.session.completed")
        {
            var session = stripeEvent.Data.Object as Session;
            if (session == null) return Ok();

            var userId = session.ClientReferenceId; // мы передаём user_id сюда из /api/stripe/checkout
            if (string.IsNullOrWhiteSpace(userId)) return Ok();

            await conn.ExecuteAsync(@"
                update public.profiles
                set
                    plan_id = 'pro',
                    stripe_customer_id = @customerId,
                    stripe_subscription_id = @subscriptionId,
                    updated_at = now()
                where user_id = @userId::uuid
            ", new
            {
                userId,
                customerId = session.CustomerId,
                subscriptionId = session.SubscriptionId
            });

            return Ok();
        }

        if (stripeEvent.Type == "customer.subscription.deleted")
        {
            var sub = stripeEvent.Data.Object as Subscription;
            if (sub == null) return Ok();

            await conn.ExecuteAsync(@"
                update public.profiles
                set
                    plan_id = 'free',
                    stripe_subscription_id = null,
                    updated_at = now()
                where stripe_subscription_id = @subId
            ", new { subId = sub.Id });

            return Ok();
        }

        return Ok();
    }
}
