const withSerwist = require("@serwist/next").default;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output static files for existing pages during transition
  trailingSlash: false,

  // pdfjs-dist must NOT be bundled by webpack — its Node.js legacy build
  // needs to run as a real Node.js require in serverless functions
  // (Next.js 14 requires this under 'experimental')
  serverExternalPackages: ['pdfjs-dist'],

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

module.exports = withSerwist({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
