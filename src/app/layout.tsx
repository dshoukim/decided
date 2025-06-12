import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PHProvider } from './providers/posthog-provider';
import { AuthProvider } from '@/components/providers/auth-provider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Decided",
  description: "Collaborative movie selection made fun.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PHProvider>
          <AuthProvider>
            <main className="min-h-screen bg-background flex flex-col items-center">
              {children}
            </main>
          </AuthProvider>
        </PHProvider>
      </body>
    </html>
  );
}
