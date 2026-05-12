import Groq from 'groq-sdk'
import { NextResponse } from 'next/server'
import { GRADING_PROMPT } from '@/lib/prompts'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request: Request) {
  try {
    const { reportText } = await request.json()
    if (!reportText) return NextResponse.json({ error: 'No report text provided' }, { status: 400 })

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1000,
      messages: [
        { role: 'system', content: GRADING_PROMPT },
        { role: 'user', content: reportText },
      ],
    })

    const raw = response.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return NextResponse.json(parsed)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Review error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
