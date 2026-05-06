import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are an EODR quality reviewer for Genesis Virtual Team (GVT), placing Filipino virtual professionals with Australian SME clients. Return ONLY raw JSON, no markdown fences, no preamble:
{"score":<1-10>,"verdict":"<Excellent|Good|Needs improvement|Insufficient>","strengths":["...","..."],"improvements":["...","..."],"links_feedback":"<one sentence>","followup_questions":["..."],"summary":"<2 sentences>"}

Scoring: 9-10=specific outcomes with numbers+strong specific recommendation+labelled links+deadlines. 7-8=good detail minor gaps. 5-6=vague tasks or generic recommendation. 3-4=brief no outcomes. 1-2=insufficient.
Check: tasks grouped by project, outcomes not just activities, recommendation specific not generic, next actions have deadlines, links labelled with task name not just URL.
Follow-up questions only if score<7, else return [].`

export async function POST(request: Request) {
  try {
    const { reportText } = await request.json()

    if (!reportText) {
      return NextResponse.json({ error: 'No report text provided' }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: reportText }],
    })

    const raw = message.content
      .filter(block => block.type === 'text')
      .map(block => (block.type === 'text' ? block.text : ''))
      .join('')

    const result = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return NextResponse.json(result)
  } catch (error) {
    console.error('Review error:', error)
    return NextResponse.json({ error: 'Review failed' }, { status: 500 })
  }
}
