import { GoogleGenAI, Type, ThinkingLevel, type GenerateContentConfig, type GenerateContentResponse } from "@google/genai";

const geminiApiKey = process.env.GEMINI_API_KEY || '';
export const hasGeminiApiKey = Boolean(geminiApiKey);

console.info("GEMINI_API_KEY exists:", hasGeminiApiKey);
if (!hasGeminiApiKey) {
  console.warn("GEMINI_API_KEY is missing. AI suggestions will be unavailable.");
}

const ai = new GoogleGenAI({ apiKey: geminiApiKey });
const GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
];
const AI_FALLBACK_MESSAGE = "AI suggestion could not be generated. Please try again or edit manually.";

type GeminiErrorDetails = {
  code?: number | string;
  status?: number | string;
  statusText?: string;
  message?: string;
  error?: {
    code?: number | string;
    status?: number | string;
    message?: string;
  };
};

const requireGeminiApiKey = () => {
  if (!hasGeminiApiKey) {
    throw new Error("GEMINI_API_KEY is missing. AI suggestions will be unavailable.");
  }
};

const getGeminiErrorDetails = (error: unknown) => {
  const details = error as GeminiErrorDetails;
  const statusParts = [
    details?.code,
    details?.status,
    details?.error?.code,
    details?.error?.status,
    details?.statusText
  ].filter((value): value is number | string => value !== undefined);
  const status = statusParts.length > 0 ? statusParts.map(String).join(" ") : "unknown";
  const message = String(details?.message ?? details?.error?.message ?? "");

  return { status, message };
};

const isQuotaError = (status: string, message: string) =>
  status.includes("429") || /quota|rate limit/i.test(message);

const isUnsupportedThinkingError = (status: string, message: string) =>
  (status.includes("400") || /invalid_argument/i.test(status)) &&
  /thinking.+not supported|not supported.+thinking/i.test(message);

const isRetryableModelError = (status: string, message: string) =>
  status.includes("503") ||
  status.includes("404") ||
  isUnsupportedThinkingError(status, message) ||
  /unavailable|high demand|model not found|not found/i.test(message);

const supportsThinkingConfig = (model: string) => model === "gemini-2.5-flash";

const sanitizeConfigForModel = (model: string, config?: GenerateContentConfig) => {
  if (!config) return undefined;

  const sanitizedConfig = { ...config };
  if (!supportsThinkingConfig(model)) {
    const configRecord = sanitizedConfig as Record<string, unknown>;
    delete configRecord.thinkingConfig;
    delete configRecord.thinkingBudget;
    delete configRecord.thinkingLevel;
  }

  return sanitizedConfig;
};

