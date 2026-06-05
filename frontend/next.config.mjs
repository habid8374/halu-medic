/** @type {import('next').NextConfig} */
const nextConfig = {
  // El optimizador de imágenes de next/image falla a veces en dev (Windows);
  // sirve los PNG/SVG de /public tal cual.
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
