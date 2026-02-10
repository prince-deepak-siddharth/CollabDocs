import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CollabDocs — Real-Time Collaborative Editor",
  description: "Create, share, and collaborate on documents in real-time with your team.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
