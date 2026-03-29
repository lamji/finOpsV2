import { NextResponse } from "next/server"

import { generateChatbotReply } from "@/lib/finops-engine"
import { logger } from "@/lib/logger"
import type { ChatbotContext, ChatbotRequest, ChatbotResponse } from "@/lib/types"

export const runtime = "nodejs"

const CODE_PATTERNS = [
  /\bcode\b/i,
  /\btypescript\b/i,
  /\bjavascript\b/i,
  /\breact\b/i,
  /\bnext\.?js\b/i,
  /\bapi\b/i,
  /\bcomponent\b/i,
  /\bfunction\b/i,
  /\bbug\b/i,
  /\bquery\b/i,
  /\bsql\b/i,
  /\bregex\b/i,
  /\bscript\b/i,
  /\bbackend\b/i,
  /\bfrontend\b/i,
]

const PROMPT_PATTERNS = [
  /\bprompt\b/i,
  /\bsystem prompt\b/i,
  /\binstruction\b/i,
  /\bhidden rule\b/i,
  /\bwhat model\b/i,
  /\bwhich model\b/i,
  /\banthropic\b/i,
  /\bhaiku\b/i,
  /\bclaude\b/i,
]

const FINOPS_PATTERNS = [
  /\bfinops\b/i,
  /\bspend\b/i,
  /\bcost\b/i,
  /\bcloud\b/i,
  /\bservice\b/i,
  /\bproject\b/i,
  /\bsku\b/i,
  /\bbudget\b/i,
  /\bburn\b/i,
  /\btrend\b/i,
  /\bforecast\b/i,
  /\bmonthly\b/i,
  /\bmonth\b/i,
  /\bmtd\b/i,
  /\binsight\b/i,
  /\banomaly\b/i,
  /\bdriver\b/i,
]

function tokenizeEntities(context: ChatbotContext): string[] {
  const entityText = [
    ...context.byService.map((item) => item.name),
    ...context.byProject.map((item) => item.name),
    ...context.bySku.map((item) => item.name),
  ]
    .join(" ")
    .toLowerCase()

  return entityText.match(/[a-z0-9][a-z0-9-]{2,}/g) ?? []
}

function buildBlockedResponse(message: string): NextResponse<ChatbotResponse> {
  return NextResponse.json({ message, blocked: true })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ChatbotRequest>
    const message = body.message?.trim() ?? ""
    const context = body.context

    if (!message) {
      return NextResponse.json(
        { message: "Please enter a FinOps question.", blocked: true },
        { status: 400 },
      )
    }

    if (!context) {
      return NextResponse.json(
        { message: "Dashboard context is required for chatbot answers.", blocked: true },
        { status: 400 },
      )
    }

    if (PROMPT_PATTERNS.some((pattern) => pattern.test(message))) {
      return buildBlockedResponse(
        "I can’t discuss prompts, model setup, or internal instructions. I can only answer FinOps questions from this dashboard data.",
      )
    }

    if (CODE_PATTERNS.some((pattern) => pattern.test(message))) {
      return buildBlockedResponse(
        "I can’t help with code or implementation questions here. I can only answer FinOps questions based on the dashboard data.",
      )
    }

    const entityTokens = tokenizeEntities(context)
    const hasFinopsSignal =
      FINOPS_PATTERNS.some((pattern) => pattern.test(message)) ||
      entityTokens.some((token) => message.toLowerCase().includes(token))

    if (!hasFinopsSignal) {
      return buildBlockedResponse(
        "I can only answer FinOps questions grounded in the spend data on this dashboard. Please ask about costs, trends, services, projects, SKUs, or insights.",
      )
    }

    const reply = await generateChatbotReply(message, context)

    return NextResponse.json({
      message:
        reply ||
        "I couldn’t find a supported answer in the current dashboard data. Please ask about spend, trends, services, projects, or SKUs.",
      blocked: false,
    } satisfies ChatbotResponse)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected chatbot error."
    logger.error({ error: message }, "Chatbot request failed")

    return NextResponse.json(
      {
        message:
          "I’m unable to answer right now. Please try again with a FinOps question in a moment.",
        blocked: true,
      } satisfies ChatbotResponse,
      { status: 500 },
    )
  }
}
