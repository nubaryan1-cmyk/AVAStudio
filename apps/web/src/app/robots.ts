import type { MetadataRoute } from "next";

const BASE_URL = "https://avastudio.example";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/accounts", "/billing"] },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
