import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Citation Index — SCTA",
  description:
    "Citation index for the SCTA Scholastic Corpus — browse which passages cite which sources.",
};

// Apply the persisted (or system) theme before first paint to avoid a flash.
const NO_FLASH = `(function(){try{var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
