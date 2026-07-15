import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/exam/", "/review/", "/practice/", "/auth/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
