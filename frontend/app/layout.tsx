import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css"; // <--- ВОТ ЭТА СТРОКА ВКЛЮЧАЕТ КРАСОТУ

const jetbrains = JetBrains_Mono({ 
  subsets: ["latin"], 
  variable: "--font-mono",
  display: "swap",
});

const space = Space_Grotesk({ 
  subsets: ["latin"], 
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AVA.STUDIO | Core",
  description: "Advanced Neural Orchestration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${space.variable} ${jetbrains.variable} font-sans bg-black text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}