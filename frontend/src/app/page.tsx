import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        <h1 className="heading-fantasy text-5xl mb-4">D&D VTT</h1>
        <hr className="divider-gold" />
        <p className="text-xl text-parchment/80 mb-8 font-body">
          Виртуальный стол для приключений
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-dark-card border border-gold text-gold hover:bg-dark-hover hover:text-gold-light transition-colors font-fantasy text-sm tracking-wider uppercase"
          >
            Войти
          </Link>
          <Link
            href="/register"
            className="px-6 py-3 bg-ember hover:bg-ember-dark text-parchment transition-colors font-fantasy text-sm tracking-wider uppercase"
          >
            Регистрация
          </Link>
        </div>
      </div>
    </main>
  )
}
