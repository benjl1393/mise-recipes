import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const openGorton = localFont({
  src: [
    {
      path: "./fonts/OpenGorton-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/OpenGorton-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-open-gorton",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Recipe Archiver",
  description: "Extract recipes from any source. Download as markdown.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={openGorton.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
