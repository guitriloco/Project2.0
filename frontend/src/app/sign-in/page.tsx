import Link from 'next/link'
import { AuthForm } from '@/components/auth-form'

export default function SignInPage() {
  return <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12"><div className="flex w-full max-w-md flex-col gap-5"><AuthForm /><Link href="/" className="text-center text-sm text-muted-foreground hover:text-foreground">Voltar para a página inicial</Link></div></main>
}
