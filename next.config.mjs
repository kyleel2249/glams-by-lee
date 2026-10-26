/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];
const supabaseHost = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname; } catch { return null; } })();
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: process.env.NEXT_IMAGES_UNOPTIMIZED === '1', formats: ['image/avif', 'image/webp'], remotePatterns: supabaseHost ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }] : [] },
  async headers() { return [{ source: '/:path*', headers: securityHeaders }]; },
};
export default nextConfig;
