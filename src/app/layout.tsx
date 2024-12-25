'use client';

import './globals.css'
import { Lato } from 'next/font/google'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const lato = Lato({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  display: 'swap',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <html lang="nl" className={lato.className}>
      <body className="bg-[#f2f0e9]">
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#edece4] shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex-shrink-0">
                <Link href="/" className="hover:text-[#cc7c5e] transition-colors">
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-light tracking-wide text-[#cc7c5e]">Uit de boekenkast van</span>
                    <span className="text-xl font-bold tracking-wide text-[#cc7c5e]">meester Lucas</span>
                  </div>
                </Link>
              </div>
              <nav className="hidden md:flex space-x-6">
                <Link 
                  href="/over" 
                  className={`text-[#1a1f36] transition-colors font-medium relative ${
                    isActive('/over') 
                      ? 'text-[#cc7c5e]' 
                      : 'hover:text-[#cc7c5e]'
                  }`}
                >
                  {isActive('/over') && (
                    <span className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-[#cc7c5e] rounded-full" />
                  )}
                  Over
                </Link>
                <Link 
                  href="/feedback" 
                  className={`text-[#1a1f36] transition-colors font-medium relative ${
                    isActive('/feedback') 
                      ? 'text-[#cc7c5e]' 
                      : 'hover:text-[#cc7c5e]'
                  }`}
                >
                  {isActive('/feedback') && (
                    <span className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-[#cc7c5e] rounded-full" />
                  )}
                  Feedback
                </Link>
              </nav>
            </div>
          </div>
        </div>
        <main className="pt-16">
          {children}
        </main>
        <footer className="bg-[#1a1f36] mt-12">
          <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-[#f2f0e9]">
              Een Amsterdams leesbevorderingsproject door Lucas & Renzo Westerbeek. Powered by{' '}
              <a 
                href="https://www.anthropic.com/claude" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#edece4] hover:text-white transition-colors"
              >
                Claude
              </a>
              {' '}&{' '}
              <a 
                href="https://elevenlabs.io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#edece4] hover:text-white transition-colors"
              >
                ElevenLabs
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
