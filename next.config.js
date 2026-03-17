/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output static files for existing pages during transition
  trailingSlash: false,

  // pdfjs-dist must NOT be bundled by webpack — its Node.js legacy build
  // needs to run as a real Node.js require in serverless functions
  // (Next.js 14 requires this under 'experimental')
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist'],
  },

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
