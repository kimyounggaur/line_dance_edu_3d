import type { NextConfig } from 'next';

// 정적 내보내기: `npm run build` → out/ (Vercel 또는 아무 정적 호스팅에 올릴 수 있다)
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
