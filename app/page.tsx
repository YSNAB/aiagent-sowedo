'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'

type Message = {
  role: 'user' | 'assistant'
  content: string
  time: string
}

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: "Hi there! I'm Bob, an AI agent from Sowedo. My job is to get to know your company a little better so we can figure out the best way to help you. This will only take a few minutes — I'll ask you a handful of questions and take it from there. Sound good?",
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionId = useRef<string>('')

  useEffect(() => {
    sessionId.current = crypto.randomUUID()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const userMessage: Message = { role: 'user', content: text, time: now() }
    const history = [...messages, userMessage]
    setMessages(history)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, sessionId: sessionId.current }),
      })

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.error ?? 'Request failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '', time: now() }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content ?? ''
            assistantContent += delta
            // Strip hidden lead score comment before rendering
            const displayContent = assistantContent.replace(/<!--LEAD_SCORE:[\s\S]*?-->/g, '').trimEnd()
            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = { role: 'assistant', content: displayContent, time: updated[updated.length - 1].time }
              return updated
            })
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: message, time: now() },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[radial-gradient(ellipse_at_top,#1e1b4b_0%,#0f172a_50%,#020617_100%)]">
      {/* subtle grid overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 flex flex-col w-full max-w-2xl mx-4 h-[85vh] rounded-3xl overflow-hidden border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl bg-white/4">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 bg-white/3">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/30">
              B
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0f172a]" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Bob</p>
            <p className="text-white/40 text-xs">Sowedo AI Agent</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400/80 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </div>
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 custom-scrollbar">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="shrink-0 w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-indigo-500/20 mt-0.5">
                  B
                </div>
              )}

              <div className="flex flex-col gap-1">
                <div
                  className={`max-w-full rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word ${
                    msg.role === 'user'
                      ? 'bg-indigo-600/80 text-white rounded-br-sm shadow-lg shadow-indigo-500/20'
                      : 'bg-white/7 text-white/90 border border-white/10 rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                  {msg.role === 'assistant' && loading && i === messages.length - 1 && msg.content === '' && (
                    <span className="inline-flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" />
                    </span>
                  )}
                </div>
                {msg.time && (
                  <span className={`text-[10px] text-white/25 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.time}
                  </span>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="shrink-0 w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/60 text-xs font-bold mt-0.5">
                  U
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* ── Input ── */}
        <div className="px-4 py-4 border-t border-white/10 bg-white/2">
          <form onSubmit={sendMessage} className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Message Bob…"
              disabled={loading}
              autoComplete="off"
              className="flex-1 bg-white/7 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-lg shadow-indigo-500/20"
              aria-label="Send message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="text-white translate-x-px">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            </button>
          </form>
          <p className="text-center text-white/20 text-[11px] mt-2">Powered by Kimi K2.5 · Sowedo</p>
        </div>
      </div>
    </div>
  )
}
