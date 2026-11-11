'use client'

export function AuthForm() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-2xl shadow-primary/5">
      <div className="mb-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">Xerebro Core</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Acesso desabilitado</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">O acesso por email, senha e código temporário está temporariamente desativado.</p>
      </div>
    </div>
  )
}
