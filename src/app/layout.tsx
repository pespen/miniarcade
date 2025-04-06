import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MiniArcade",
  description: "Play games in your browser",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="p-3 shadow-lg">
          <div className="container mx-auto flex justify-center items-center">
            <Link href="/">
              <h1 className="text-2xl font-bold text-cyan-400 cursor-pointer hover:text-cyan-300 transition-colors">
                MiniArcade
              </h1>
            </Link>
          </div>
        </header>
        <main className="flex-grow flex flex-col">{children}</main>
        <footer className="py-2 mt-auto">
          <div className="container mx-auto text-center">
            <p className="text-indigo-300 text-sm">Peder Espen | © 2025</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
