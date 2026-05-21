import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AVAStudio",
  description: "Content management & multi-account publishing platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
