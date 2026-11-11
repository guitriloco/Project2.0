'use client'

import { FormEvent, useMemo, useState } from 'react'
import { Bot, ChevronRight, Loader2, Plus, Send, Sparkles, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

type Message = { id: number; role: 'assistant' | 'user'; content: string; time: string }

const suggestions = ['Como está a saúde do core?', 'Resuma os sinais críticos', 'O que devo priorizar agora?']

export function XerebroChat() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', content: 'Conexão estabelecida. Sou o Xerebro, sua camada de síntese operacional. O que você quer entender agora?', time: '09:41' },
  ])
  const [value, setValue] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const nextId = useMemo(() => messages.length + 1, [messages.length])

  async function submit(event?: FormEvent) {
    event?.preventDefault()
    if (!value.trim() || isThinking) return
    const text = value.trim()
    const userMessage: Message = { id: nextId, role: 'user', content: text, time: 'agora' }
    const conversation = [...messages, userMessage]
    setMessages(conversation)
    setValue('')
    setIsThinking(true)

    try {
      const response = await fetch('/api/xerebro/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId, messages: conversation.map(({ role, content }) => ({ role, content })) }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      setConversationId(payload.conversationId ?? conversationId)
      setMessages((current) => [...current, { id: nextId + 1, role: 'assistant', content: payload.text ?? 'O Xerebro não retornou uma síntese textual.', time: 'agora' }])
    } catch {
      setMessages((current) => [...current, { id: nextId + 1, role: 'assistant', content: 'Não consegui alcançar o Xerebro Core agora. Verifique se o backend está online e tente novamente.', time: 'agora' }])
    } finally {
      setIsThinking(false)
    }
  }

  return (
    <Card className="flex min-h-[590px] flex-col overflow-hidden border-border/70 bg-card/80 shadow-2xl shadow-primary/5">
      <CardHeader className="flex-row items-center justify-between border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary"><Bot /></div><div><p className="font-semibold tracking-tight">Xerebro Chat</p><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">interface de síntese</p></div></div>
        <Button variant="ghost" size="sm" onClick={() => { setMessages([]); setConversationId(null) }} aria-label="Iniciar novo contexto"><Plus data-icon="inline-start" />Novo contexto</Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5 p-5">
        <div className="flex items-center gap-2"><Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">CORE ONLINE</Badge><span className="font-mono text-[10px] text-muted-foreground">sessão local · dados em tempo real</span></div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1" aria-live="polite">
          {messages.length === 0 && <div className="m-auto flex max-w-sm flex-col items-center gap-3 text-center"><Sparkles className="text-primary" /><p className="font-medium">Novo contexto pronto</p><p className="text-sm leading-6 text-muted-foreground">Pergunte sobre a operação, sinais do sistema ou uma recomendação de prioridade.</p></div>}
          {messages.map((message) => <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`flex max-w-[82%] gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}><div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">{message.role === 'user' ? <User /> : <Bot />}</div><div className={`rounded-xl border px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'border-primary/30 bg-primary text-primary-foreground' : 'border-border/70 bg-muted/40'}`}><p>{message.content}</p><span className="mt-2 block font-mono text-[10px] opacity-60">{message.time}</span></div></div></div>)}
          {isThinking && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="animate-spin" />Xerebro está sintetizando...</div>}
        </div>
        <div className="flex flex-wrap gap-2">{suggestions.map((suggestion) => <Button key={suggestion} variant="outline" size="sm" onClick={() => setValue(suggestion)} className="text-xs">{suggestion}<ChevronRight data-icon="inline-end" /></Button>)}</div>
        <form onSubmit={submit} className="flex items-end gap-2 rounded-xl border border-border bg-background/70 p-2 focus-within:border-primary/60"><Textarea value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); submit() } }} placeholder="Pergunte ao Xerebro..." className="min-h-12 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0" aria-label="Mensagem para o Xerebro" /><Button type="submit" size="icon" disabled={!value.trim() || isThinking} aria-label="Enviar mensagem"><Send data-icon="inline-start" /></Button></form>
        <p className="text-center font-mono text-[10px] text-muted-foreground">Enter envia · Shift + Enter quebra linha</p>
      </CardContent>
    </Card>
  )
}

export default XerebroChat
