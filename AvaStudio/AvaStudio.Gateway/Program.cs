using System.Net.Http;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
string[] GetCorsOrigins(string key) =>
    builder.Configuration.GetSection($"Cors:{key}Origins").Get<string[]>() ?? Array.Empty<string>();
var environmentName = builder.Environment.EnvironmentName;
var corsOrigins = environmentName switch
{
    Environments.Development => GetCorsOrigins("Dev"),
    Environments.Staging => GetCorsOrigins("Staging"),
    Environments.Production => GetCorsOrigins("Prod"),
    _ => GetCorsOrigins("Dev")
};
if (corsOrigins.Length == 0)
{
    throw new InvalidOperationException($"Missing CORS origins for {environmentName} environment.");
}
builder.Services.AddCors(options =>
{
    options.AddPolicy("cors", policy =>
    {
        policy.WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});


/* ===== SUPABASE CONFIG (TOP) ===== */
var supabaseUrl = builder.Configuration["SUPABASE__STAGING__URL"];
if (string.IsNullOrWhiteSpace(supabaseUrl))
    throw new InvalidOperationException("Missing config: SUPABASE__STAGING__URL");

var issuer = supabaseUrl.TrimEnd('/') + "/auth/v1";
var httpClient = new HttpClient();
builder.Services.AddSingleton(httpClient);
var configManager = new ConfigurationManager<OpenIdConnectConfiguration>(
    $"{issuer}/.well-known/openid-configuration",
    new OpenIdConnectConfigurationRetriever(),
    new HttpDocumentRetriever(httpClient) { RequireHttps = true }
);
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = true;
        options.ConfigurationManager = configManager;

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
            }
        };
    });

builder.Services.AddControllers();
builder.Services.AddHttpClient();   


// Console.WriteLine($"[SUPABASE_URL] {supabaseUrl}");
// Console.WriteLine($"[ISSUER] {issuer}");

var app = builder.Build();

app.UseCors("cors");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();