const generateWithFallback = async (
  contents: string,
  config?: GenerateContentConfig
): Promise<GenerateContentResponse> => {
  let lastError: unknown;

  for (const model of GEMINI_MODELS) {
    try {
      return await ai.models.generateContent({
        model,
        contents,
        config: sanitizeConfigForModel(model, config)
      });
    } catch (error) {
      const { status, message } = getGeminiErrorDetails(error);
      console.warn("Gemini generateContent failed", { model, status });

      if (isQuotaError(status, message)) {
        throw new Error("Gemini quota exceeded. Please wait before trying again or check your Gemini API quota.");
      }

      lastError = error;
      if (isRetryableModelError(status, message)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(AI_FALLBACK_MESSAGE, { cause: lastError });
};

const parseJson = <T>(text: string | undefined, fallback: T): T => {
  if (!text?.trim()) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    console.error("Failed to parse Gemini JSON response", e);
    return fallback;
  }
};

const sanitizeStringList = (items: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(items)) return fallback;
  const clean = items
    .filter((item): item is string => typeof item === "string")
    .map(item => item.trim())
    .filter(Boolean);
  return clean.length > 0 ? clean : fallback;
};

export const coachingService = {
  async analyzeQuizResponses(responses: { question: string, answer: string }[]): Promise<{ name: string, description: string }[]> {
    requireGeminiApiKey();
    const prompt = `Review the following 10 discovery responses from a coachee and identify recurring themes. Based on these themes, suggest 4–5 specific "Life Domains" that seem most important in their current life.
    
    Responses:
    ${responses.map(r => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n')}
    
    Guidelines:
    - Suggest exactly 4 or 5 domains.
    - Each domain name should be concise and meaningful (e.g., "Career", "Family", "Health", "Emotional Wellbeing").
    - Provide a brief description (10-15 words) explaining why this theme emerged from their answers.
    
    Return as a JSON array of objects with "name" and "description" keys.`;

    const response = await generateWithFallback(prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ["name", "description"]
          }
        }
    });

    const fallback = [
      { name: "Career", description: "Professional direction, meaningful work, and daily progress." },
      { name: "Health", description: "Energy, wellbeing, fitness, and physical resilience." },
      { name: "Relationships", description: "Connection, support, family, friendship, and belonging." },
      { name: "Personal Growth", description: "Learning, confidence, mindset, and self-development." },
      { name: "Finances", description: "Money clarity, stability, planning, and financial peace." }
    ];
    const parsed = parseJson(response.text, fallback);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.filter(item => item?.name?.trim()).slice(0, 5) : fallback;
  },

  async suggestSubAreas(domainName: string, discoveryResponses: { question: string, answer: string }[], exclude: string[] = []): Promise<string[]> {
    requireGeminiApiKey();
    const prompt = `Suggest 4-6 specific sub-areas for the life domain: "${domainName}".
    
    Consider the coachee's discovery responses to make these sub-areas highly relevant:
    ${discoveryResponses.map(r => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n')}
    
    ${exclude.length > 0 ? `IMPORTANT: Do NOT suggest any of these existing areas: ${exclude.join(', ')}` : ''}

    Return as a simple list of names.`;

    const response = await generateWithFallback(prompt, {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
    });
    return sanitizeStringList(parseJson(response.text, []), ["Clarity", "Consistency", "Confidence", "Progress"]);
  },

  async suggestDomainsFromDiscovery(responses: { question: string, answer: string }[], roles: string[], timeHorizon: string): Promise<string[]> {
    requireGeminiApiKey();
    const parentDomain = responses[3]?.answer || "Life";
    const prompt = `I'm trying to decide what's most important to my personal happiness and the happiness of those around me, so that I can embark on a journey of goal-setting and goal achievement (I refer to the combination of these two things as 'goal-getting'). Another way of looking at this is to consider what things and people are most valuable to me at this time. 

At the end of the prompt I'm going to give you an area or part of my life that is really important to me. I call this area/part a parent 'Domain'. Would you please give me a choice of 10 one-word child domains (or sub-domains) that sit underneath my parent domain and that I might want to set goals for. 

As an example, if I gave you the domain: "Health" you might come up with sub-domains such as Diet or Nutrition, or Exercise, or Well-being, etc. 
As another example, if I gave you the domain of Wealth you might consider sub-domains such as Assets, or Investments, or Cash-flow, or Pensions, etc. 

Make sure you arrange them in a list with each suggestion in Title Case on its own line, in alphabetical order and without any index numbers. Avoid repetition. Be as creative as you can be. 

It is VERY important that you start each suggested sub-domain with the parent domain name followed by the character > and then the sub-domain name. 

After the word Subject, I will either enter the parent domain name or I will enter some short text that describes the Domain name but without naming it:

Subject: ${parentDomain}

Context from other discovery questions:
${responses.slice(0, 3).map(r => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n')}

Return the result as a JSON array of strings, where each string is in the format "Parent > Child".`;

    const response = await generateWithFallback(prompt, {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
    });
    return sanitizeStringList(parseJson(response.text, []), [`${parentDomain} > General`, `${parentDomain} > Growth`]);
  },

  async suggestVisionAndWhy(domainName: string, discoveryResponses: { question: string, answer: string }[]): Promise<{ vision: string, why: string }> {
    requireGeminiApiKey();
    const prompt = `The coachee has selected the domain: "${domainName}".
    Based on their discovery responses:
    ${discoveryResponses.map(r => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n')}
    
    Suggest:
    1. A compelling "Vision" for this domain (a future state they want to achieve).
    2. A "Why" (the underlying motivation or importance of this domain for them).
    
    Return as a JSON object with "vision" and "why" keys.`;

    const response = await generateWithFallback(prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vision: { type: Type.STRING },
            why: { type: Type.STRING }
          },
          required: ["vision", "why"]
        }
    });
    return parseJson(response.text, { vision: "", why: "" });
  },

  async suggestDomainWhy(domainName: string, discoveryResponses: { question: string, answer: string }[]): Promise<string> {
    requireGeminiApiKey();
    const responsesSummary = discoveryResponses
      .filter(r => r.answer.trim() !== "")
      .map(r => `Q: ${r.question}\nA: ${r.answer}`)
      .join('\n\n');

    const prompt = `The coachee has selected the planning domain: "${domainName}".
    
    ${responsesSummary ? `They provided the following discovery reflections:\n${responsesSummary}` : "They are starting fresh with this domain."}
    
    Please act as a world-class life coach and provide:
    A compelling "Why" statement (15-25 words) that captures the core motivation and emotional driver for focusing on "${domainName}".
    
    Ensure the statement is inspiring, personal (using "I" or "My"), and actionable.
    
    Return the result as a JSON object with a single key "why".`;

    const response = await generateWithFallback(prompt, {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            why: { type: Type.STRING }
          },
          required: ["why"]
        }
    });
    
    try {
      const data = parseJson(response.text, { why: AI_FALLBACK_MESSAGE });
      return data.why;
    } catch (e) {
      console.error("Failed to parse suggested domain why", e);
      return AI_FALLBACK_MESSAGE;
    }
  },

  async suggestDomainContext(domainName: string, discoveryResponses: { question: string, answer: string }[]): Promise<{ vision: string, why: string, subAreas: string[] }> {
    requireGeminiApiKey();
    const responsesSummary = discoveryResponses
      .filter(r => r.answer.trim() !== "")
      .map(r => `Q: ${r.question}\nA: ${r.answer}`)
      .join('\n\n');

    const prompt = `The coachee has selected the planning domain: "${domainName}".
    
    ${responsesSummary ? `They provided the following discovery reflections:\n${responsesSummary}` : "They are starting fresh with this domain."}
    
    Please act as a world-class life coach and provide:
    1. An inspiring "Vision" statement (20-30 words) that describes what success in the "${domainName}" domain looks like, incorporating their reflections if provided.
    2. A compelling "Why" statement (15-25 words) that captures the core motivation and emotional driver for focusing on this area.
    3. Exactly 4 keyword-level sub-areas or "focus areas" that represent key focuses of this area (e.g. for Health: Nutrition, Sleep, Movement, Mental Health).
    
    Ensure the vision and why are inspiring, personal (using "I" or "My"), and actionable.
    
    Return as a JSON object.`;

    const response = await generateWithFallback(prompt, {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vision: { type: Type.STRING },
            why: { type: Type.STRING },
            subAreas: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["vision", "why", "subAreas"]
        }
    });
    const fallback = {
      vision: "",
      why: "",
      subAreas: ["Clarity", "Consistency", "Confidence", "Progress"]
    };
    const parsed = parseJson(response.text, fallback);
    return {
      vision: typeof parsed.vision === "string" ? parsed.vision : "",
      why: typeof parsed.why === "string" ? parsed.why : "",
      subAreas: sanitizeStringList(parsed.subAreas, fallback.subAreas).slice(0, 4)
    };
  },

  async refineActionSteps(subAreaName: string, currentSteps: any[]) {
    requireGeminiApiKey();
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const prompt = `Refine the following action steps for the sub-area "${subAreaName}" to make them SMART (Specific, Measurable, Achievable, Relevant, and Time-bound).
Today's date is ${today}.

Current Steps:
${currentSteps.map((s, i) => `${i + 1}. Task: ${s.task}, Start: ${s.startDate || s.dueDate}, End: ${s.endDate || s.dueDate}, Measure: ${s.measure || 'N/A'}, Obstacle: ${s.obstacle || 'N/A'}, Overcome: ${s.overcome || 'N/A'}`).join('\n')}

Rules for Refinement:
- Each step must define a single, actionable task.
- Ensure realistic timelines. Suggest specific dates strictly in YYYY-MM-DD format (e.g. '2024-05-15').
- Clear measure of completion.
- Creative mitigation tactics for obstacles.
- Short, 10-15 words per task.
- 6-10 words for measures and obstacles.
- 10-15 words for overcoming strategies.
- Return the refined steps in the same structure.

Return the result as a JSON object.`;

    const response = await generateWithFallback(prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            actionSteps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  task: { type: Type.STRING },
                  startDate: { type: Type.STRING },
                  endDate: { type: Type.STRING },
                  measure: { type: Type.STRING },
                  obstacle: { type: Type.STRING },
                  overcome: { type: Type.STRING }
                },
                required: ["task", "startDate", "endDate", "measure", "obstacle", "overcome"]
              }
            }
          },
          required: ["actionSteps"]
        }
    });
    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to parse refined steps", e);
      return { actionSteps: currentSteps };
    }
  },

  async suggestDomainEndGoal(domainName: string, discoveryResponses: { question: string, answer: string }[]): Promise<string> {
    requireGeminiApiKey();
    const responsesSummary = discoveryResponses
      .filter(r => r.answer.trim() !== "")
      .map(r => `Q: ${r.question}\nA: ${r.answer}`)
      .join('\n\n');

    const prompt = `The coachee has selected the planning domains: "${domainName}".
    
    They provided the following discovery reflections:
    ${responsesSummary || "No reflections provided."}
    
    Please act as a world-class life coach. Suggest one powerful, concise "Domains End-goal" (max 20 words) that summarizes what success looks like in these domains for them. 
    Use the first person ("I will...", "My goal is to...").
    
    Return as a simple string.`;

    const response = await generateWithFallback(prompt, {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
    });
    return response.text.trim().replace(/^"|"$/g, '');
  },

  async suggestDomainVision(domainName: string, domainGoal: string, timeHorizon: string): Promise<string> {
    requireGeminiApiKey();
    const prompt = `For the domains "${domainName}" and the End-goals "${domainGoal}" with a time horizon of ${timeHorizon}.
    
    Please write a detailed, SMART (Specific, Measurable, Achievable, Relevant, Time-bound) description of the "Vision" (around 50-75 words).
    Describe exactly what it looks like when these domains are fully transformed within the ${timeHorizon} timeframe. Use descriptive, sensory language in the present tense.
    
    Return as a simple string.`;

    const response = await generateWithFallback(prompt, {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
    });
    return response.text.trim().replace(/^"|"$/g, '');
  },

  async suggestGoalAffirmations(goals: string[]): Promise<string[]> {
    requireGeminiApiKey();
    const prompt = `For each of the following specific goals, suggest one powerful, present-tense affirmation (strictly constrained to be between 12 and 15 words in length, the shorter the better. Count each word in the affirmation to guarantee it is exactly in the 12-15 word range).
    
    Goals:
    ${goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}
    
    Return as a JSON array of strings in the same order.`;

    const response = await generateWithFallback(prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
    });
    try {
      return JSON.parse(response.text);
    } catch (e) {
      return goals.map(() => "I am successfully achieving my goals and living my vision.");
    }
  },

  async suggestDomainAffirmations(domainName: string, domainGoal: string, domainVision: string): Promise<string[]> {
    requireGeminiApiKey();
    const prompt = `For the domains "${domainName}", with the End-goals "${domainGoal}" and the Vision description: "${domainVision}".
    
    Suggest 3 powerful, present-tense affirmations (strictly between 12 and 15 words each, the shorter the better. Do not write more than 15 words and do not write less than 12 words per affirmation) that empower the coachee to achieve this vision.
    
    Return as a JSON array of strings.`;

    const response = await generateWithFallback(prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
    });
    try {
      return JSON.parse(response.text);
    } catch (e) {
      return [AI_FALLBACK_MESSAGE];
    }
  },
  
  async suggestSubAreaEndGoal(subAreaName: string, domainVision: string, timeHorizon: string): Promise<{ goal: string, recommendedDurationDays: number }> {
    requireGeminiApiKey();
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const prompt = `For the sub-domain focus area "${subAreaName}" within the broader vision of: "${domainVision}".
    The time horizon for the entire plan is ${timeHorizon}. Today's date is ${today}.
    
    Please suggest one specific, measurable, and inspiring "End-goal" for this "${subAreaName}" focus area (max 20 words).
    Also, suggest a recommended duration in days to achieve this specific goal within the ${timeHorizon} timeframe.
    
    Return as a JSON object with "goal" (string) and "recommendedDurationDays" (number) keys.`;

    const response = await generateWithFallback(prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            goal: { type: Type.STRING },
            recommendedDurationDays: { type: Type.NUMBER }
          },
          required: ["goal", "recommendedDurationDays"]
        }
    });
    return JSON.parse(response.text);
  },

  async suggestActionStepsForGoal(goal: string, domainName: string, context?: { focusAreaName?: string; startDate?: string; finishDate?: string; obstacles?: string[] }): Promise<{ task: string, measure: string, obstacle: string, overcome: string, startDate: string, endDate: string }[]> {
    requireGeminiApiKey();
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const prompt = `For the following End-goal in the domain "${domainName}":
    Goal: "${goal}"
    ${context?.focusAreaName ? `Focus area: "${context.focusAreaName}"` : ""}
    ${context?.startDate || context?.finishDate ? `Preferred timeline: ${context.startDate || "TBD"} to ${context.finishDate || "TBD"}. Keep suggested step dates inside this range when possible.` : ""}
    ${context?.obstacles?.length ? `Known obstacles to consider: ${context.obstacles.join("; ")}` : ""}
    Today's date is ${today}.
    
    Please suggest 3 to 5 "Specific Action Steps" to achieve this goal.
    For each step, identify:
    - "task": string (The specific action step)
    - "measure": string (A clear measure of success for the step)
    - "obstacle": string (One common obstacle for this step)
    - "overcome": string (One strategy to overcome the obstacle)
    - "startDate": string (suggested start strictly in YYYY-MM-DD format)
    - "endDate": string (suggested end strictly in YYYY-MM-DD format)
    
    Return a JSON array of objects.`;

    const response = await generateWithFallback(prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
                  task: { type: Type.STRING },
                  measure: { type: Type.STRING },
                  obstacle: { type: Type.STRING },
                  overcome: { type: Type.STRING },
              startDate: { type: Type.STRING },
              endDate: { type: Type.STRING }
            },
                required: ["task", "measure", "obstacle", "overcome", "startDate", "endDate"]
          }
        }
    });
    return JSON.parse(response.text);
  },

  async suggestObstacles(goalName: string): Promise<string[]> {
    requireGeminiApiKey();
    const prompt = `For the following goal, suggest 2 potential obstacles that could prevent someone from achieving it.
    Goal: "${goalName}"
    
    Return as a JSON array of 2 strings. Each obstacle should be 6-10 words.`;

    const response = await generateWithFallback(prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
    });
    try {
      return JSON.parse(response.text);
    } catch (e) {
      return [AI_FALLBACK_MESSAGE];
    }
  },

  async suggestObstacleSolution(goalName: string, obstacle: string): Promise<string> {
    requireGeminiApiKey();
    const prompt = `For the goal "${goalName}", how would you overcome this obstacle: "${obstacle}"?
    
    Provide one creative and effective solution (10-15 words).
    
    Return as a simple string.`;

    const response = await generateWithFallback(prompt);
    return response.text.trim().replace(/^"|"$/g, '');
  },

  async suggestSupportingEndGoals(domainName: string, domainGoal: string, domainVision: string): Promise<{name: string, obstacles: {obstacle: string, solution: string}[]}[]> {
    requireGeminiApiKey();
    const prompt = `For the domains "${domainName}", the End-goals is "${domainGoal}" and the successful Vision is "${domainVision}".
    
    Suggest 3 SMART (Specific, Measurable, Achievable, Relevant, Time-bound) "Supporting End-goals" (15-20 words each).
    For EACH supporting goal, suggest 2 potential obstacles and a solution for each.
    
    Return as a JSON array of objects with "name" and "obstacles" (array of {obstacle, solution}) keys.`;

    const response = await generateWithFallback(prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { 
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              obstacles: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    obstacle: { type: Type.STRING },
                    solution: { type: Type.STRING }
                  },
                  required: ["obstacle", "solution"]
                }
               }
            },
            required: ["name", "obstacles"]
          }
        }
    });
    try {
      return JSON.parse(response.text);
    } catch (e) {
      return [
        { name: AI_FALLBACK_MESSAGE, obstacles: [] }
      ];
    }
  },

  async suggestDREAMDetails(subArea: string, current: number, future: number) {
    requireGeminiApiKey();
    const prompt = `This is step E, A, and M in the DREAMsheet AI methodology: E (End-goals), A (Affirmation), and M (Masterplan).

PART E: END-GOALS
Please create me 4 broad End-goals (at a high level) to help me improve in the following Domains or Sub-Domains.
Subject: ${subArea}
Current rating: ${current}/10, Target: ${future}/10.

Rules for End-goals:
- Short, around 15 words each.
- Start with 'To'.
- One thing at a time.
- No parenthesis or quote marks.
- Index numbers #1 to #4.
- Each on its own line.

PART A: AFFIRMATION
Use each of the 4 End-goal statements and write me one AFFIRMATION statement for each.
Rules for Affirmations:
- Hard Constraint: Must be strictly between 12 and 15 words maximum in length. (Count the words carefully. Never write less than 12 words, and never write more than 15 words).
- Start with 'I'.
- One thing at a time, specific to the End-goal.
- No parenthesis or quote marks.
- First person (I or We).
- Present tense (as if already true, "-ing" verbs are good).
- Positive (what I'm working towards, not leaving behind).
- Creative (don't just reuse End-goal words).
- Use corresponding index number (#1 to #4).
- Each on its own line.

PART M: MASTERPLAN - SPECIFICS
Break down each of the 4 End-goal statements further by focusing on a bullet point cluster of no more than 3 much more specific action steps, perhaps in sequence, for EACH of the 4 End-goals.
Rules for Specific Actions:
- Follow SMART criteria: Specific, Measurable, Achievable, Relevant, and Time-bound.
- Each step must define a single, actionable task.
- Ensure realistic timelines with both a start date and an end date. Suggest specific dates in YYYY-MM-DD format (e.g. '2024-05-15') using today as a reference.
- Today's date is ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
- Short, around 10-15 words each for the task.
- One thing at a time.
- No parenthesis or quote marks.
- Use same #1, #2, #3, #4 index numbers for each cluster.
- Use - to identify each specific action point inside each cluster.
- Separate each cluster with a line break.
- For the JSON output, provide 'startDate' and 'endDate' strictly as YYYY-MM-DD strings.

PART M: MASTERPLAN - MEASURES
Write 1 success 'measure' or metric for every specific action step created in Part M.
Rules for Measures:
- Focus on what 'finished' looks like (specific measure of completion).
- Quantitative or qualitative.
- Around 6-10 words per measure.
- Start with -.
- Do not put in parenthesis or quote marks.
- Use same #1 to #4 index numbers to match the end-goals.

PART M: MASTERPLAN - OBSTACLES
Suggest one potential obstacle that could get in the way for each of the specific action steps created in Part M.
Rules for Obstacles:
- Around 6-10 words per obstacle.
- Start with -.
- No parenthesis or quote marks.
- Use same #1 to #4 index numbers for each cluster.
- Separate each cluster with a line break.

PART M: MASTERPLAN - OVERCOMES
Suggest one creative way to overcome each obstacle created in Part M.
Rules for Overcomes:
- Detailed mitigation tactics or ready-to-execute playbook steps.
- Around 10-15 words per overcome.
- Start with -.
- No parenthesis or quote marks.
- Use same #1 to #4 index numbers for each cluster.
- Separate each cluster with a line break.

In addition to these, please provide:
1. "Strategic Milestones": 2-3 key milestones on the route map to the chosen End-goal.
2. "Masterplan" details:
   - 2 Potential Obstacles and their Solutions (general for the sub-area).
   - "Success Indicator": How they'll know they've achieved it.

Return the result as a JSON object.`;

    const response = await generateWithFallback(prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedGoals: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "The 4 suggested End-goals starting with 'To' and indexed #1 to #4"
            },
            suggestedAffirmations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "The 4 suggested affirmations starting with 'I' and indexed #1 to #4"
            },
            suggestedActionClusters: {
              type: Type.ARRAY,
              items: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "A cluster of 3 specific action steps"
              },
              description: "4 clusters of action steps, one for each End-goal"
            },
            suggestedMeasureClusters: {
              type: Type.ARRAY,
              items: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "A cluster of 3 measures (one per action step)"
              },
              description: "4 clusters of measures, one for each End-goal"
            },
            suggestedObstacleClusters: {
              type: Type.ARRAY,
              items: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "A cluster of 3 obstacles (one per action step)"
              },
              description: "4 clusters of obstacles, one for each End-goal"
            },
            suggestedOvercomeClusters: {
              type: Type.ARRAY,
              items: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "A cluster of 3 overcomes (one per obstacle)"
              },
              description: "4 clusters of overcomes, one for each End-goal"
            },
            goal: { type: Type.STRING, description: "The primary selected End-goal (default to #1)" },
            affirmation: { type: Type.STRING, description: "The primary selected Affirmation (default to #1)" },
            actionSteps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  task: { type: Type.STRING },
                  startDate: { type: Type.STRING },
                  endDate: { type: Type.STRING },
                  measure: { type: Type.STRING },
                  obstacle: { type: Type.STRING },
                  overcome: { type: Type.STRING }
                },
                required: ["task", "startDate", "endDate", "measure", "obstacle", "overcome"]
              },
              description: "The action steps, measures, obstacles, and overcomes for the primary selected goal (cluster #1)"
            },
            milestones: { type: Type.ARRAY, items: { type: Type.STRING } },
            successIndicator: { type: Type.STRING },
            obstacles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  obstacle: { type: Type.STRING },
                  solution: { type: Type.STRING }
                },
                required: ["obstacle", "solution"]
              }
            }
          },
          required: ["suggestedGoals", "suggestedAffirmations", "suggestedActionClusters", "suggestedMeasureClusters", "suggestedObstacleClusters", "suggestedOvercomeClusters", "goal", "affirmation", "actionSteps", "milestones", "successIndicator", "obstacles"]
        }
    });
    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to parse AI response", e);
      const fallbackMsg = AI_FALLBACK_MESSAGE;
      return {
        suggestedGoals: [fallbackMsg, fallbackMsg, fallbackMsg, fallbackMsg],
        suggestedAffirmations: [fallbackMsg, fallbackMsg, fallbackMsg, fallbackMsg],
        suggestedActionClusters: [[], [], [], []],
        suggestedMeasureClusters: [[], [], [], []],
        suggestedObstacleClusters: [[], [], [], []],
        suggestedOvercomeClusters: [[], [], [], []],
        goal: fallbackMsg,
        affirmation: fallbackMsg,
        actionSteps: [],
        milestones: [],
        successIndicator: fallbackMsg,
        obstacles: []
      };
    }
  },

  async suggestDomainStrategy(domainName: string, domainGoal: string) {
    requireGeminiApiKey();
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const prompt = `The coachee has defined an overall goal for the domain "${domainName}":
    Domain Goal: "${domainGoal}"
    Today's date is ${today}.

    Please act as a world-class life coach and strategist. 
    1. Suggest 2-3 critical "Sub-Domains" or focus areas that are necessary to achieve this domain goal.
    2. For EACH sub-domain, provide:
       - A specific goal (the "End-goal" for that focus area).
       - 3 specific, sequential action steps to achieve it.
       - A success measure for each action step.
       - A potential obstacle and how to overcome it for each action step.
       - Realistic start and end dates for each action step (strictly in YYYY-MM-DD format, using today as reference).
    3. Also suggest 2-3 powerful, present-tense affirmations (strictly between 12 and 15 words each. Do NOT write less than 12 words and do NOT write more than 15 words) specifically for this "${domainName}" domain based on the Domain Goal.

    Return the result as a JSON object.`;

    const response = await generateWithFallback(prompt, {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subDomains: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  goal: { type: Type.STRING },
                  actionSteps: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        task: { type: Type.STRING },
                        startDate: { type: Type.STRING },
                        endDate: { type: Type.STRING },
                        measure: { type: Type.STRING },
                        obstacle: { type: Type.STRING },
                        overcome: { type: Type.STRING }
                      },
                      required: ["task", "startDate", "endDate", "measure", "obstacle", "overcome"]
                    }
                  }
                },
                required: ["name", "goal", "actionSteps"]
              }
            },
            affirmations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["subDomains", "affirmations"]
        }
    });

    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to parse domain strategy", e);
      return { subDomains: [], affirmations: [] };
    }
  }
};
