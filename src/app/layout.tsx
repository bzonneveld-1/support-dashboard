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
    <html lang="nl" className="dark">
      <body className="bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
