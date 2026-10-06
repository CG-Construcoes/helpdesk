import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['imapflow', 'mailparser', 'googleapis'],
  // Otimizações de performance
  compress: true,
  poweredByHeader: false,
  // Melhora o caching estático
  generateEtags: true,
  // Otimizações de imagens
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
  },
  // Otimizações de output
  output: 'standalone',
  experimental: {
    // Otimizações de compilação
    optimizePackageImports: ['@phosphor-icons/react', 'lucide-react'],
  },
};

export default nextConfig;
