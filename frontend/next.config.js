/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel deployment: no static export needed since we use API routes client-side
  // and the backend is on Render. Keep SSR for dynamic pages.
  async redirects() {
    return [
      // Defensive: any old or mistyped routes go to home
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },
  // Ensure trailing slashes don't cause 404s
  trailingSlash: false,
  // Strict mode for catching issues early
  reactStrictMode: true,
};

module.exports = nextConfig;
