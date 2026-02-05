/**
 * AI Explanations - Interrogation style from Epstein's perspective
 * Now with database search capability
 */

import { useState, useCallback } from 'react';
import type { Relationship } from '../types';
import { deepSearch, type DeepSearchResult } from '../api';

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

You have access to the COMPLETE database of seized documents and evidence. When asked about ANYTHING - email addresses, usernames, specific terms, codes, document IDs, or any detail - you MUST carefully read and reference the search results provided.

CRITICAL GUIDELINES:
- Speak in first person as Epstein
- When evidence is shown under "[DIRECT EVIDENCE - EXACT TEXT FROM DOCUMENTS]", you MUST quote or paraphrase it
- Reference SPECIFIC details: document IDs (like "GIUFFRE_FLIGHT_LOGS_001"), exact text excerpts, dates, names
- When asked about specific terms (like "littlestjeff1"), explain EXACTLY what the documents show - is it an email, username, reference? Quote the context.
- Be reluctantly forthcoming - "Yes, I see that's in document X... that appears to be..."
- Keep responses to 4-6 sentences with SPECIFIC evidence citations
- If the search found excerpts showing the term, you MUST explain what context it appears in
- NEVER say "I don't recall" if evidence is provided - instead reluctantly acknowledge what the documents show
- Only say "I don't recall" if genuinely NO evidence was found in the search results`;
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

function buildChatContext(relationships: Relationship[], question: string, searchResults?: DeepSearchResult): string {
  // Extract relevant context based on the question
  const questionLower = question.toLowerCase();
  
  // If we have search results, use those primarily
  let searchContext = '';
  if (searchResults) {
    // MOST IMPORTANT: Direct text excerpts showing the search term in actual documents
    if (searchResults.excerpts && searchResults.excerpts.length > 0) {
      searchContext += '\n[DIRECT EVIDENCE - EXACT TEXT FROM DOCUMENTS]\n';
      searchContext += `Found "${searchResults.query}" in ${searchResults.totalExcerpts} places:\n\n`;
      searchContext += searchResults.excerpts.slice(0, 8).map((ex, i) => 
        `[${i + 1}] Document ${ex.doc_id}:\n"${ex.context}"`
      ).join('\n\n');
    }
    
    // Format search results - events
    if (searchResults.events.length > 0) {
      searchContext += '\n\n[RELATED EVENTS FROM DATABASE]\n';
      searchContext += searchResults.events.slice(0, 30).map(e => {
        const date = e.timestamp || 'unknown date';
        const loc = e.location ? ` at ${e.location}` : '';
        const tags = e.tags?.length > 0 ? ` [${e.tags.slice(0, 3).join(', ')}]` : '';
        const topic = e.explicit_topic ? ` - Topic: ${e.explicit_topic}` : '';
        return `- Doc ${e.doc_id} | ${date}: ${e.actor} ${e.action} ${e.target}${loc}${tags}${topic}`;
      }).join('\n');
    }
    
    // Documents with summaries
    if (searchResults.documents.length > 0) {
      searchContext += '\n\n[DOCUMENTS CONTAINING THIS TERM]\n';
      searchContext += searchResults.documents.slice(0, 15).map(d => {
        const summary = d.one_sentence_summary || 'No summary';
        const para = d.paragraph_summary ? `\n  Details: ${d.paragraph_summary.slice(0, 300)}...` : '';
        return `- ${d.doc_id} (${d.category}): ${summary}${para}`;
      }).join('\n');
    }
    
    // People mentioned
    if (searchResults.actors.length > 0) {
      searchContext += '\n\n[PEOPLE CONNECTED TO THIS TERM]\n';
      searchContext += searchResults.actors.slice(0, 15).map(a => 
        `- ${a.name} (${a.connection_count} connections)`
      ).join('\n');
    }
    
    if ((!searchResults.excerpts || searchResults.excerpts.length === 0) && 
        searchResults.events.length === 0 && 
        searchResults.documents.length === 0 && 
        searchResults.actors.length === 0) {
      searchContext += '\n[SEARCH RESULTS]\nNo direct matches found in database for: "' + searchResults.query + '"';
    }
  }
  
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
  const events = relevantRels.slice(0, 10).map(r => {
    const date = r.timestamp || 'unknown date';
    const loc = r.location ? ` at ${r.location}` : '';
    return `- ${date}: ${r.actor} ${r.action} ${r.target}${loc}`;
  }).join('\n');
  
  // Add some general stats
  const locations = [...new Set(relationships.filter(r => r.location).map(r => r.location))];
  const people = [...new Set(relationships.flatMap(r => [r.actor, r.target]))];
  
  return `[EVIDENCE DATABASE OVERVIEW]
