import { GoogleGenAI, Type } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ThreeLineSummary {
  summary_1: string;
  summary_2: string;
  summary_3: string;
}

export async function summarizeIssues(
  items: { title: string }[],
  categoryLabel: string
): Promise<ThreeLineSummary[]> {
  const titleList = items
    .map((item, index) => `${index + 1}. ${item.title}`)
    .join("\n");

  const prompt = `너는 ${categoryLabel} 카테고리의 뉴스 이슈를 한국어로 3줄 요약하는 전문가야.

다음 뉴스 제목 목록을 보고, 각 제목마다 아래 JSON 형식의 객체를 만들어서
입력 순서와 동일한 순서로 정확히 ${items.length}개가 담긴 JSON 배열로만 응답해줘.
- summary_1: 무슨 일인지
- summary_2: 왜 중요한지/배경
- summary_3: 앞으로 전망

제목 목록:
${titleList}`;

  // 응답 형식을 프롬프트 문구가 아니라 responseSchema로 강제해, 요약 문장
  // 안의 따옴표나 앞뒤 설명 때문에 JSON 파싱이 실패하던 문제를 막는다.
  // thinking은 꺼서 응답 시간과 토큰 사용량을 줄인다.
  const response = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            summary_1: { type: Type.STRING },
            summary_2: { type: Type.STRING },
            summary_3: { type: Type.STRING },
          },
          required: ["summary_1", "summary_2", "summary_3"],
          propertyOrdering: ["summary_1", "summary_2", "summary_3"],
        },
      },
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const parsed = JSON.parse(response.text ?? "");

  if (!Array.isArray(parsed) || parsed.length !== items.length) {
    throw new Error(
      `Expected ${items.length} summaries, got ${
        Array.isArray(parsed) ? parsed.length : typeof parsed
      }`
    );
  }

  return parsed as ThreeLineSummary[];
}
