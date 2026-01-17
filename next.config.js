/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output static files for existing pages during transition
  trailingSlash: false,

  // Optimize images
  images: {
    unoptimized: true, // For Vercel free tier
  },

  // Redirects for old HTML pages
  async redirects() {
    return [
      {
        source: '/privacy.html',
        destination: '/privacy',
        permanent: true,
      },
      {
        source: '/terms.html',
        destination: '/terms',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
