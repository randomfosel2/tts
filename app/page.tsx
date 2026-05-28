"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Mic, 
  MicOff, 
  Pause, 
  Play, 
  Save, 
  RotateCcw, 
  Download, 
  Copy, 
  Plus, 
  Trash2, 
  Users, 
  Sparkles, 
  History, 
  Check, 
  AlertCircle, 
  Calendar, 
  ChevronRight,
  Maximize2,
  Lock,
  Volume2,
  HelpCircle,
  FileText,
  Mail
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Firebase/Firestore & Auth Integrations
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType, 
  testConnection 
} from "../lib/firebase";
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";

// Standard Interfaces based on the specifications
interface Attendee {
  id: string;
  name: string;
  color: string; // Tailwinds supported color strings: blue, emerald, purple, pink, amber, cyan
}

interface TimelineItem {
  id: string;
  timestamp: string; // e.g. "12:34:56"
  relativeTime: string; // e.g. "01:23"
  speakerId: string;
  text: string;
}

interface SavedMeeting {
  id: string;
  title: string;
  date: string;
  attendees: Attendee[];
  transcript: TimelineItem[];
  aiSummary?: string;
}

// Visual color configuration dictionary
const COLOR_MAP: Record<string, { bg: string; text: string; border: string; dot: string; ring: string; badge: string }> = {
  blue: { 
    bg: "bg-blue-50/80", 
    text: "text-blue-700", 
    border: "border-blue-200/60", 
    dot: "bg-blue-500", 
    ring: "focus:ring-blue-500",
    badge: "bg-blue-100/70 border border-blue-200 text-blue-800"
  },
  emerald: { 
    bg: "bg-emerald-50/80", 
    text: "text-emerald-700", 
    border: "border-emerald-200/60", 
    dot: "bg-emerald-500", 
    ring: "focus:ring-emerald-500",
    badge: "bg-emerald-100/70 border border-emerald-200 text-emerald-800"
  },
  purple: { 
    bg: "bg-purple-50/80", 
    text: "text-purple-700", 
    border: "border-purple-200/60", 
    dot: "bg-purple-500", 
    ring: "focus:ring-purple-500",
    badge: "bg-purple-100/70 border border-purple-200 text-purple-800"
  },
  pink: { 
    bg: "bg-pink-50/80", 
    text: "text-pink-700", 
    border: "border-pink-200/60", 
    dot: "bg-pink-500", 
    ring: "focus:ring-pink-500",
    badge: "bg-pink-100/70 border border-pink-200 text-pink-800"
  },
  amber: { 
    bg: "bg-amber-50/80", 
    text: "text-amber-700", 
    border: "border-amber-200/60", 
    dot: "bg-amber-500", 
    ring: "focus:ring-amber-500",
    badge: "bg-amber-100/70 border border-amber-200 text-amber-800"
  },
  cyan: { 
    bg: "bg-cyan-50/80", 
    text: "text-cyan-700", 
    border: "border-cyan-200/60", 
    dot: "bg-cyan-500", 
    ring: "focus:ring-cyan-500",
    badge: "bg-cyan-100/70 border border-cyan-200 text-cyan-800"
  },
};

// Hotel industry dialogue dataset for instant demo simulations
const DIALOGUE_POOL = [
  { speakerName: "참석자 A", text: "대모산 호텔 하우스키핑 부서 금일 오전 안건 교차 확인해 보겠습니다." },
  { speakerName: "참석자 B", text: "네 PM님, 현재 3층 디럭스 패밀리 객실 린넨 교체 및 일광 소독 스케줄 지연 원인을 조기 파악했습니다." },
  { speakerName: "참석자 A", text: "우선 지체되는 병목 현상을 방지하도록 5층 하이엔드 전담 크루를 3층으로 일시 전진 배치하여 신속 투입하겠습니다." },
  { speakerName: "참석자 B", text: "확인했습니다. 린넨 조정 조치 후 금일 저녁 동관 VIP 스위트 투숙 예정 검수 프로세스도 15시 전 완벽 관리하겠습니다." },
  { speakerName: "참석자 A", text: "식음료 부문에서 건의하신 와인 마케팅 프로모션 구성안 방향도 오늘 협의합시다." },
  { speakerName: "참석자 B", text: "네, 연회 및 조식 테이블 단가 조정사항 핵심 기획서가 마침 정리 완료되었으므로 기획팀에 즉각 송부해 회람하겠습니다." },
  { speakerName: "참석자 A", text: "호텔 브랜드 일체화를 최우선 가치로 하여 모든 객실 무결성 확보에 최선을 다해 주세요." }
];

// Pure ID generation helper defined outside component render path to comply with rule guidelines
function generateId(): string {
  if (typeof window !== "undefined" && typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11);
}

