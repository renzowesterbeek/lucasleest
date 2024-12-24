import './globals.css'
import type { Metadata } from 'next'
import { Lato } from 'next/font/google'
import Link from 'next/link'

const lato = Lato({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MeesterLucas.nl | Boekenkast',
  description: 'Luister naar de boekenpodcast van Lucas en Betsie',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
              <div className="flex items-center">
                <a
                  href="/admin"
                  className="inline-flex items-center gap-x-1.5 rounded-md bg-[#cc7c5e] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#b56a50] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#cc7c5e]"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Admin
                </a>
              </div>
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
