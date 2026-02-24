import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Support Dashboard",
  description: "Digital whiteboard for support metrics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[var(--dash-bg)] text-[var(--dash-text)] antialiased">
        {children}
      </body>
    </html>
  );
}
