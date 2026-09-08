import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {"/api/companies/*/invoices/*/pdf": ["./assets/invoice-fonts/DejaVuSans.ttf"], "/workspace": ["./assets/invoice-fonts/DejaVuSans.ttf"]},
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
    useTypeScriptCli: false,
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
      ],
    }];
  },
};

export default nextConfig;
