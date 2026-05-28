import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// Dynamic routing to ensure clean execution
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY가 설정되지 않았습니다. AI Studio Secrets 패널에서 키를 입력해 주세요." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { title, attendees, transcript } = body;

    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return NextResponse.json(
        { error: "요약할 회의록 내용이 충분하지 않습니다." },
        { status: 400 }
      );
    }

    // Initialize Gemini Client with standard Telemetry User-Agent
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const formattedTranscript = transcript
      .map((item: any) => `[${item.timestamp || "시간 미정"}] ${item.speaker || "미지정 화자"}: ${item.text}`)
      .join("\n");

    const systemInstruction = 
      "당신은 대모산 호텔사업부의 전문 비서이자 비즈니스 분석가 AI입니다.\n" +
      "제공된 실시간 회의 음성 인식(STT) 로그를 기반으로, 다음 3가지 지정된 섹션에 맞추어 전문적이고 가독성이 뛰어난 한국어 회의록 요약 보고서를 작성해야 합니다.\n" +
      "가볍거나 캐주얼한 말투는 철저히 배제하고, 신뢰성 있고 품격 있는 사내 비즈니스 양식을 준수하십시오.";

    const prompt = `
대모산 호텔사업부 회의록의 분석 및 요약을 진행해 주세요.

## 1. 회의 개요
- 회의 제목: ${title || "대모산 호텔 사업부 정기 회의"}
- 참석자 목록: ${attendees && attendees.length > 0 ? attendees.map((a: any) => `${a.name}(${a.color})`).join(", ") : "참석자 정보 없음"}

## 2. 실시간 인식 원본 트랜스크립트
\`\`\`text
${formattedTranscript}
\`\`\`

---

위 트랜스크립트를 바탕으로 반드시 다음 3가지 섹션으로 나누어 품격 있는 마크다운(Markdown) 보고서를 작성해 주세요. 다른 항목이나 추가 텍스트 없이 이 3개 섹션만 명확하게 작성하십시오.

[보고서 구성 항목]
1. **결정된 사항 (Decisions Made)**: 회의를 통해 최종 합의되거나 결정된 사항들을 명확하게 정리하여 리스트업해 주세요.
2. **해야 할 일 (Action Items)**: 실행할 구체적인 작업 지시 내용을 리스트업하고, 각 항목마다 반드시 담당자와 완료 기한(기한이 명시되지 않았다면 대화 맥락을 통해 합리적인 일정을 유추하거나 '기한 미정'으로 처리)을 함께 명시해 주세요. (예: [홍길동] 3층 객실 정비 완료 - 기한: 2026-05-28 오전까지)
3. **다음 회의에서 논의할 것 (To Be Discussed Next)**: 이번 회의에서 결정되지 못해 이월되었거나, 다음 회의에서 추가 검토하기로 연기된 의제들을 정리해 주세요.

말투는 철저히 비즈니스 보고서 스타일(~음, ~기 바람, ~결정됨 등 기업 보고형 문체 또는 정중한 경어체)로 명확하고 군더더기 없이 작성하고 불필요한 인사말이나 잡담은 생략하십시오.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3, // Lower temperature to ensure factual consistency with transcript
      },
    });

    const text = response.text || "요약본 생성 실패: 결과값이 응답되지 않았습니다.";

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error("Gemini Summarization API error:", error);
    return NextResponse.json(
      { error: error?.message || "서버 통신 중 알 수 없는 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
