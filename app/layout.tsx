import Script from "next/script";
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Wallet Firewall",
  description: "Know what you're signing before you sign it.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">
        <Providers>{children}</Providers>
	<Script id="eruda" strategy="afterInteractive">{`
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/eruda';
  s.onload = function(){ eruda.init(); };
  document.body.appendChild(s);
`}</Script>
      </body>
    </html>
  );
}
