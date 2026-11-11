/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['*.vercel.run', '*.run.app'],
}

module.exports = nextConfig
