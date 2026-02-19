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
      <body className="bg-[#F2F2F7] text-[#1C1C1E] antialiased">
        {children}
      </body>
    </html>
  );
}
