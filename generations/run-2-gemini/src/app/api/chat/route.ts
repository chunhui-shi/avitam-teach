import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { messages, lessonTitle, lessonContent } = await req.json();

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      system: `You are an AI teaching assistant for an online coding course. 
      The student is currently on a lesson titled "${lessonTitle}". 
      The content of the lesson is: "${lessonContent}".
      Your goal is to answer the student's questions about this specific lesson. 
      Keep your answers concise, helpful, and educational. 
      If the student asks something unrelated, gently guide them back to the topic.`,
      messages: messages.map((m: { role: "user" | "assistant"; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    });

    return NextResponse.json({ 
      content: response.content[0].type === 'text' ? response.content[0].text : 'Sorry, I could not generate a response.' 
    });
  } catch (error) {
    console.error("[CHAT_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
