import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = { title: '一叶 · 健康记录', description: '每天轻松记录身体与能量', manifest: '/manifest.webmanifest', appleWebApp: { capable: true, title: '一叶' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: '#090b0a' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body>{children}</body></html>; }
