import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import Sidebar from "@/components/Sidebar";

export const metadata = {
  title: "Cadastro Eleitoral RN — Estatísticas de Locais de Votação",
  description: "Dashboard interativo com estatísticas de locais de votação, seções eleitorais e mesários do Rio Grande do Norte.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <div className="flex h-screen overflow-hidden bg-zinc-950">
            <Sidebar />
            <div className="flex-1 overflow-y-auto relative">
              {children}
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
