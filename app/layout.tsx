import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GVT End of Day Report',
  description: 'Genesis Virtual Team — daily performance log',
  icons: { icon: '/logo.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
