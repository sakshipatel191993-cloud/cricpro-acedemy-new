import { Inter, JetBrains_Mono } from "next/font/google"
import type { Metadata } from "next";
import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/lib/context/auth"
import { SiteChrome } from "@/components/site-chrome"
import { cn } from "@workspace/ui/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Cricpro Centre of Excellence",
  description: "Cricpro Centre of Excellence is a premier cricket training facility dedicated to nurturing and developing the next generation of cricketing talent. Our academy offers world-class coaching, state-of-the-art facilities, and a comprehensive training program designed to help aspiring cricketers reach their full potential. Whether you're a beginner looking to learn the basics or an experienced player aiming to refine your skills, Cricpro Centre of Excellence provides the perfect environment for growth and success in the sport of cricket.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <ThemeProvider>
          <AuthProvider>
            <SiteChrome>{children}</SiteChrome>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
