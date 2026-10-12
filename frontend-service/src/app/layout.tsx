import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { RagChatbot } from "@/components/RagChatbot";

export const metadata: Metadata = {
  title: "Intelligent Supply Chain Dashboard",
  description:
    "Production-grade control tower for AI-driven inventory and reordering operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Navbar />
          {children}
          <RagChatbot />
        </ThemeProvider>
      </body>
    </html>
  );
}
