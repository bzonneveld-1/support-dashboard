import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Support Dashboard",
  description: "Digitaal whiteboard voor support metrics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body className="bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
