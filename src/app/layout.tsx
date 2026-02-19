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
      <body className="bg-[#F2F2F7] text-[#1C1C1E] antialiased">
        {children}
      </body>
    </html>
  );
}
