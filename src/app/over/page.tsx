'use client';

import Image from 'next/image';

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="relative h-64 sm:h-80 mb-8">
          <Image
            src="/images/library.jpg"
            alt="Bibliotheek afbeelding"
            fill
            style={{ objectFit: 'cover' }}
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 p-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              Over de Boekenkast van meester Lucas
            </h1>
            <p className="text-lg text-gray-200">
              Een project voor leesbevordering
            </p>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Ons verhaal
            </h2>
            <p className="text-gray-600 leading-relaxed">
              De boekenkast van meester Lucas is ontstaan uit een passie voor lezen en een wens om literatuur toegankelijker te maken voor iedereen. 
              Als leerkracht merkte Lucas dat veel kinderen moeite hebben met lezen, niet omdat ze het niet kunnen, 
              maar omdat ze de juiste motivatie en toegang missen. Dit project is onze manier om daar verandering in te brengen.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Het team
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-medium text-gray-900 mb-2">Lucas Westerbeek</h3>
                <p className="text-gray-600">
                  Leerkracht, mentor en boekenliefhebber. Lucas is de stem achter de podcasts en brengt zijn ervaring 
                  uit het onderwijs mee om verhalen op een boeiende manier te vertellen.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium text-gray-900 mb-2">Renzo Westerbeek</h3>
                <p className="text-gray-600">
                  Architect, softwareontwikkelaar en technisch brein achter het project. Renzo zorgt ervoor dat de 
                  technologie naadloos werkt om de verhalen bij de luisteraars te brengen.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              De rol van AI
            </h2>
            <p className="text-gray-600 leading-relaxed">
              Dit project zou zonder de recente ontwikkelingen in AI-technologie niet mogelijk zijn geweest. 
              De combinatie van twee krachtige AI-tools maakt het mogelijk om op grote schaal kwalitatieve 
              boekbesprekingen te creëren: Claude, een taalmodel van Anthropic, helpt bij het schrijven van 
              de besprekingen, terwijl ElevenLabs&apos; stemtechnologie deze omzet naar natuurlijk klinkende audio.
            </p>
            <p className="text-gray-600 leading-relaxed mt-4">
              Voor leerlingen die moeite hebben met lezen of voor wie de stap naar een boek te groot voelt, bieden onze podcasts 
              een laagdrempelige introductie. Ze kunnen eerst luisteren naar een boekbespreking, enthousiast raken 
              over het verhaal, en vervolgens gemotiveerd worden om het boek zelf te lezen. Deze aanpak was zonder 
              AI ondenkbaar geweest - het zou te tijdrovend en kostbaar zijn om voor elk boek handmatig een 
              podcast te produceren.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Doe Mee
            </h2>
            <p className="text-gray-600 leading-relaxed">
              We staan altijd open voor suggesties en samenwerkingen. Heb je een boek dat je graag besproken 
              zou zien worden? Of wil je op een andere manier bijdragen? Laat het ons weten via onze{' '}
              <a href="/feedback" className="text-blue-600 hover:text-blue-800 underline">
                feedbackpagina
              </a>
              . Samen maken we literatuur toegankelijker voor iedereen.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
} 