import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8080',
        pathname: '/static/**',
      },
    ],
  },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, canvas: false }
    return config
  },
}

export default nextConfig
