import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.warn('VITE_GEMINI_API_KEY is not set. Gemini features will not work.');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Function to clean JSON string and fix common parsing issues
function cleanJsonString(jsonString: string): string {
  try {
    // Remove any leading/trailing whitespace
    let cleaned = jsonString.trim();
    
    // Find the JSON object boundaries
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('No JSON object found in response');
    }
    
    // Extract just the JSON part
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    
    // Fix invalid escape sequences in string values
    // We'll process the JSON character by character to handle strings properly
    let result = '';
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      const nextChar = cleaned[i + 1];
      
      if (escapeNext) {
        // We're processing an escape sequence
        // Valid escape sequences: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
        if (char === 'u' && /[0-9a-fA-F]/.test(nextChar) && /[0-9a-fA-F]/.test(cleaned[i + 2]) && 
            /[0-9a-fA-F]/.test(cleaned[i + 3]) && /[0-9a-fA-F]/.test(cleaned[i + 4])) {
          // Valid \uXXXX sequence
          result += '\\u' + cleaned.substring(i + 1, i + 5);
          i += 4; // Skip the 4 hex digits
        } else if (/["\\/bfnrt]/.test(char)) {
          // Valid single-character escape
          result += '\\' + char;
        } else {
          // Invalid escape sequence - escape the backslash and keep the character
          result += '\\\\' + char;
        }
        escapeNext = false;
      } else if (char === '\\') {
        escapeNext = true;
      } else if (char === '"' && (i === 0 || cleaned[i - 1] !== '\\' || (i > 1 && cleaned[i - 2] === '\\'))) {
        // Toggle string state (but handle escaped quotes)
        inString = !inString;
        result += char;
      } else if (inString && /[\x00-\x1F\x7F]/.test(char)) {
        // Control character in string - escape it
        const charCode = char.charCodeAt(0);
        switch (charCode) {
          case 0x08: result += '\\b'; break;
          case 0x09: result += '\\t'; break;
          case 0x0A: result += '\\n'; break;
          case 0x0C: result += '\\f'; break;
          case 0x0D: result += '\\r'; break;
          default: result += `\\u${charCode.toString(16).padStart(4, '0')}`; break;
        }
      } else {
        result += char;
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error cleaning JSON string:', error);
    return jsonString; // Return original if cleaning fails
  }
}

export interface LessonContent {
  title: string;
  type: 'notes' | 'example';
  content: string;
}

export interface QuizQuestion {
  question: string;
  correct_answer: string; // The correct answer as text
  explanation: string;
  difficulty: number; // 1-10, where 1 is easiest and 10 is hardest
}

export interface GeneratedLessons {
  lessons: LessonContent[];
  summary: string;
  suggestedTopics: string[];
  questions: QuizQuestion[];
}

export async function generateCapsMathLessons(
  grade: number,
  subject: string,
  topic: string,
  isAssessment: boolean = false
): Promise<GeneratedLessons> {
  if (!genAI) {
    throw new Error(
      'Gemini API key is not configured. Please set VITE_GEMINI_API_KEY.'
    );
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
  });

  const prompt = `
  You are an experienced South African CAPS Mathematics teacher.
  
  Subject: ${subject}
  Grade: ${grade}
  Country: South Africa
  Topic: ${topic}
  
  CRITICAL: Keep content SHORT, CLEAR, and CONCISE. Avoid long explanations.
  
  TEXT FORMATTING: Use Markdown formatting to make content visually appealing:
  - **bold text** for emphasis and important terms
  - *italic text* for definitions or special notes
  - Use colors with HTML spans: <span style="color: blue;">blue text</span>, <span style="color: red;">red text</span>, <span style="color: green;">green text</span>
  - Use <span style="color: #FF6B6B;">hex colors</span> for custom colors
  - Use **bold** for key concepts, formulas, and important steps
  - Use *italics* for definitions and notes
  - CRITICAL: NEVER nest markdown formatting (**, *) inside HTML tags (<sup>, <sub>, <span>, etc.)
  - For superscripts/subscripts, use HTML only: <sup>2</sup> NOT <sup>**2**</sup>
  - If you need bold superscript, use: <sup><strong>2</strong></sup> or <span style="font-weight: bold;"><sup>2</sup></span>
  - CRITICAL: NEVER use dollar signs ($) for math notation. Write equations as plain text: "10 - 5 = 5" NOT "$10 - 5 = 5$"
  - For equations, use regular text with **bold** for emphasis: **10 - 5 = 5** NOT $10 - 5 = 5$
  - For superscripts in equations, use HTML: 5<sup>2</sup> NOT $5^2$ or $5^{2}$
  
  STRICT FORMATTING RULES FOR EXAMPLES:
  Format examples EXACTLY like this (keep it brief, use formatting):
  
  Example 1: [Short Title]
  Solve: [problem]
  
  Step 1: [brief description]
  [equation]
  
  ✓ Answer: [answer]
  
  FORMATTING REQUIREMENTS:
  - Each example: "Example [number]: [Short Title]" (max 5 words)
  - Problem: "Solve: [problem]" (one line, can use **bold** for numbers)
  - Steps: "Step [number]: [brief description]" (max 10 words per step, use **bold** for key terms)
  - Equation on next line (indented, use **bold** for variables or important parts)
  - Answer: "✓ Answer: [answer]" (use <span style="color: green;">green color</span> for answer)
  - Maximum 2-3 steps per example
  - Maximum 2 examples per lesson
  - Use formatting to highlight important parts
  - CRITICAL: NEVER use dollar signs ($) for math notation. Use regular text with **bold** for emphasis instead.
  - For equations, write them as plain text: "10 - 5 = 5" NOT "$10 - 5 = 5$"
  - For superscripts, use HTML: <sup>2</sup> NOT $^2$ or $2$
  
  For "notes" type lessons:
  - Keep explanations SHORT (2-3 sentences max)
  - Focus on key concepts only
  - Use **bold** for important terms and formulas
  - Use *italics* for definitions
  - Use colors to highlight key information
  - Use bullet points when possible
  - Avoid lengthy paragraphs
  
  Generate:
  - 3–5 lesson cards (prefer fewer, high-quality cards)
  - ALWAYS start with an "Introduction" lesson as the FIRST lesson
  - The introduction should explain what the topic is about, key concepts, and why it's important
  - After introduction, mix of "notes" and "example" types
  - Each lesson should be concise and focused
  - Examples must follow the exact format above
  - Use markdown and HTML formatting to make content visually appealing
  
  Return ONLY valid JSON in this exact format:
  
  {
    "lessons": [
      {
        "title": "Introduction",
        "type": "notes",
        "content": "Brief introduction explaining what this topic covers, key concepts, and why it's important. Keep it concise (2-3 sentences)."
      },
      {
        "title": "Short lesson title (max 6 words)",
        "type": "notes" | "example",
        "content": "For examples:\nExample 1: Title\nSolve: **problem**\n\nStep 1: description\n  **equation**\n\n✓ Answer: <span style=\"color: green;\">answer</span>"
      }
    ],
    "summary": "Brief summary (one sentence)",
    "suggestedTopics": ["Topic 1", "Topic 2"]
  }
  
  IMPORTANT: The first lesson MUST be titled "Introduction" and be of type "notes".
  
  QUIZ GENERATION:
  After generating lessons, also generate exactly ${isAssessment ? '50' : '10'} quiz questions for this topic.
  - Questions must get progressively more difficult (question 1 = easiest, question ${isAssessment ? '50' : '10'} = hardest)
  - Each question should test understanding of the topic concepts
  - Questions should require students to show their working out and provide a final answer
  - Questions should be appropriate for Grade ${grade} CAPS curriculum
  - Include clear explanations for each answer
  ${isAssessment ? '- This is an ASSESSMENT topic, so generate 50 comprehensive questions covering all aspects of the topic' : ''}
  
  Return ONLY valid JSON in this exact format:
  
  {
    "lessons": [...],
    "summary": "Brief summary (one sentence)",
    "suggestedTopics": ["Topic 1", "Topic 2"],
    "questions": [
      {
        "question": "Question text that requires working out",
        "correct_answer": "The correct final answer",
        "explanation": "Step-by-step explanation of how to solve this problem",
        "difficulty": 1
      },
      {
        "question": "Slightly harder question",
        "correct_answer": "The correct final answer",
        "explanation": "Step-by-step explanation",
        "difficulty": 2
      },
      ... (continue up to difficulty 10)
    ]
  }
  
  IMPORTANT: 
  - Generate exactly ${isAssessment ? '50' : '10'} questions
  - Difficulty should range from 1 (easiest) to ${isAssessment ? '50' : '10'} (hardest)
  - Questions should require working out, not just multiple choice
  - Each question should have a clear explanation
  ${isAssessment ? '- For assessments, ensure questions cover the full breadth and depth of the topic' : ''}
  `;
  

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    // Strip markdown if Gemini wraps JSON
    if (text.startsWith('```')) {
      text = text.replace(/```json|```/g, '').trim();
    }

    // Clean up JSON string - fix common issues
    text = cleanJsonString(text);

    let parsed: GeneratedLessons;
    try {
      parsed = JSON.parse(text) as GeneratedLessons;
    } catch (parseError) {
      // If parsing still fails, try to extract JSON more aggressively
      console.error('First parse attempt failed. Trying alternative extraction...');
      console.error('Cleaned text length:', text.length);
      console.error('First 500 chars:', text.substring(0, 500));
      console.error('Last 500 chars:', text.substring(Math.max(0, text.length - 500)));
      
      // Try to find and extract just the JSON object
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]) as GeneratedLessons;
        } catch (secondError) {
          throw new Error(
            `Failed to parse JSON after cleaning. ` +
            `This may indicate the AI generated invalid JSON. ` +
            `Please try generating again. ` +
            `Error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
          );
        }
      } else {
        throw new Error(
          `No valid JSON object found in AI response. ` +
          `Please try generating again. ` +
          `Error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        );
      }
    }

    if (!parsed.lessons || !Array.isArray(parsed.lessons)) {
      throw new Error('Invalid response format from Gemini');
    }

    // Cleanup function to fix nested markdown in HTML tags and remove dollar signs
    const cleanupContent = (text: string): string => {
      // First, remove all dollar signs used for LaTeX-style math notation
      // Remove LaTeX-style inline math: $expression$ -> expression
      let cleaned = text.replace(/\$([^$]+)\$/g, '$1');
      
      // Fix markdown bold/italic inside HTML tags
      // Pattern: <tag>**text**</tag> or <tag>*text*</tag>
      cleaned = cleaned
        // Fix bold inside sup/sub tags: <sup>**2**</sup> -> <sup><strong>2</strong></sup>
        .replace(/<sup>(\s*)\*\*([^*]+)\*\*(\s*)<\/sup>/g, '<sup>$1<strong>$2</strong>$3</sup>')
        .replace(/<sub>(\s*)\*\*([^*]+)\*\*(\s*)<\/sub>/g, '<sub>$1<strong>$2</strong>$3</sub>')
        // Fix italic inside sup/sub tags: <sup>*text*</sup> -> <sup><em>text</em></sup>
        .replace(/<sup>(\s*)\*([^*]+)\*(\s*)<\/sup>/g, '<sup>$1<em>$2</em>$3</sup>')
        .replace(/<sub>(\s*)\*([^*]+)\*(\s*)<\/sub>/g, '<sub>$1<em>$2</em>$3</sub>')
        // Fix bold inside span tags (but preserve color spans)
        .replace(/<span[^>]*>(\s*)\*\*([^*]+)\*\*(\s*)<\/span>/g, (match, p1, p2, p3, offset, string) => {
          // Only fix if it's not already a color span with proper formatting
          if (match.includes('style=')) {
            return match; // Skip color spans, they should be fine
          }
          return `<span>${p1}<strong>${p2}</strong>${p3}</span>`;
        });
      
      return cleaned;
    };

    return {
      lessons: parsed.lessons.map((lesson) => ({
        title: lesson.title || 'Untitled Lesson',
        type: lesson.type === 'example' ? 'example' : 'notes',
        content: cleanupContent(lesson.content || ''),
      })),
      summary: parsed.summary || '',
      suggestedTopics: parsed.suggestedTopics || [],
      questions: (parsed.questions || []).map((q: any) => ({
        question: cleanupContent(q.question || ''),
        correct_answer: cleanupContent(q.correct_answer || ''),
        explanation: cleanupContent(q.explanation || ''),
        difficulty: q.difficulty || 1,
      })).sort((a: QuizQuestion, b: QuizQuestion) => a.difficulty - b.difficulty), // Sort by difficulty
    };
  } catch (error) {
    console.error('Error generating CAPS lessons:', error);
    throw new Error(
      error instanceof Error
        ? `Failed to generate lessons: ${error.message}`
        : 'Failed to generate lessons'
    );
  }
}
