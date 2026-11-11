import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Project 2.0 — Xerebro Core',
  description: 'Superfície operacional para síntese, sinais e governança do Xerebro Core.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" className="bg-background"><body className={`${inter.className} font-sans`}>{children}</body></html>
}
