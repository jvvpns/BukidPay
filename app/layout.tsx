import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "BukidPay — Pay once. Settle the whole hike.",
  description:
    "Verified payment settlement for organized hiking and outdoor events.",
  icons: {
    icon: "/brand/bukidpay-mark.svg",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