export default function STTApp() {
  // --- States ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [meetingTitle, setMeetingTitle] = useState<string>("대모산 호텔 사업부 정기 현안 회의");
  const [attendees, setAttendees] = useState<Attendee[]>([
    { id: "1", name: "참석자 A", color: "blue" },
    { id: "2", name: "참석자 B", color: "emerald" },
  ]);
  const [newAttendeeName, setNewAttendeeName] = useState<string>("");
  const [newAttendeeColor, setNewAttendeeColor] = useState<string>("blue");
  
  const [activeSpeakerId, setActiveSpeakerId] = useState<string>("1");
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [micState, setMicState] = useState<"not-requested" | "authorized" | "denied">("not-requested");
  const [transcript, setTranscript] = useState<TimelineItem[]>([]);
  const [interimResult, setInterimResult] = useState<string>("");
  
  // Storage & History States
  const [meetingHistory, setMeetingHistory] = useState<SavedMeeting[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  
  // Custom Warnings & Indicators
  const [isSilenceAlert, setIsSilenceAlert] = useState<boolean>(false);
  const [showNotification, setShowNotification] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  
  // AI Summary States
  const [aiSummary, setAiSummary] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // --- TTS Speech Playback States ---
  const [isPlayingVoice, setIsPlayingVoice] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [currentSpeakingIdx, setCurrentSpeakingIdx] = useState<number | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  // Hydration Gate to prevent default states from overwriting localStorage on mount
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  
  // Custom Inline Add Attendee Form states
  const [showInlineAddAttendee, setShowInlineAddAttendee] = useState<boolean>(false);
  const [inlineAttendeeName, setInlineAttendeeName] = useState<string>("");
  const [inlineAttendeeColor, setInlineAttendeeColor] = useState<string>("purple");

  // Direct Input State
  const [manualInput, setManualInput] = useState<string>("");

  // Email Sharing States
  const [emailTo, setEmailTo] = useState<string>("");
  const [isEmailLoading, setIsEmailLoading] = useState<boolean>(false);
  
  // --- Refs ---
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef<boolean>(false);
  const activeSpeakerIdRef = useRef<string>("1");
  const meetingStartRef = useRef<Date | null>(null);
  const lastSpeechTimeRef = useRef<number | null>(null);
  const simulationCounterRef = useRef<number>(0);

  // Sync refs to avoid closures inside Web Speech Event Handlers
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    activeSpeakerIdRef.current = activeSpeakerId;
  }, [activeSpeakerId]);

  // Trigger transient toast alert messages
  const notify = (type: "success" | "error" | "info", msg: string) => {
    setShowNotification({ type, msg });
    setTimeout(() => {
      setShowNotification(null);
    }, 4000);
  };

  // Synchronize history records with Firestore
  const loadHistoryFromFirestore = async (userId: string) => {
    try {
      const q = query(
        collection(db, "meetings"),
        where("ownerId", "==", userId),
        orderBy("updatedAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const fetched: SavedMeeting[] = [];
      querySnapshot.forEach((docSnap) => {
        const d = docSnap.data();
        fetched.push({
          id: docSnap.id,
          title: d.title || "",
          date: d.date || "",
          attendees: d.attendees || [],
          transcript: d.transcript || [],
          aiSummary: d.aiSummary || "",
        });
      });
      setMeetingHistory(fetched);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "meetings");
    }
  };

  // --- Initial Mount & Loading from LocalStorage ---
  useEffect(() => {
    lastSpeechTimeRef.current = Date.now();

    // Browser Web Speech support check safely deferred to avoid synchronous cascade warnings
    const SpeechRecognition = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
    
    // Defer state updates to bypass strict synchronous render cycle warnings
    setTimeout(() => {
      setIsSupported(!!SpeechRecognition);

      // Retrieve active in-progress meeting state safely after hydration
      try {
        const savedCurrent = localStorage.getItem("current_meeting");
        if (savedCurrent) {
          const parsed = JSON.parse(savedCurrent);
          if (parsed.title) setMeetingTitle(parsed.title);
          if (parsed.attendees && parsed.attendees.length > 0) {
            setAttendees(parsed.attendees);
            if (parsed.attendees[0]) {
              setActiveSpeakerId(parsed.attendees[0].id);
            }
          }
          if (parsed.transcript) setTranscript(parsed.transcript);
          if (parsed.aiSummary) setAiSummary(parsed.aiSummary);
        }
      } catch (e) {
        console.error("Failed to load current meeting data from LocalStorage:", e);
      }

      setIsHydrated(true);
    }, 0);

    // Subscribe to Firebase Auth changes
    const unsubscribe = onAuthStateChanged(auth, async (usr) => {
      setCurrentUser(usr);
      setAuthLoading(false);
      if (usr) {
        await loadHistoryFromFirestore(usr.uid);
      } else {
        // Retrieve localized offline history Safely
        try {
          const savedHistory = localStorage.getItem("meeting_history");
          if (savedHistory) {
            setMeetingHistory(JSON.parse(savedHistory));
          } else {
            setMeetingHistory([]);
          }
        } catch (e) {
          console.error("Failed to load offline meeting history from LocalStorage:", e);
        }
      }
    });

    // Run connection bootstrap check
    testConnection();

    return () => {
      unsubscribe();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // --- Debounced Auto-Save State ---
  useEffect(() => {
    if (!isHydrated) return;

    if (meetingTitle || attendees.length > 0 || transcript.length > 0 || aiSummary) {
      const timer = setTimeout(() => {
        const data = {
          title: meetingTitle,
          attendees,
          transcript,
          aiSummary
        };
        localStorage.setItem("current_meeting", JSON.stringify(data));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [meetingTitle, attendees, transcript, aiSummary, isHydrated]);

  // --- 30s Silence Detection loop ---
  useEffect(() => {
    const checker = setInterval(() => {
      if (isRecording) {
        const idleSecs = (Date.now() - (lastSpeechTimeRef.current || Date.now())) / 1000;
        if (idleSecs >= 30) {
          setIsSilenceAlert(true);
        } else {
          setIsSilenceAlert(false);
        }
      } else {
        setIsSilenceAlert(false);
      }
    }, 2000);
    return () => clearInterval(checker);
  }, [isRecording]);

  // --- Web Speech API Init and Hooks ---
  const initSpeechRecognition = () => {
    const SpeechRecognition = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
    if (!SpeechRecognition) return null;

    const rec = new SpeechRecognition();
    rec.lang = "ko-KR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onstart = () => {
      setMicState("authorized");
      lastSpeechTimeRef.current = Date.now();
    };

    rec.onresult = (event: any) => {
      lastSpeechTimeRef.current = Date.now();
      setIsSilenceAlert(false);
      let interimAccumulated = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const segmentText = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          const finalStr = segmentText.trim();
          if (finalStr) {
            commitSpeechBlock(finalStr);
          }
        } else {
          interimAccumulated += segmentText;
        }
      }
      setInterimResult(interimAccumulated);
    };

    rec.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
      if (event.error === "not-allowed") {
        setMicState("denied");
        notify("error", "마이크 권한 획득에 실패했습니다. 권한 설정을 확인해 주세요.");
        setIsRecording(false);
      } else if (event.error === "network") {
        notify("info", "네트워크 환경 불안정이 감지되었습니다. 자동 재연결에 들어갑니다.");
        // Non-blocking auto attempt
        setTimeout(() => {
          if (isRecordingRef.current) {
            try {
              rec.start();
            } catch (err) {}
          }
        }, 1000);
      }
    };

    rec.onend = () => {
      // Continuous Auto-Restart Guard to overcome default Web Speech API dropouts
      if (isRecordingRef.current) {
        try {
          rec.start();
        } catch (err) {
          console.warn("Failed to automatically resume Speech Recognition engine:", err);
        }
      }
    };

    return rec;
  };

  // Assign captured transcript segments to the active speaker
  const commitSpeechBlock = (text: string) => {
    const now = new Date();
    const tsStr = now.toLocaleTimeString("ko-KR", { hour12: false });
    
    let relStr = "00:00";
    if (meetingStartRef.current) {
      const elapsed = now.getTime() - meetingStartRef.current.getTime();
      const totalSec = Math.floor(elapsed / 1000);
      const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
      const s = (totalSec % 60).toString().padStart(2, '0');
      relStr = `${m}:${s}`;
    } else {
      meetingStartRef.current = now;
    }

    setTranscript(prev => [
      ...prev,
      {
        id: generateId(),
        timestamp: tsStr,
        relativeTime: relStr,
        speakerId: activeSpeakerIdRef.current,
        text: text
      }
    ]);
  };

  // Directly append manual text input to timeline
  const handleAddManualSpeech = () => {
    const trimmed = manualInput.trim();
    if (!trimmed) return;

    if (!meetingStartRef.current) {
      meetingStartRef.current = new Date();
    }

    commitSpeechBlock(trimmed);
    setManualInput("");
    notify("success", "발언이 직접 추가되었습니다.");
  };

  // Send email via Resend API
  const handleSendEmail = async () => {
    const trimmed = emailTo.trim();
    if (!trimmed) {
      notify("error", "이메일 주소를 입력해 주세요.");
      return;
    }
    if (transcript.length === 0) {
      notify("error", "전송할 회의록 내용이 비어 있습니다.");
      return;
    }

    setIsEmailLoading(true);
    try {
      const response = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: trimmed,
          title: meetingTitle,
          date: new Date().toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          }),
          attendees: attendees,
          transcript: transcript,
          aiSummary: aiSummary
        })
      });

      const data = await response.json();
      if (!response.ok) {
        const errorMsg = typeof data.error === 'object' 
          ? (data.error.message || JSON.stringify(data.error)) 
          : (data.error || "이메일 전송에 실패했습니다.");
        throw new Error(errorMsg);
      }

      notify("success", `"${trimmed}" 주소로 회의록 메일 전송이 완료되었습니다.`);
      setEmailTo("");
    } catch (err: any) {
      console.error(err);
      notify("error", err?.message || "이메일 전송 중 오류가 발생했습니다.");
    } finally {
      setIsEmailLoading(false);
    }
  };

  // Start Meeting STT Recording State
  const handleStart = async () => {
    if (!isSupported) {
      notify("error", "이 브라우저는 Web Speech API를 완벽하게 지원하지 않습니다. Chrome/Edge를 권유합니다.");
      return;
    }

    if (!meetingStartRef.current) {
      meetingStartRef.current = new Date();
    }

    // Reset silence tracker
    lastSpeechTimeRef.current = Date.now();

    try {
      if (!recognitionRef.current) {
        recognitionRef.current = initSpeechRecognition();
      }

      if (recognitionRef.current) {
        setIsRecording(true);
        recognitionRef.current.start();
        notify("success", "음성 회의록 작성을 성공적으로 시작했습니다.");
      }
    } catch (e: any) {
      // If already started, gracefully resume
      setIsRecording(true);
      console.log("Speech recognition start warning handled:", e?.message);
    }
  };

  // Pause Recording State
  const handlePause = () => {
    setIsRecording(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {}
    }
    setInterimResult("");
    notify("info", "음성 대기 모드로 전환되었습니다.");
  };

  // Save active minutes to historical list and clear scratchpad
  const handleSaveAndStop = async () => {
    if (transcript.length === 0) {
      notify("info", "저장할 타임라인 블록이 비어 있어 기록 보존이 무효화되었습니다.");
      return;
    }

    const meetingId = selectedHistoryId || generateId();
    const isUpdate = !!selectedHistoryId;

    const meetingPayload: SavedMeeting = {
      id: meetingId,
      title: meetingTitle || "대모산 호텔 안건 명시 회의",
      date: new Date().toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }),
      attendees: [...attendees],
      transcript: [...transcript],
      aiSummary: aiSummary
    };

    if (currentUser) {
      try {
        if (isUpdate) {
          // Update existing meeting document
          await setDoc(doc(db, "meetings", meetingId), {
            ...meetingPayload,
            ownerId: currentUser.uid,
            updatedAt: serverTimestamp()
          }, { merge: true });
          notify("success", "상기 음성 회의록 업데이트가 완료되었습니다.");
        } else {
          // Create new meeting document
          await setDoc(doc(db, "meetings", meetingId), {
            ...meetingPayload,
            ownerId: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          notify("success", "상기 음성 회의록 신규 저장이 완료되었습니다.");
        }
        await loadHistoryFromFirestore(currentUser.uid);
      } catch (err) {
        handleFirestoreError(err, isUpdate ? OperationType.UPDATE : OperationType.CREATE, `meetings/${meetingId}`);
      }
    } else {
      // Offline fallback behavior
      if (isUpdate) {
        const updatedList = meetingHistory.map(h => h.id === meetingId ? meetingPayload : h);
        setMeetingHistory(updatedList);
        localStorage.setItem("meeting_history", JSON.stringify(updatedList));
        notify("success", "로컬 회의록 업데이트가 완료되었습니다.");
      } else {
        const updatedList = [meetingPayload, ...meetingHistory];
        setMeetingHistory(updatedList);
        localStorage.setItem("meeting_history", JSON.stringify(updatedList));
        notify("success", "로컬 회의록 신규 저장이 완료되었습니다.");
      }
    }

    // Clear and reset state
    handleReset();
  };

  // --- TTS Speech Synthesis Control Logic ---
  const speakIndex = (idx: number, speedVal = playbackSpeed) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (idx >= transcript.length) {
      setIsPlayingVoice(false);
      setCurrentSpeakingIdx(null);
      notify("info", "회의록 음성 낭독이 완료되었습니다.");
      return;
    }

    setCurrentSpeakingIdx(idx);
    const item = transcript[idx];
    const speaker = attendees.find(a => a.id === item.speakerId)?.name || "참석자";
    const textToSpeak = `${speaker}: ${item.text}`;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "ko-KR";
    utterance.rate = speedVal;
    utteranceRef.current = utterance;

    utterance.onend = () => {
      speakIndex(idx + 1, speedVal);
    };

    utterance.onerror = (e) => {
      console.warn("TTS Speech Synthesis warning:", e);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handlePlayVoice = () => {
    if (transcript.length === 0) {
      notify("error", "낭독할 회의록 내용이 없습니다.");
      return;
    }

    if (typeof window === "undefined" || !window.speechSynthesis) {
      notify("error", "이 브라우저는 음성 합성을 지원하지 않습니다.");
      return;
    }

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPlayingVoice(true);
      notify("success", "음성 낭독을 재개합니다.");
    } else {
      const startIdx = currentSpeakingIdx !== null ? currentSpeakingIdx : 0;
      setIsPlayingVoice(true);
      speakIndex(startIdx);
      notify("success", "회의록 음성 낭독을 시작합니다.");
    }
  };

  const handlePauseVoice = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.pause();
      setIsPlayingVoice(false);
      notify("info", "음성 낭독이 일시 정지되었습니다.");
    }
  };

  const handleStopVoice = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlayingVoice(false);
      setCurrentSpeakingIdx(null);
      notify("info", "음성 낭독이 중단되었습니다.");
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    notify("info", `재생 속도가 ${speed}배속으로 변경되었습니다.`);
    if (isPlayingVoice && currentSpeakingIdx !== null) {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setTimeout(() => {
          speakIndex(currentSpeakingIdx, speed);
        }, 150);
      }
    }
  };

  // Reset current playground data
  const handleReset = () => {
    setIsRecording(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {}
    }

    // Stop speaking if active
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingVoice(false);
    setCurrentSpeakingIdx(null);

    setTranscript([]);
    setInterimResult("");
    setAiSummary("");
    setSelectedHistoryId(null);
    meetingStartRef.current = null;
    localStorage.removeItem("current_meeting");
    notify("info", "플레이그라운드 영역 정보가 포맷되었습니다.");
  };

  // Delete matching history row item
  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (currentUser) {
      try {
        await deleteDoc(doc(db, "meetings", id));
        notify("info", "해당 클라우드 회의록이 영구 소멸되었습니다.");
        await loadHistoryFromFirestore(currentUser.uid);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `meetings/${id}`);
      }
    } else {
      const updated = meetingHistory.filter(h => h.id !== id);
      setMeetingHistory(updated);
      localStorage.setItem("meeting_history", JSON.stringify(updated));
      notify("info", "로컬 히스토리 레코드가 영구 소멸되었습니다.");
    }
    
    if (selectedHistoryId === id) {
      setSelectedHistoryId(null);
    }
  };

  // Load select history record back as active playground
  const handleLoadHistory = (record: SavedMeeting) => {
    handleReset();

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingVoice(false);
    setCurrentSpeakingIdx(null);

    setMeetingTitle(record.title);
    setAttendees(record.attendees);
    setTranscript(record.transcript);
    setAiSummary(record.aiSummary || "");
    
    // Maintain the active loaded record pointer
    setTimeout(() => {
      setSelectedHistoryId(record.id);
      
      // Scroll to the AI summary section so the user can see it immediately
      const summaryCard = document.getElementById("ai-summary-card");
      if (summaryCard) {
        summaryCard.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
    notify("success", `"${record.title}" 레코드를 불러왔습니다.`);
  };

  // Update specific timeline text manually
  const handleTimelineTextChange = (id: string, newText: string) => {
    setTranscript(prev =>
      prev.map(item => (item.id === id ? { ...item, text: newText } : item))
    );
  };

  // Update timeline speaker association manually
  const handleTimelineSpeakerChange = (id: string, speakerId: string) => {
    setTranscript(prev =>
      prev.map(item => (item.id === id ? { ...item, speakerId } : item))
    );
  };

  // Remove individual timeline block row
  const handleDeleteTimelineItem = (id: string) => {
    setTranscript(prev => prev.filter(item => item.id !== id));
  };

  // --- Manage Attendees ---
  const handleAddAttendee = () => {
    const trimmed = newAttendeeName.trim();
    if (!trimmed) return;
    
    // Prevent duplicated names
    if (attendees.some(a => a.name === trimmed)) {
      notify("error", "이미 동명의 회의 참석자가 생성되어 있습니다.");
      return;
    }

    const newId = generateId();
    setAttendees(prev => [...prev, { id: newId, name: trimmed, color: newAttendeeColor }]);
    setNewAttendeeName("");
    notify("success", `회의 참석자 "${trimmed}"가 추가되었습니다.`);
  };

  const handleRegisterInlineAttendee = () => {
    const trimmed = inlineAttendeeName.trim();
    if (!trimmed) {
      setShowInlineAddAttendee(false);
      return;
    }
    
    if (attendees.some(a => a.name === trimmed)) {
      notify("error", "이미 동명의 회의 참석자가 생성되어 있습니다.");
      return;
    }

    const newId = generateId();
    const newAttendee = { id: newId, name: trimmed, color: inlineAttendeeColor };
    setAttendees(prev => [...prev, newAttendee]);
    setActiveSpeakerId(newId);
    setInlineAttendeeName("");
    setShowInlineAddAttendee(false);
    notify("success", `회의 참석자 "${trimmed}"가 추가되었으며, 활성 대화 화자로 지정되었습니다.`);
  };

  const handleDeleteAttendee = (id: string) => {
    if (attendees.length <= 1) {
      notify("error", "회의에는 최소 1명 이상의 참석자가 존재해야 합니다.");
      return;
    }
    setAttendees(prev => prev.filter(a => a.id !== id));
    // Re-route active speaker if we deleted it
    if (activeSpeakerId === id) {
      const remaining = attendees.filter(a => a.id !== id);
      setActiveSpeakerId(remaining[0].id);
    }
  };

  // --- Demo Speech Node Simulator ---
  const handleSimulateSpeech = () => {
    // Determine target index and loop
    const idx = simulationCounterRef.current % DIALOGUE_POOL.length;
    const item = DIALOGUE_POOL[idx];
    simulationCounterRef.current += 1;

    // Search or create simulated speaker
    let targetAttendee = attendees.find(a => a.name === item.speakerName);
    if (!targetAttendee) {
      const colors = ["blue", "emerald", "purple", "pink", "amber", "cyan"];
      const randColor = colors[simulationCounterRef.current % colors.length];
      const newId = generateId();
      targetAttendee = { id: newId, name: item.speakerName, color: randColor };
      setAttendees(prev => [...prev, targetAttendee!]);
    }

    // Set simulated speaker as active target and commit
    const prevActiveId = activeSpeakerId;
    setActiveSpeakerId(targetAttendee.id);
    commitSpeechBlock(item.text);
    
    // Notify
    notify("success", `[가상 시뮬레이터] "${targetAttendee.name}" 메시지가 커밋되었습니다.`);
  };

  // --- Export Utilities ---
  const handleDownloadTXT = () => {
    if (transcript.length === 0) {
      notify("error", "내보낼 회의 내용이 없습니다.");
      return;
    }

    const timestamp = new Date();
    const formattedDateStr = timestamp.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).replace(/\. /g, "-").replace(/\./g, "");

    const hours = timestamp.getHours().toString().padStart(2, '0');
    const mins = timestamp.getMinutes().toString().padStart(2, '0');

    let output = `[회의록] ${meetingTitle}\n`;
    output += `일시: ${formattedDateStr} ${hours}:${mins}:00\n`;
    output += `참석자 목록: ${attendees.map(a => a.name).join(", ")}\n`;
    output += `--------------------------------------\n\n`;

    transcript.forEach(item => {
      const spliter = attendees.find(a => a.id === item.speakerId);
      const sName = spliter ? spliter.name : "미지정 화자";
      output += `[${item.relativeTime} / ${sName}] ${item.text}\n`;
    });

    if (aiSummary) {
      output += `\n======================================\n`;
      output += `★ [AI 분석 요약 및 조치 피드백]\n`;
      output += `======================================\n\n`;
      output += aiSummary;
    }

    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${meetingTitle.replace(/\s+/g, "_")}_${formattedDateStr.replace(/-/g, "")}_${hours}${mins}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify("success", "TXT 형태의 원본 파일 패키지 다운로드가 수행되었습니다.");
  };

  const handleCopyMarkdown = () => {
    if (transcript.length === 0) {
      notify("error", "복사할 내용물이 비어 있습니다.");
      return;
    }

    let mk = `# [회의록] ${meetingTitle}\n\n`;
    mk += `* **일시:** ${new Date().toLocaleDateString("ko-KR")} ${new Date().toLocaleTimeString("ko-KR")}\n`;
    mk += `* **참석자:** ${attendees.map(a => `\`${a.name}\``).join(", ")}\n\n`;
    mk += `## 1. 발언기록 및 타임라인\n\n`;
    mk += `| 시간대 | 참석자 | 발언 요약 사항 |\n`;
    mk += `| :--- | :--- | :--- |\n`;

    transcript.forEach(item => {
      const spliter = attendees.find(a => a.id === item.speakerId);
      const sName = spliter ? spliter.name : "미지정 화자";
      mk += `| ${item.relativeTime} | **${sName}** | ${item.text.replace(/\|/g, "\\|")} |\n`;
    });

    if (aiSummary) {
      mk += `\n## 2. AI 동적 리포트 및 요약안\n\n${aiSummary}\n`;
    }

    navigator.clipboard.writeText(mk).then(() => {
      notify("success", "Markdown 구조화 데이터가 클립보드로 전송되었습니다.");
    }).catch(() => {
      notify("error", "클립보드 접근 라이팅 권한 장애가 확인되었습니다.");
    });
  };

  // --- Calling server-side Gemini AI summarization ---
  const handleRequestAISummary = async () => {
    if (transcript.length === 0) {
      notify("error", "요약 분석할 뼈대 STT 트랜스크립트 한계가 발견되었습니다.");
      return;
    }

    setIsAiLoading(true);
    setAiSummary("");

    try {
      const formattedData = transcript.map(item => {
        const matching = attendees.find(a => a.id === item.speakerId);
        return {
          timestamp: item.relativeTime,
          speaker: matching ? matching.name : "미지정 화자",
          text: item.text,
        };
      });

      const response = await fetch("/api/gemini/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: meetingTitle,
          attendees: attendees,
          transcript: formattedData,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "AI 요약 서버 통신 실패가 발견되었습니다.");
      }

      setAiSummary(data.text);
      notify("success", "대모산 호텔 전용 AI 통합 정밀 분석보고서 작성이 마무리되었습니다.");
    } catch (err: any) {
      console.error(err);
      notify("error", err?.message || "AI 요약본 작성 도중 장애가 도출되었습니다.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <main className="min-h-screen pb-16 pt-6 px-4 md:px-8 max-w-7xl mx-auto flex flex-col gap-6">
      
      {/* Dynamic Toast System */}
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, y: -45, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium ${
              showNotification.type === "success" 
                ? "bg-slate-900 text-emerald-400 border border-emerald-500/30" 
                : showNotification.type === "error"
                ? "bg-red-950 text-red-300 border border-red-500/30"
                : "bg-slate-900 text-sky-400 border border-sky-500/30"
            }`}
            id="toast-notification"
          >
            {showNotification.type === "success" && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
            {showNotification.type === "error" && <AlertCircle className="w-4 h-4 text-red-400" />}
            {showNotification.type === "info" && <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />}
            <span>{showNotification.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Decorative Floating Service Brand Board */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200/80 pb-6" id="dashboard-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">
              Corporate Portal
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span className="text-xs text-slate-500">Daemosan Hotel & Resorts</span>
          </div>
          <h1 className="text-2xl font-bold font-sans text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <Volume2 className="w-6 h-6 text-slate-700" />
            실시간 AI 회의록 시스템
          </h1>
        </div>
        
        {/* Top Control Simulate Button & Reset Board */}
        <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto">
          {/* Firebase Authentication & Cloud Database Sync Section */}
          <div className="flex items-center gap-2 mr-1" id="firebase-auth-section">
            {authLoading ? (
              <div className="text-xs text-slate-400 font-medium">인증 연동 로딩...</div>
            ) : currentUser ? (
              <div className="flex items-center gap-2.5 bg-emerald-50/90 text-emerald-850 border border-emerald-200/40 rounded-lg px-3 py-1.5 text-xs font-medium flex-nowrap">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-[11px] leading-tight text-emerald-900">{currentUser.displayName || "지배인"} (동기화 활성)</span>
                  <span className="text-[10px] text-emerald-600 font-mono leading-none">{currentUser.email}</span>
                </div>
                <button
                  onClick={async () => {
                    await signOut(auth);
                    notify("info", "로그아웃 되었습니다. 이제부터 로컬 저장을 이용합니다.");
                  }}
                  className="ml-1 text-[10px] text-slate-600 hover:text-red-700 bg-white hover:bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-center cursor-pointer font-semibold transition shrink-0"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  try {
                    await signInWithPopup(auth, googleProvider);
                    notify("success", "구글 로그인 및 클라우드 동기화 시스템 연동 완료!");
                  } catch (e: any) {
                    notify("error", "로그인 실패: " + e.message);
                  }
                }}
                className="flex items-center gap-1.5 bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition hover:shadow-xs cursor-pointer shrink-0"
              >
                <Users className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>구글 로그인 (클라우드 동기화)</span>
              </button>
            )}
          </div>

          <button
            onClick={handleSimulateSpeech}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100/80 border border-indigo-200/50 transition duration-150 cursor-pointer"
            title="마이크 권한 획득 없이 인코딩 회동 대화를 주입하고 시뮬레이션 합니다."
            id="btn-simulate"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>시뮬레이션 가상 음성 추가</span>
          </button>
          
          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200/60 transition duration-150 cursor-pointer"
            id="btn-reset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>보드 초기화</span>
          </button>
        </div>
      </div>

      {/* Two Column Service Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="workspace-grid">
        
        {/* LEFT COLUMN: Sidebar Organization Blocks (Grid: 4) */}
        <div className="lg:col-span-4 flex flex-col gap-6" id="workspace-sidebar">
          
          {/* Box 1: Attendees Management Board */}
          <div className="glass-panel p-5 rounded-2xl shadow-sm border border-slate-200/60" id="attendees-panel">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-700" />
                회의 참석자 권한단 관리 ({attendees.length}명)
              </h2>
            </div>

            {/* Existing Attendees Feed */}
            <div className="flex flex-wrap gap-2 mb-4 max-h-[160px] overflow-y-auto pr-1" id="attendees-list">
              {attendees.map(a => {
                const cColors = COLOR_MAP[a.color] || COLOR_MAP.blue;
                return (
                  <motion.div 
                    layout
                    key={a.id} 
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cColors.bg} ${cColors.text} ${cColors.border} border`}
                    id={`attendee-item-${a.id}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${cColors.dot}`} />
                    <span>{a.name}</span>
                    <button 
                      onClick={() => handleDeleteAttendee(a.id)}
                      className="ml-1 text-slate-400 hover:text-slate-900 hover:bg-slate-200/50 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[10px]"
                      title="삭제"
                      id={`btn-delete-attendee-${a.id}`}
                    >
                      ×
                    </button>
                  </motion.div>
                );
              })}
            </div>

            {/* Create New Attendees Forms */}
            <div className="border-t border-slate-100 pt-4 flex flex-col gap-2" id="add-attendee-form">
              <span className="text-[11px] text-slate-500 font-medium">참석자 등록선</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="예: 지배인 C, 임원 D"
                  value={newAttendeeName}
                  onChange={(e) => setNewAttendeeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddAttendee();
                  }}
                  className="flex-1 bg-slate-50 border border-slate-200 text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium"
                  id="input-attendee-name"
                />
                
                {/* Color circle matrix selection */}
                <select
                  value={newAttendeeColor}
                  onChange={(e) => setNewAttendeeColor(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2.5 py-2 font-medium focus:outline-none"
                  id="select-attendee-color"
                >
                  <option value="blue">파랑</option>
                  <option value="emerald">녹색</option>
                  <option value="purple">보라</option>
                  <option value="pink">분홍</option>
                  <option value="amber">황색</option>
                  <option value="cyan">청록</option>
                </select>

                <button
                  onClick={handleAddAttendee}
                  className="px-3 bg-slate-800 hover:bg-slate-950 text-white rounded-lg transition duration-150 flex items-center justify-center cursor-pointer"
                  id="btn-add-attendee"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Box 2: Meeting History Feed (Cloud/Local Sync Mode) */}
          <div className="glass-panel p-5 rounded-2xl shadow-sm border border-slate-200/60 flex-1 flex flex-col min-h-[300px]" id="history-panel">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 mb-4">
              <History className="w-4 h-4 text-slate-700" />
              {currentUser ? "클라우드 저장 회의록" : "로컬 화상 회의록 이력"} ({meetingHistory.length}개)
            </h2>

            {meetingHistory.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                <FileText className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs text-slate-500">
                  {currentUser ? "클라우드 데이터베이스에 보존된 안건 회의록이 없습니다." : "지정 저장된 정례 회의록 이력이 존재하지 않습니다."}
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto max-h-[460px] pr-1 flex flex-col gap-2.5" id="history-items-list">
                {meetingHistory.map(h => (
                  <div
                    key={h.id}
                    onClick={() => handleLoadHistory(h)}
                    className={`p-3.5 rounded-xl text-left transition duration-150 cursor-pointer flex flex-col gap-1.5 border group relative ${
                      selectedHistoryId === h.id 
                        ? "bg-slate-900 text-slate-100 border-slate-900 shadow-sm"
                        : "bg-white hover:bg-slate-50 text-slate-800 border-slate-100 hover:border-slate-200"
                    }`}
                    id={`history-item-${h.id}`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <span className={`text-[11px] font-mono ${selectedHistoryId === h.id ? "text-slate-400" : "text-slate-500"}`}>
                        {h.date}
                      </span>
                      <button
                        onClick={(e) => handleDeleteHistory(h.id, e)}
                        className={`text-slate-400 hover:text-red-500 opacity-60 group-hover:opacity-100 transition p-1 rounded-md`}
                        title="이력 삭제"
                        id={`btn-delete-history-${h.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h3 className="text-xs font-semibold leading-snug tracking-tight line-clamp-1">
                      {h.title}
                    </h3>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded leading-none group-hover:bg-slate-200">
                        발언 {h.transcript.length}개
                      </span>
                      {h.aiSummary && (
                        <span className="text-[10px] bg-indigo-50/80 text-indigo-700 px-1.5 py-0.5 rounded leading-none border border-indigo-100/30 flex items-center gap-0.5 font-medium">
                          <Sparkles className="w-2 h-2" /> AI 요약 포함
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Persistent Background Tab Limitation Notice */}
          <div className="bg-amber-50/80 border border-amber-200/50 p-4 rounded-xl text-[11px] text-amber-800 leading-relaxed" id="background-warning-box">
            <div className="flex gap-2 items-start">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">안정적인 회의 녹음 운영 권고</p>
                <p className="mt-1">
                  모바일 화면 잠금이나 브라우저 프레임이 백그라운드로 전환될 시 보안 정책에 의해 음성 인식이 돌발 중단될 수 있습니다. 
                  대화 녹음 중에는 본 탭을 가급적 활성화(전면 노출)로 유지 바랍니다.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Realtime STT Workspace Page (Grid: 8) */}
        <div className="lg:col-span-8 flex flex-col gap-6" id="workspace-main">
          
          {/* Main Controls & Parameters Console */}
          <div className="glass-panel p-5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col gap-4" id="main-controller">
            
            {/* Title Editing Section */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">회의 어젠다 제목</label>
              <input
                type="text"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="회의 명칭을 지정해 주세요"
                className="w-full bg-slate-50/60 border border-slate-100 hover:border-slate-200 focus:border-slate-400 focus:outline-none focus:bg-white text-base font-bold text-slate-900 rounded-xl px-4 py-2.5 transition"
                id="input-meeting-title"
              />
            </div>

            {/* Browser & Active Status Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600" id="system-status-row">
              <div className="flex items-center gap-4">
                
                {/* Checker 1: Browser compatibility */}
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-500">브라우저 검증:</span>
                  {isSupported ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                      정상 (Speech Standard)
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200/50">
                      비지원 (Chrome 권장)
                    </span>
                  )}
                </div>

                {/* Checker 2: Mic authorization indicator */}
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-500">마이크 권한:</span>
                  {micState === "authorized" ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                      <Lock className="w-3 h-3 text-emerald-600 inline" /> 승인됨
                    </span>
                  ) : micState === "denied" ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 font-semibold">
                      <AlertCircle className="w-3 h-3 text-rose-600 inline" /> 거부됨
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">요구 대기</span>
                  )}
                </div>

              </div>

              {/* STT State display lights */}
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-500">엔진 상태:</span>
                <div className="flex items-center gap-1.5 font-medium">
                  {isRecording ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                      </span>
                      <span className="text-red-700 font-semibold text-[11px]">실시간 녹음 인지 중...</span>
                    </>
                  ) : !isRecording && transcript.length > 0 ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                      <span className="text-amber-700 font-semibold text-[11px]">일시정지</span>
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                      <span className="text-slate-500 text-[11px]">대기 중</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Active Tagging Speaker Pills Selector */}
            <div className="flex flex-col gap-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100" id="quick-speaker-selector">
              <span className="text-xs text-slate-500 font-bold tracking-tight">
                ★ 실시간 발화자 퀵 지정 (현재 기록 중인 발화자를 변경하려면 선택하세요)
              </span>
              
              <div className="flex flex-wrap gap-2 mt-1">
                {attendees.map(a => {
                  const cColors = COLOR_MAP[a.color] || COLOR_MAP.blue;
                  const isSelected = activeSpeakerId === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setActiveSpeakerId(a.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                        isSelected 
                          ? `${cColors.badge} bg-white shadow-sm ring-1 ring-slate-400`
                          : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200/70"
                      }`}
                      id={`btn-quick-speaker-${a.id}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isSelected ? cColors.dot : "bg-slate-300"} ${isSelected ? "animate-pulse" : ""}`} />
                      <span>{a.name}</span>
                    </button>
                  );
                })}

                {/* Inline Add Attendee Toggle Button for maximum usability */}
                {!showInlineAddAttendee ? (
                  <button
                    onClick={() => setShowInlineAddAttendee(true)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 text-slate-500 hover:text-slate-800 transition flex items-center gap-1 cursor-pointer"
                    id="btn-inline-add-attendee-toggle"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-400" />
                    <span>참석자 추가</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-3 py-1 rounded-full text-xs" id="inline-add-attendee-container">
                    <input
                      type="text"
                      placeholder="이름 입력 (예: 지배인 C)"
                      value={inlineAttendeeName}
                      onChange={(e) => setInlineAttendeeName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRegisterInlineAttendee();
                        if (e.key === 'Escape') setShowInlineAddAttendee(false);
                      }}
                      className="bg-transparent border-none text-xs font-semibold focus:outline-none w-32 px-1 text-slate-800"
                      autoFocus
                      id="input-inline-attendee-name"
                    />
                    <select
                      value={inlineAttendeeColor}
                      onChange={(e) => setInlineAttendeeColor(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-[10px] rounded px-1.5 py-0.5 font-medium focus:outline-none text-slate-600"
                      id="select-inline-attendee-color"
                    >
                      <option value="blue">파랑</option>
                      <option value="emerald">녹색</option>
                      <option value="purple">보라</option>
                      <option value="pink">분홍</option>
                      <option value="amber">황색</option>
                      <option value="cyan">청록</option>
                    </select>
                    <button
                      onClick={handleRegisterInlineAttendee}
                      className="text-xs bg-slate-800 hover:bg-slate-950 text-white font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center cursor-pointer"
                      title="저장"
                      id="btn-inline-attendee-save"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => {
                        setShowInlineAddAttendee(false);
                        setInlineAttendeeName("");
                      }}
                      className="text-xs text-slate-400 hover:text-slate-700 font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center cursor-pointer"
                      title="취소"
                      id="btn-inline-attendee-cancel"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Top Level controls (Start / Pause / Save) */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2" id="speech-control-buttons">
              {isRecording ? (
                <button
                  onClick={handlePause}
                  className="flex-1 min-w-[130px] flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-5 rounded-xl transition duration-150 cursor-pointer shadow-sm hover:shadow"
                  id="btn-pause"
                >
                  <Pause className="w-4 h-4" />
                  <span>일시정지 (Pause)</span>
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  className="flex-1 min-w-[130px] flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white font-semibold py-3 px-5 rounded-xl transition duration-150 cursor-pointer shadow-sm hover:shadow"
                  id="btn-start"
                >
                  <Mic className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>녹음 시작 (Start)</span>
                </button>
              )}

              <button
                onClick={handleSaveAndStop}
                disabled={transcript.length === 0}
                className="flex-1 min-w-[130px] flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold py-3 px-5 rounded-xl transition duration-150 cursor-pointer disabled:cursor-not-allowed shadow-sm hover:shadow"
                id="btn-save"
              >
                <Save className="w-4 h-4" />
                <span>정개록 완료 및 보존</span>
              </button>
            </div>

            {/* Direct Speech Input Bar */}
            <div className="flex flex-col gap-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100 mt-1" id="direct-speech-input">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-bold tracking-tight">
                  ✍️ 발언 직접 입력 (녹음 중이거나 대기 중일 때 직접 입력하여 추가할 수 있습니다)
                </span>
                {(() => {
                  const activeSpk = attendees.find(a => a.id === activeSpeakerId);
                  if (!activeSpk) return null;
                  const colorConf = COLOR_MAP[activeSpk.color] || COLOR_MAP.blue;
                  return (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${colorConf.badge}`}>
                      {activeSpk.name}의 발언으로 추가
                    </span>
                  );
                })()}
              </div>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddManualSpeech();
                  }}
                  placeholder="대화 내용을 직접 타이핑하여 입력하세요..."
                  className="flex-1 bg-white border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium placeholder-slate-400/80 shadow-xs"
                  id="input-manual-speech"
                />
                <button
                  onClick={handleAddManualSpeech}
                  disabled={!manualInput.trim()}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-950 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl font-semibold text-xs transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-xs shrink-0"
                  id="btn-add-manual-speech"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>추가</span>
                </button>
              </div>
            </div>

          </div>

          {/* Time Limit / Silent Warn Indicators */}
          <AnimatePresence>
            {isSilenceAlert && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3.5 rounded-xl text-xs flex gap-2 items-center"
                id="silence-alert"
              >
                <AlertCircle className="w-4 h-4 text-yellow-600 animate-bounce" />
                <span>
                  <strong>무음 경고:</strong> 30초 동안 활성 발화 입력이 감지되지 않았습니다. 조용한 상태를 보완하거나 필요 시 녹음을 정지하세요.
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Central Feed: Timeline of Confirmed Statements */}
          <div className="glass-panel p-5 rounded-2xl shadow-sm border border-slate-200/60 flex-1 flex flex-col min-h-[400px]" id="timeline-container">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-950 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-700" />
                실시간 발언 인지도 피드 타임라인 ({transcript.length}개)
              </h3>
              
              <span className="text-[11px] font-mono text-slate-500">
                ※ 타임라인 텍스트 및 화자는 더블클릭이나 셀렉트로 사후 즉각 수정 및 지정할 수 있습니다.
              </span>
            </div>

            {/* TTS Speech Synthesis Player Bar */}
            {transcript.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/60 mb-4 text-xs" id="tts-player-bar">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">회의록 음성 낭독 (TTS):</span>
                  {isPlayingVoice ? (
                    <span className="flex items-center gap-1 text-[11px] text-indigo-700 font-bold">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                      </span>
                      낭독 중 {currentSpeakingIdx !== null ? `(${currentSpeakingIdx + 1}/${transcript.length})` : ""}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 font-medium">대기</span>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Playback rate speed selector buttons */}
                  <div className="flex items-center gap-1.5" id="tts-speed-buttons">
                    <span className="text-[10px] text-slate-500 font-mono">속도:</span>
                    {([0.75, 1.0, 1.5, 2.0] as const).map(speed => (
                      <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition cursor-pointer ${
                          playbackSpeed === speed
                            ? "bg-slate-900 text-white"
                            : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                        id={`btn-tts-speed-${speed.toString().replace('.', '_')}`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>

                  {/* Play/Pause/Stop control buttons */}
                  <div className="flex items-center gap-1" id="tts-controls">
                    {isPlayingVoice ? (
                      <button
                        onClick={handlePauseVoice}
                        className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-bold transition cursor-pointer"
                        id="btn-tts-pause"
                      >
                        <Pause className="w-3 h-3" />
                        일시정지
                      </button>
                    ) : (
                      <button
                        onClick={handlePlayVoice}
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-black text-white rounded-md text-[11px] font-bold transition cursor-pointer"
                        id="btn-tts-play"
                      >
                        <Play className="w-3 h-3 text-emerald-400" />
                        재생
                      </button>
                    )}
                    
                    <button
                      onClick={handleStopVoice}
                      className="flex items-center gap-1 px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-[11px] font-bold transition cursor-pointer"
                      id="btn-tts-stop"
                    >
                      <RotateCcw className="w-3 h-3" />
                      중지
                    </button>
                  </div>
                </div>
              </div>
            )}

            {transcript.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12" id="timeline-empty-state">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-4 border border-slate-100">
                  <Mic className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">구축할 타임라인이 아직 작성되지 않았습니다.</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                  [녹음 시작] 버튼을 누르고 발화해 주시거나 [시뮬레이션 가상 음성 추가] 버튼으로 가상 비즈니스 통화를 발생시키실 수 있습니다.
                </p>
              </div>
            ) : (
              <div className="flex-1 relative pl-6 flex flex-col gap-6 timeline-glow overflow-y-auto max-h-[500px] pr-2" id="timeline-items-feed">
                <AnimatePresence initial={false}>
                  {transcript.map((item, idx) => {
                    const matchedSpeaker = attendees.find(a => a.id === item.speakerId);
                    const colorConf = matchedSpeaker ? (COLOR_MAP[matchedSpeaker.color] || COLOR_MAP.blue) : COLOR_MAP.blue;
                    const isSpeakingThis = currentSpeakingIdx === idx;
                    
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -15, y: 10 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                        className={`relative flex flex-col sm:flex-row sm:items-start gap-3 group border p-3 rounded-xl transition duration-150 ${
                          isSpeakingThis
                            ? "border-indigo-500 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-400"
                            : "border-slate-100 hover:border-slate-200/60 hover:bg-slate-50/50"
                        }`}
                        id={`timeline-row-${item.id}`}
                      >
                        {/* Timeline absolute dot indicator */}
                        <span className={`absolute -left-[23px] top-4 z-10 w-3 h-3 rounded-full border-2 border-white ${colorConf.dot}`} />

                        {/* Top-aligned Metadata details (Timestamp / Speaker combo dropdown) */}
                        <div className="sm:w-36 flex sm:flex-col gap-2 shrink-0 pt-0.5">
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded leading-none w-max">
                            {item.relativeTime} ({item.timestamp})
                          </span>

                          <select
                            value={item.speakerId}
                            onChange={(e) => handleTimelineSpeakerChange(item.id, e.target.value)}
                            className={`text-xs font-semibold py-0.5 px-2 rounded-md ${colorConf.bg} ${colorConf.text} border ${colorConf.border} focus:outline-none focus:ring-1 focus:ring-slate-400 w-full cursor-pointer max-w-[150px] sm:max-w-none`}
                            id={`dropdown-timeline-speaker-${item.id}`}
                          >
                            {attendees.map(a => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Speech content editable fields */}
                        <div className="flex-1 flex gap-2 items-start">
                          <textarea
                            value={item.text}
                            onChange={(e) => handleTimelineTextChange(item.id, e.target.value)}
                            className="w-full bg-transparent border-none text-slate-800 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-slate-200 rounded p-1 resize-none"
                            rows={Math.max(1, Math.ceil(item.text.length / 32))}
                            placeholder="공백 처리된 대화 기록"
                            id={`textarea-timeline-text-${item.id}`}
                          />

                          <button
                            onClick={() => handleDeleteTimelineItem(item.id)}
                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-slate-100 cursor-pointer"
                            title="삭제"
                            id={`btn-delete-timeline-${item.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            {/* Bottom Real-time speech interim visual feedback area */}
            {interimResult && (
              <div className="mt-4 p-3 bg-indigo-50/40 border border-indigo-100/50 rounded-xl flex items-center gap-3 animate-pulse" id="interim-preview-container">
                <Mic className="w-4 h-4 text-indigo-500 shrink-0" />
                <div className="flex-1">
                  <span className="text-[10px] font-mono font-bold tracking-tight text-indigo-500 block">
                    인식 진행 중 (Interim Result)
                  </span>
                  <p className="text-xs text-indigo-800/80 italic mt-0.5 font-medium line-clamp-1">
                    &quot;{interimResult}&quot;
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* AI Intelligence Analyzing Summarizer Board */}
          <div className="glass-panel p-5 rounded-2xl shadow-sm border border-slate-200/60" id="ai-summary-card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                호텔 정례 AI 비즈니스 분석 요약
              </h3>

              <button
                onClick={handleRequestAISummary}
                disabled={isAiLoading || transcript.length === 0}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold py-2 px-3.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                id="btn-ai-generate"
              >
                {isAiLoading ? (
                  <>
                    <div className="w-3 h-3 rounded-full border-2 border-slate-50 border-t-transparent animate-spin" />
                    <span>정밀 분석 추출 중...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                    <span>AI 요약본 생성</span>
                  </>
                )}
              </button>
            </div>

            {isAiLoading && (
              <div className="p-8 border border-dashed border-indigo-100 rounded-xl bg-indigo-50/20 text-center flex flex-col items-center justify-center gap-3">
                <div className="relative flex h-10 w-10">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-10 w-10 bg-indigo-600 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </span>
                </div>
                <div className="text-xs text-indigo-900 font-medium">
                  <strong>Gemini AI 엔진이 회의록을 압축 구조화 중입니다.</strong>
                  <p className="text-[11px] text-indigo-600/70 mt-1">
                    의제 추출, 담당 화자들의 핵심 발언 요약과 Action Items를 자동 수립하고 있습니다.
                  </p>
                </div>
              </div>
            )}

            {!isAiLoading && aiSummary && (
              <div className="bg-slate-900 text-slate-100 border border-slate-950 p-5 rounded-xl max-h-[400px] overflow-y-auto leading-relaxed text-xs shadow-inner" id="ai-summary-text">
                <div className="markdown-body whitespace-pre-line font-medium text-slate-300" id="markdown-container">
                  {aiSummary}
                </div>
              </div>
            )}

            {!isAiLoading && !aiSummary && (
              <div className="p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/40 text-center text-xs text-slate-500">
                인식 완료된 타임라인 피드가 있다면 [AI 요약본 생성]을 눌러 사내 실무진 배포 수준의 분석 요약 리포트를 열 수 있습니다.
              </div>
            )}
          </div>

          {/* Email Send Card */}
          <div className="glass-panel p-5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col gap-4" id="email-send-card">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-slate-700" />
                회의록 이메일 공유 (Resend)
              </h3>
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="수신자 이메일 주소를 입력하세요 (예: manager@daemosan.com)"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium placeholder-slate-400/80 shadow-xs"
                id="input-email-to"
              />
              <button
                onClick={handleSendEmail}
                disabled={isEmailLoading || transcript.length === 0 || !emailTo.trim()}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-950 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl font-semibold text-xs transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-xs shrink-0"
                id="btn-send-email"
              >
                {isEmailLoading ? (
                  <>
                    <div className="w-3 h-3 rounded-full border-2 border-slate-50 border-t-transparent animate-spin" />
                    <span>전송 중...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    <span>이메일 전송</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Export & Command Utilities Footer */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-900 p-4 rounded-2xl shadow border border-slate-950" id="export-footer">
            <span className="text-[11px] text-slate-400 font-mono font-medium tracking-wide mr-auto uppercase">
              Export Suite & Core Controls
            </span>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleCopyMarkdown}
                disabled={transcript.length === 0}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-950 border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold px-4 py-2.5 rounded-xl transition cursor-pointer"
                id="btn-copy-markdown"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>마크다운 클립보드 복사(Markdown)</span>
              </button>

              <button
                onClick={handleDownloadTXT}
                disabled={transcript.length === 0}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs text-emerald-300 hover:text-emerald-100 bg-slate-800 hover:bg-slate-950 border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold px-4 py-2.5 rounded-xl transition cursor-pointer"
                id="btn-download-txt"
              >
                <Download className="w-3.5 h-3.5" />
                <span>TXT 파일 다운로드</span>
              </button>
            </div>
          </div>

        </div>

      </div>

    </main>
  );
}
