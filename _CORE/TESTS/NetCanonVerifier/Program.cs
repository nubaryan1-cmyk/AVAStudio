using System;
using System.IO;
using System.Text.Json;

if (args.Length == 0) {
    Console.WriteLine("[FAIL] No path provided to .NET Verifier");
    Environment.Exit(1);
}

string jsonPath = args[0];

if (!File.Exists(jsonPath)) {
    Console.WriteLine("[FAIL] JSON not found at: " + jsonPath);
    Environment.Exit(1);
}

try {
    string json = File.ReadAllText(jsonPath);
    using JsonDocument doc = JsonDocument.Parse(json);
    int count = doc.RootElement.GetProperty("states").GetArrayLength();
    Console.WriteLine("[.NET PROOF] Loaded " + count + " states from generated JSON OK.");
} catch (Exception ex) {
    Console.WriteLine("[FAIL] JSON Error: " + ex.Message);
    Environment.Exit(1);
}
