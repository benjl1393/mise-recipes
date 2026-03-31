import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistPixelSquare } from "geist/font/pixel";
import "./globals.css";

export const metadata: Metadata = {
  title: "Order Up",
  description: "Extract recipes from any source. Download as markdown.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistMono.variable} ${GeistPixelSquare.variable}`}>
      <body className={`${GeistMono.className} antialiased`}>{children}</body>
    </html>
  );
}
