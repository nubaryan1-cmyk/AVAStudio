using System.Net.Http;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();


/* ===== SUPABASE CONFIG (TOP) ===== */
var supabaseUrl = builder.Configuration["SUPABASE__STAGING__URL"];
if (string.IsNullOrWhiteSpace(supabaseUrl))
    throw new InvalidOperationException("Missing config: SUPABASE__STAGING__URL");

var issuer = supabaseUrl.TrimEnd('/') + "/auth/v1";
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = true;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = issuer,

            // STAGING: audience can vary
            ValidateAudience = false,

            ValidateIssuerSigningKey = true,
            RequireSignedTokens = true,

            ValidAlgorithms = new[]
            {
                SecurityAlgorithms.EcdsaSha256
            },

            // ✅ SUPABASE FIX: fetch JWKS and use it for signature validation
            IssuerSigningKeyResolver = (token, securityToken, kid, parameters) =>
            {
                var jwksUrl = issuer + "/.well-known/jwks.json";
                using var http = new HttpClient();
                var json = http.GetStringAsync(jwksUrl).GetAwaiter().GetResult();
                var jwks = new JsonWebKeySet(json);
                return jwks.Keys;
            }
        };
    });

builder.Services.AddControllers();
builder.Services.AddHttpClient();   


// Console.WriteLine($"[SUPABASE_URL] {supabaseUrl}");
// Console.WriteLine($"[ISSUER] {issuer}");

var app = builder.Build();

app.UseCors("dev");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();








