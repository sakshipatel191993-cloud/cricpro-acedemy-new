/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        // These directives do not block Stripe navigation or Next.js inline scripts.
        // A full script/connect-src policy needs a separately tested nonce rollout.
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
      ],
    }, {
      source: "/booking-access",
      headers: [
        { key: "Cache-Control", value: "no-store" },
        { key: "Referrer-Policy", value: "no-referrer" },
      ],
    }]
  },
}

export default nextConfig
