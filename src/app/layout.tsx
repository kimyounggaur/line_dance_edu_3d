import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: '라인댄스 첫걸음 3D', template: '%s · 라인댄스 첫걸음 3D' },
  description: '라인댄스 기본 동작을 발 위치 · 좌우 이동 · 체중 이동 · 카운트 · 방향 전환으로 보고 따라 하는 3D 학습 웹앱',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f4f5f7' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Do+Hyeon&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