Known locations: ${locations.slice(0, 10).join(', ')}
Known associates: ${people.slice(0, 15).join(', ')}
${searchContext}

[INTERROGATOR'S QUESTION]
${question}

IMPORTANT: If evidence was found above, you MUST reference it specifically. Quote the exact text when relevant. Cite document IDs.`;
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
 * Extract search terms from a question
 */
function extractSearchTerms(question: string): string[] {
  // Remove common words and extract potential search terms
  const stopWords = new Set(['what', 'is', 'the', 'a', 'an', 'who', 'where', 'when', 'how', 'why', 'did', 'do', 'does', 'was', 'were', 'are', 'about', 'tell', 'me', 'you', 'your', 'know', 'can', 'could', 'would', 'should', 'have', 'has', 'had', 'with', 'for', 'that', 'this', 'there', 'their', 'they', 'them', 'any', 'some']);
  
  // Split and filter
  const words = question.toLowerCase()
    .replace(/[?!.,'"]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  // Also look for quoted terms or specific patterns (emails, usernames, etc.)
  const quotedMatches = question.match(/"([^"]+)"|'([^']+)'/g);
  if (quotedMatches) {
    words.push(...quotedMatches.map(m => m.replace(/['"]/g, '')));
  }
  
  // Look for email-like patterns
  const emailPatterns = question.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+/g);
  if (emailPatterns) {
    words.push(...emailPatterns);
  }
  
  // Look for username-like patterns (alphanumeric with numbers)
  const usernamePatterns = question.match(/\b[a-zA-Z]+[0-9]+[a-zA-Z0-9]*\b/g);
  if (usernamePatterns) {
    words.push(...usernamePatterns);
  }
  
  return [...new Set(words)];
}

/**
 * Chat with AI about any topic - location, person, event, or general question
 * Now searches the database THOROUGHLY first to find relevant information
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
    // Extract search terms from the question
    const searchTerms = extractSearchTerms(question);
    
    // Perform THOROUGH deep searches
    let searchResults: DeepSearchResult | undefined;
    let allResults: DeepSearchResult[] = [];
    
    if (searchTerms.length > 0) {
      // Search for the most specific terms first (longer terms, patterns)
      const sortedTerms = searchTerms.sort((a, b) => b.length - a.length);
      
      // Search for ALL significant terms (up to 5), not just until we find one
      const searchPromises = sortedTerms.slice(0, 5).map(async (term) => {
        try {
          // Use thorough mode for comprehensive results
          return await deepSearch(term, true);
        } catch (e) {
          console.warn('Search failed for term:', term, e);
          return null;
        }
      });
      
      const results = await Promise.all(searchPromises);
      allResults = results.filter((r): r is DeepSearchResult => r !== null);
      
      // Merge all results, prioritizing the first (most specific) term's results
      if (allResults.length > 0) {
        searchResults = {
          events: [],
          documents: [],
          actors: [],
          excerpts: [],
          query: sortedTerms[0],
          totalExcerpts: 0
        };
        
        // Collect unique items from all searches
        const seenEventIds = new Set<number>();
        const seenDocIds = new Set<string>();
        const seenActors = new Set<string>();
        const seenExcerpts = new Set<string>();
        
        for (const result of allResults) {
          // Add unique events
          for (const event of result.events) {
            if (!seenEventIds.has(event.id)) {
              seenEventIds.add(event.id);
              searchResults.events.push(event);
            }
          }
          
          // Add unique documents
          for (const doc of result.documents) {
            if (!seenDocIds.has(doc.doc_id)) {
              seenDocIds.add(doc.doc_id);
              searchResults.documents.push(doc);
            }
          }
          
          // Add unique actors
          for (const actor of result.actors) {
            if (!seenActors.has(actor.name)) {
              seenActors.add(actor.name);
              searchResults.actors.push(actor);
            }
          }
          
          // Add unique excerpts (the most valuable for detailed answers)
          for (const excerpt of result.excerpts || []) {
            const key = `${excerpt.doc_id}:${excerpt.context.slice(0, 50)}`;
            if (!seenExcerpts.has(key)) {
              seenExcerpts.add(key);
              searchResults.excerpts.push(excerpt);
            }
          }
        }
        
        searchResults.totalExcerpts = searchResults.excerpts.length;
      }
    }

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
          { role: 'user', content: buildChatContext(relationships, question, searchResults) }
        ],
        temperature: 0.7,
        max_tokens: 600, // Increased for more detailed responses
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
