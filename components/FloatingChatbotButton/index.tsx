"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowUp, BotMessageSquare, LoaderCircle, Sparkles, X } from "lucide-react"

import { useDashboard } from "@/Presentation/Dashboard/useDashboard"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { ChatbotContext, ChatbotMessage, ChatbotResponse } from "@/lib/types"

export function FloatingChatbotButton() {
  const {
    financialOverview,
    charts,
    byService,
    byProject,
    bySku,
    summary,
    alerts,
    isLoading,
  } =
    useDashboard()
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<ChatbotMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      content:
        "Hello, this is FinOps Copilot. I can help explain spend, trends, top services, projects, SKUs, and the current dashboard insights.",
    },
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasConversation = messages.some((entry) => entry.role === "user")
  const showSuggestedPrompts = !hasConversation && message.trim().length === 0

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(message.length, message.length)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [isOpen, message.length])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [isOpen, messages])

  const focusInput = () => {
    if (!isOpen) {
      return
    }

    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(message.length, message.length)
    })
  }

  const context: ChatbotContext | null = summary
    ? {
        statistics: financialOverview,
        charts,
        byService,
        byProject,
        bySku,
        summary,
        aiInsights: alerts,
      }
    : null

  async function submitMessage() {
    const trimmed = message.trim()

    if (!trimmed || isSubmitting) {
      focusInput()
      return
    }

    if (!context || isLoading) {
      setMessages((current) => [
        ...current,
        { id: `user-${Date.now()}`, role: "user", content: trimmed },
        {
          id: `assistant-${Date.now() + 1}`,
          role: "assistant",
          content: "I’m still loading the FinOps dashboard context. Please try again in a moment.",
          blocked: true,
        },
      ])
      setMessage("")
      focusInput()
      return
    }

    const userMessage: ChatbotMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    }

    setMessages((current) => [...current, userMessage])
    setMessage("")
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          context,
        }),
      })

      const body = (await response.json()) as ChatbotResponse

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now() + 2}`,
          role: "assistant",
          content: body.message,
          blocked: body.blocked,
        },
      ])
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now() + 3}`,
          role: "assistant",
          content:
            "I’m unable to answer right now. Please try again with a FinOps question in a moment.",
          blocked: true,
        },
      ])
    } finally {
      setIsSubmitting(false)
      focusInput()
    }
  }

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] sm:right-6 sm:bottom-6">
      <div className="flex flex-col items-end gap-3">
        <div
          className={cn(
            "pointer-events-auto w-[min(22rem,calc(100vw-2rem))] origin-bottom-right transition-all duration-300",
            isOpen
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-3 scale-95 opacity-0"
          )}
          aria-hidden={!isOpen}
        >
          <Card className="overflow-hidden border-border/70 bg-card/95 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl">
            <CardContent className="space-y-4 p-0">
              <div className="border-b border-border/60 bg-[radial-gradient(circle_at_top_left,_color-mix(in_oklab,var(--color-primary)_18%,transparent),_transparent_58%),linear-gradient(135deg,_color-mix(in_oklab,var(--color-card)_82%,white),_var(--color-card))] px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    <Sparkles className="size-3.5 text-foreground" />
                    Assistant
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close chatbot panel"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">
                    FinOps Copilot
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Ask about cost spikes, top services, or monthly spend trends.
                  </div>
                </div>
              </div>

              <div className="space-y-3 px-4 pb-4" onClick={focusInput}>
                <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                  {messages.map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        "max-w-[90%] rounded-2xl border px-3 py-2 text-sm leading-relaxed",
                        entry.role === "user"
                          ? "ml-auto border-slate-700 bg-slate-800 text-white"
                          : entry.blocked
                            ? "border-amber-200 bg-amber-50 text-amber-950"
                            : "border-border/60 bg-muted/35 text-foreground"
                      )}
                    >
                      {entry.content}
                    </div>
                  ))}
                  {isSubmitting && (
                    <div className="max-w-[90%] rounded-2xl border border-border/60 bg-muted/35 px-3 py-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <LoaderCircle className="size-4 animate-spin" />
                        Reviewing the current FinOps data...
                      </span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                {showSuggestedPrompts && (
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Why did spend increase this month?",
                      "What are the top services by spend?",
                      "Summarize this month in simple terms.",
                    ].map((prompt) => (
                      <Button
                        key={prompt}
                        variant="outline"
                        size="sm"
                        className="rounded-full border-border/60 bg-background text-xs text-muted-foreground"
                        onClick={() => {
                          setMessage(prompt)
                          window.requestAnimationFrame(() => {
                            inputRef.current?.focus()
                            inputRef.current?.setSelectionRange(prompt.length, prompt.length)
                          })
                        }}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                )}
                <div className="rounded-2xl border border-border/70 bg-background/90 p-2 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Input
                      ref={inputRef}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      onBlur={focusInput}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          void submitMessage()
                        }
                      }}
                      placeholder="Ask FinOps Copilot anything..."
                      aria-label="Chatbot message input"
                      className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
                    />
                    <Button
                      size="icon-sm"
                      className="size-9 rounded-full"
                      aria-label="Send chatbot message"
                      onClick={() => void submitMessage()}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <ArrowUp className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Button
          size="icon"
          className={cn(
            "pointer-events-auto relative size-14 rounded-full border border-white/35 bg-[linear-gradient(135deg,#43526b,#1f2937)] text-white shadow-[0_16px_40px_rgba(15,23,42,0.28)] transition-transform duration-200 hover:scale-[1.03] focus-visible:scale-[1.03]",
            isOpen && "scale-[1.03]"
          )}
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Collapse chatbot launcher" : "Open chatbot launcher"}
        >
          <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.28),_transparent_58%)]" />
          <span className="absolute -top-1 -left-1 flex size-5 items-center justify-center rounded-full bg-white/90 text-[9px] font-semibold tracking-[0.14em] text-slate-700 shadow-sm">
            AI
          </span>
          <span className="absolute right-1.5 bottom-1.5 size-2.5 rounded-full bg-emerald-300 ring-4 ring-slate-900/35" />
          <BotMessageSquare className="relative z-10 size-6" />
        </Button>
      </div>
    </div>
  )
}
