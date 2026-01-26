import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Set maxDuration for server actions to prevent timeout during streaming
// This ensures long-running operations (streaming) don't timeout
export const maxDuration = 300; // 5 minutes (should be much faster with optimizations, but prevents browser hanging)

// Calibri-led font stack: Calibri, Inter, Segoe UI, Arial, sans-serif
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "StudyBuddy - MBA Learning Platform",
  description: "Academic reading and analysis platform for MBA students",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} antialiased`}
        style={{ fontFamily: "'Calibri', 'Inter', 'Segoe UI', 'Arial', sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
