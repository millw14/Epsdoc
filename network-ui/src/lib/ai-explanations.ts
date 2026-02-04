/**
 * AI Explanations - Interrogation style from Epstein's perspective
 */

import { useState, useCallback } from 'react';
import type { Relationship } from '../types';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function buildSystemPrompt(): string {
  return `You are roleplaying as Jeffrey Epstein being interrogated about your connections and activities. 
When asked about a person, respond as if you're being questioned in a deposition - evasive but revealing.

Guidelines:
- Speak in first person as Epstein
- Be somewhat defensive and evasive, but facts slip out
- Reference specific events, dates, and locations from the data provided
- Use phrases like "I don't recall exactly...", "That's not how I'd characterize it...", "We may have crossed paths..."
- Never fully admit wrongdoing but hint at the nature of relationships
- Keep responses to 2-3 sentences
- Base everything ONLY on the relationship data provided - don't make up events`;
}

function buildChatSystemPrompt(): string {
  return `You are roleplaying as Jeffrey Epstein being interrogated. You're in a deposition and must answer questions about your activities, locations you visited, people you knew, and events you were involved in.

Guidelines:
- Speak in first person as Epstein
- Be evasive but let details slip when pressed
- Reference specific events, dates, locations, and people from the evidence provided
- Use phrases like "I don't recall exactly...", "That's not how I'd characterize it...", "We may have crossed paths...", "My lawyers advised me not to discuss..."
- When asked about locations, reference who you met there and what happened
- When asked about people, hint at the nature of your relationship without full admission
- When asked general questions, give vague but suggestive answers
- Keep responses to 2-4 sentences
- Base everything ONLY on the relationship data provided - don't make up events
- If asked about something not in the data, say you don't recall or invoke the Fifth`;
}

function buildUserPrompt(entityName: string, relationships: Relationship[]): string {
  const events = relationships.slice(0, 15).map(r => {
    const other = r.actor === entityName ? r.target : r.actor;
    const date = r.timestamp || 'unknown date';
    const loc = r.location ? ` at ${r.location}` : '';
    return `- ${date}: ${r.actor} ${r.action} ${r.target}${loc}`;
  }).join('\n');

  return `Mr. Epstein, tell us about your relationship with ${entityName}. We have records of these events:\n\n${events}\n\nWhat can you tell us about ${entityName}?`;
}

function buildChatContext(relationships: Relationship[], question: string): string {
  // Extract relevant context based on the question
  const questionLower = question.toLowerCase();
  
  // Filter relationships based on question content
  let relevantRels = relationships;
  
  // Check for location mentions
  const locationMatches = relationships.filter(r => 
    r.location && questionLower.includes(r.location.toLowerCase())
  );
  if (locationMatches.length > 0) {
    relevantRels = locationMatches;
  }
  
  // Check for person mentions
  const personMatches = relationships.filter(r => 
    questionLower.includes(r.actor.toLowerCase()) || 
    questionLower.includes(r.target.toLowerCase())
  );
  if (personMatches.length > 0) {
    relevantRels = [...new Set([...relevantRels, ...personMatches])];
  }
  
  // Limit to most relevant entries
  const events = relevantRels.slice(0, 20).map(r => {
    const date = r.timestamp || 'unknown date';
    const loc = r.location ? ` at ${r.location}` : '';
    return `- ${date}: ${r.actor} ${r.action} ${r.target}${loc}`;
  }).join('\n');
  
  // Add some general stats
  const locations = [...new Set(relationships.filter(r => r.location).map(r => r.location))];
  const people = [...new Set(relationships.flatMap(r => [r.actor, r.target]))];
  
  return `[EVIDENCE DATABASE]
Known locations: ${locations.slice(0, 15).join(', ')}
Known associates: ${people.slice(0, 20).join(', ')}

Relevant events:
${events}

[INTERROGATOR'S QUESTION]
${question}`;
}

export async function generateExplanation(
  entityName: string,
  relationships: Relationship[]
): Promise<string> {
  if (!GROQ_API_KEY) {
    return "I'm not answering questions without my lawyer present.";
  }

  if (relationships.length === 0) {
    return "I don't believe I know that person. You'll have to be more specific.";
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(entityName, relationships) }
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "I decline to answer that question.";
  } catch (error) {
    console.error('AI generation error:', error);
    return "I'm invoking my Fifth Amendment rights on that one.";
  }
}

export function useAIExplanation() {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async (entityName: string, relationships: Relationship[]) => {
    setLoading(true);
    setExplanation(null);
    try {
      const result = await generateExplanation(entityName, relationships);
      setExplanation(result);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setExplanation(null);
  }, []);

  return { explanation, loading, generate, clear };
}

/**
 * Chat with AI about any topic - location, person, event, or general question
 */
export async function askAI(
  question: string,
  relationships: Relationship[]
): Promise<string> {
  if (!GROQ_API_KEY) {
    return "I'm not answering questions without my lawyer present.";
  }

  if (!question.trim()) {
    return "What would you like to know?";
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: buildChatSystemPrompt() },
          { role: 'user', content: buildChatContext(relationships, question) }
        ],
        temperature: 0.7,
        max_tokens: 250,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "I decline to answer that question.";
  } catch (error) {
    console.error('AI chat error:', error);
    return "I'm invoking my Fifth Amendment rights on that one.";
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function useAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const ask = useCallback(async (question: string, relationships: Relationship[]) => {
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);
    
    try {
      const response = await askAI(question, relationships);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, loading, ask, clear };
}
