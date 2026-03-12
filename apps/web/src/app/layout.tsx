import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DAMAC DocGen - Technical Documentation Platform',
  description: 'Generate professional Technical Design Documents from your codebase using AI.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background">{children}</body>
    </html>
  );
}
