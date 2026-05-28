import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY가 설정되지 않았습니다. .env 파일이나 Vercel 환경 변수에 설정해 주세요." },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);

    const body = await req.json();
    const { to, title, date, attendees, transcript, aiSummary } = body;

    if (!to) {
      return NextResponse.json(
        { error: "수신자 이메일 주소가 누락되었습니다." },
        { status: 400 }
      );
    }

    // Build standard HTML content
    const attendeesList = attendees && attendees.length > 0
      ? attendees.map((a: any) => `<li>${a.name}</li>`).join("")
      : "<li>없음</li>";

    const transcriptRows = transcript && transcript.length > 0
      ? transcript.map((item: any) => {
          const matchedSpeaker = attendees.find((a: any) => a.id === item.speakerId);
          const speakerName = matchedSpeaker ? matchedSpeaker.name : "미지정 화자";
          return `
            <div style="margin-bottom: 12px; padding: 10px; border-radius: 6px; background-color: #f8fafc; border-left: 4px solid #64748b;">
              <div style="font-size: 11px; color: #64748b; font-family: monospace;">${item.relativeTime} (${item.timestamp})</div>
              <div style="font-weight: bold; font-size: 13px; color: #1e293b; margin: 4px 0;">${speakerName}</div>
              <div style="font-size: 13px; color: #334155; white-space: pre-wrap;">${item.text}</div>
            </div>
          `;
        }).join("")
      : "<p>기록된 발언이 없습니다.</p>";

    const aiSummaryHtml = aiSummary
      ? `
        <div style="margin-top: 24px; padding: 16px; background-color: #f1f5f9; border-radius: 12px; border: 1px solid #e2e8f0;">
          <h3 style="margin-top: 0; color: #4f46e5; font-size: 16px;">
            ✨ AI 분석 요약 및 조치 피드백
          </h3>
          <div style="font-size: 13px; color: #334155; line-height: 1.6; white-space: pre-line;">${aiSummary}</div>
        </div>
      `
      : "";

    const htmlContent = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #334155;">
        <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px;">
          <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #64748b; tracking-wider: 0.05em;">Daemosan Hotel System</span>
          <h1 style="margin: 4px 0 0 0; font-size: 22px; color: #0f172a; font-weight: 800;">${title || "대모산 호텔 회의록"}</h1>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b;">일시: ${date || new Date().toLocaleString("ko-KR")}</p>
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 15px; color: #1e293b; font-weight: 700; margin-bottom: 8px;">참석자 목록</h2>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569;">
            ${attendeesList}
          </ul>
        </div>

        <div>
          <h2 style="font-size: 15px; color: #1e293b; font-weight: 700; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">회의 내용 타임라인</h2>
          ${transcriptRows}
        </div>

        ${aiSummaryHtml}

        <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center;">
          본 메일은 대모산 호텔 실시간 AI 회의록 시스템에서 발송되었습니다.
        </div>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: "Daemosan Hotel <onboarding@resend.dev>",
      to: [to],
      subject: `[대모산 호텔] ${title || "회의록"}`,
      html: htmlContent,
    });

    if (error) {
      console.error("Resend API Error:", error);
      return NextResponse.json({ error: error.message || "이메일 전송에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Email API general error:", error);
    return NextResponse.json(
      { error: error?.message || "이메일 전송 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
