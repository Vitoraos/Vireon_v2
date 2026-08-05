/**
 * Core state machine for the patient interview flow.
 * Manages the full lifecycle: recording → upload → processing → TTS → loop.
 * Pure reducer + side effects in the hook.
 */

import { useCallback, useEffect, useRef, useReducer } from 'react';
import {
  InterviewStatus,
  HistoryTurn,
  SlotsFilled,
  DoctorResponseCheck,
} from '@/types';
import {
  transcribeAudio,
  sendInterviewTurn,
  generateReport,
  checkDoctorResponse,
  synthesizeSpeech,
  ApiClientError,
} from '@/lib/api';
import {
  MAX_POLL_ATTEMPTS,
  POLL_INTERVAL_MS,
  MAX_RECORDING_DURATION_MS,
  AUDIO_MIME_TYPE_PREFERENCE,
  UI_COPY,
} from '@/lib/constants';

// ─── State ───

interface State {
  status: InterviewStatus;
  sessionId: string;
  history: HistoryTurn[];
  chiefComplaint: string | null;
  currentTranscript: string | null;
  slotsFilled: SlotsFilled | null;
  turnsUsed: number;
  reportId: string | null;
  doctorResponse: DoctorResponseCheck | null;
  errorMessage: string | null;
  recoverable: boolean;
  ttsText: string | null;
  isRecording: boolean;
  pollAttempts: number;
}

const initialState = (sessionId: string): State => ({
  status: 'idle',
  sessionId,
  history: [],
  chiefComplaint: null,
  currentTranscript: null,
  slotsFilled: null,
  turnsUsed: 0,
  reportId: null,
  doctorResponse: null,
  errorMessage: null,
  recoverable: true,
  ttsText: null,
  isRecording: false,
  pollAttempts: 0,
});

// ─── Actions ───

type Action =
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' }
  | { type: 'UPLOAD_START' }
  | { type: 'UPLOAD_SUCCESS'; transcript: string }
  | { type: 'UPLOAD_ERROR'; message: string }
  | { type: 'PROCESSING_START' }
  | { type: 'PROCESSING_SUCCESS'; data: { next_question: string | null; slots_filled: SlotsFilled; red_flag_detected: boolean; recommend_emergency: boolean; turns_used: number; done: boolean } }
  | { type: 'PROCESSING_ERROR'; message: string }
  | { type: 'TTS_START'; text: string }
  | { type: 'TTS_ENDED' }
  | { type: 'TTS_ERROR'; message: string }
  | { type: 'GENERATE_REPORT_START' }
  | { type: 'GENERATE_REPORT_SUCCESS'; reportId: string }
  | { type: 'GENERATE_REPORT_ERROR'; message: string }
  | { type: 'POLL_START' }
  | { type: 'POLL_SUCCESS'; response: DoctorResponseCheck }
  | { type: 'POLL_ERROR'; message: string }
  | { type: 'RETRY' }
  | { type: 'RESET' }
  | { type: 'FORCE_NEXT_TURN' }; // For demo / manual override

// ─── Reducer ───

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START_RECORDING':
      return { ...state, status: 'recording', isRecording: true, errorMessage: null };

    case 'STOP_RECORDING':
      return { ...state, isRecording: false };

    case 'UPLOAD_START':
      return { ...state, status: 'uploading' };

    case 'UPLOAD_SUCCESS': {
      const isFirstTurn = state.chiefComplaint === null;
      const newHistory: HistoryTurn[] = [
        ...state.history,
        { role: 'patient', text: action.transcript },
      ];
      return {
        ...state,
        status: 'processing',
        currentTranscript: action.transcript,
        chiefComplaint: isFirstTurn ? action.transcript : state.chiefComplaint,
        history: newHistory,
      };
    }

    case 'UPLOAD_ERROR':
      return {
        ...state,
        status: 'error',
        errorMessage: action.message,
        recoverable: true,
        isRecording: false,
      };

    case 'PROCESSING_START':
      return { ...state, status: 'processing' };

    case 'PROCESSING_SUCCESS': {
      const { next_question, slots_filled, red_flag_detected, recommend_emergency, turns_used, done } = action.data;

      // Red flag or done: skip TTS, go to report generation
      if (done || red_flag_detected) {
        const newHistory: HistoryTurn[] = next_question
          ? [...state.history, { role: 'agent', text: next_question }]
          : state.history;
        return {
          ...state,
          status: 'generating_report',
          slotsFilled: slots_filled,
          turnsUsed: turns_used,
          history: newHistory,
          ttsText: next_question,
        };
      }

      // Continue interview: play TTS then record next turn
      const newHistory: HistoryTurn[] = next_question
        ? [...state.history, { role: 'agent', text: next_question }]
        : state.history;
      return {
        ...state,
        status: 'playing_tts',
        slotsFilled: slots_filled,
        turnsUsed: turns_used,
        history: newHistory,
        ttsText: next_question,
      };
    }

    case 'PROCESSING_ERROR':
      return {
        ...state,
        status: 'error',
        errorMessage: action.message,
        recoverable: true,
      };

    case 'TTS_START':
      return { ...state, status: 'playing_tts', ttsText: action.text };

    case 'TTS_ENDED':
      return { ...state, status: 'idle', ttsText: null };

    case 'TTS_ERROR':
      // TTS failure is not fatal — show text and continue
      return { ...state, status: 'idle', ttsText: null };

    case 'GENERATE_REPORT_START':
      return { ...state, status: 'generating_report' };

    case 'GENERATE_REPORT_SUCCESS':
      return {
        ...state,
        status: 'submitted',
        reportId: action.reportId,
      };

    case 'GENERATE_REPORT_ERROR':
      return {
        ...state,
        status: 'error',
        errorMessage: action.message,
        recoverable: true,
      };

    case 'POLL_START':
      return { ...state, status: 'polling', pollAttempts: state.pollAttempts + 1 };

    case 'POLL_SUCCESS': {
      if (action.response.responded) {
        return {
          ...state,
          status: 'response_received',
          doctorResponse: action.response,
        };
      }
      // Still waiting — stay in polling, the effect will schedule next poll
      return { ...state, status: 'polling' };
    }

    case 'POLL_ERROR':
      // Polling errors are recoverable — keep trying unless max attempts
      if (state.pollAttempts >= MAX_POLL_ATTEMPTS) {
        return {
          ...state,
          status: 'error',
          errorMessage: 'Doctor response timed out. Please check back later.',
          recoverable: false,
        };
      }
      return { ...state, status: 'polling' };

    case 'RETRY':
      return {
        ...state,
        status: 'idle',
        errorMessage: null,
        recoverable: true,
      };

    case 'RESET':
      return initialState(crypto.randomUUID());

    case 'FORCE_NEXT_TURN':
      return { ...state, status: 'idle' };

    default:
      return state;
  }
}

// ─── Hook ───

export function useInterviewMachine() {
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const [state, dispatch] = useReducer(
    reducer,
    sessionIdRef.current,
    initialState
  );

  // MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audio playback ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Polling ref
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Recording ───

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeType = AUDIO_MIME_TYPE_PREFERENCE.find((t) =>
        MediaRecorder.isTypeSupported(t)
      );

      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
      });

      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        // Stop all tracks to release mic
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.onerror = () => {
        dispatch({ type: 'UPLOAD_ERROR', message: 'Recording failed. Please try again.' });
      };

      recorder.start(100); // Collect chunks every 100ms
      mediaRecorderRef.current = recorder;
      dispatch({ type: 'START_RECORDING' });

      // Safety timeout — auto-stop after max duration
      recordingTimerRef.current = setTimeout(() => {
        if (recorder.state === 'recording') {
          stopRecording();
        }
      }, MAX_RECORDING_DURATION_MS);
    } catch (err) {
      console.error('Mic permission error:', err);
      dispatch({
        type: 'UPLOAD_ERROR',
        message: 'Microphone access denied. Please allow microphone permissions and try again.',
      });
    }
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    dispatch({ type: 'STOP_RECORDING' });

    recorder.onstop = () => {
      // Stop tracks
      // @ts-expect-error — stream exists on recorder in some browsers
      recorder.stream?.getTracks().forEach((t: MediaStreamTrack) => t.stop());

      const chunks = audioChunksRef.current;
      if (chunks.length === 0) {
        dispatch({ type: 'UPLOAD_ERROR', message: 'No audio captured. Please try again.' });
        return;
      }

      const mimeType = recorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(chunks, { type: mimeType });

      // Kick off upload
      handleUpload(audioBlob);
    };

    recorder.stop();
  }, []);

  // ─── Upload & Transcription ───

  const handleUpload = useCallback(async (audioBlob: Blob) => {
    dispatch({ type: 'UPLOAD_START' });

    try {
      const result = await transcribeAudio(audioBlob, state.sessionId);
      dispatch({ type: 'UPLOAD_SUCCESS', transcript: result.transcript });
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? UI_COPY.error[err.code as keyof typeof UI_COPY.error] || UI_COPY.error.transcription_failed
          : UI_COPY.error.network_error;
      dispatch({ type: 'UPLOAD_ERROR', message });
    }
  }, [state.sessionId]);

  // ─── Interview Turn ───

  const handleInterviewTurn = useCallback(async () => {
    if (!state.currentTranscript) return;

    dispatch({ type: 'PROCESSING_START' });

    try {
      const result = await sendInterviewTurn({
        session_id: state.sessionId,
        transcript: state.currentTranscript,
        history: state.history,
      });

      dispatch({
        type: 'PROCESSING_SUCCESS',
        data: {
          next_question: result.next_question,
          slots_filled: result.slots_filled,
          red_flag_detected: result.red_flag_detected,
          recommend_emergency: result.recommend_emergency,
          turns_used: result.turns_used,
          done: result.done,
        },
      });
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? UI_COPY.error[err.code as keyof typeof UI_COPY.error] || UI_COPY.error.default
          : UI_COPY.error.network_error;
      dispatch({ type: 'PROCESSING_ERROR', message });
    }
  }, [state.sessionId, state.currentTranscript, state.history]);

  // ─── TTS Playback ───

  const playTTS = useCallback(async (text: string) => {
    dispatch({ type: 'TTS_START', text });

    try {
      const audioBlob = await synthesizeSpeech(text);

      if (!audioBlob) {
        // TTS unavailable — show text briefly then continue
        setTimeout(() => {
          dispatch({ type: 'TTS_ENDED' });
        }, 2000);
        return;
      }

      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;

      const cleanup = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      audio.onended = () => {
        cleanup();
        dispatch({ type: 'TTS_ENDED' });
      };

      audio.onerror = () => {
        cleanup();
        dispatch({ type: 'TTS_ERROR', message: 'Audio playback failed' });
      };

      // Safety timeout
      const safetyTimeout = setTimeout(() => {
        if (audioRef.current === audio) {
          audio.pause();
          cleanup();
          dispatch({ type: 'TTS_ENDED' });
        }
      }, 30000);

      audio.onended = () => {
        clearTimeout(safetyTimeout);
        cleanup();
        dispatch({ type: 'TTS_ENDED' });
      };

      await audio.play();
    } catch {
      // Fallback: show text for 2 seconds then continue
      setTimeout(() => {
        dispatch({ type: 'TTS_ENDED' });
      }, 2000);
    }
  }, []);

  // ─── Report Generation ───

  const handleGenerateReport = useCallback(async () => {
    if (!state.chiefComplaint) {
      dispatch({ type: 'GENERATE_REPORT_ERROR', message: 'Missing chief complaint' });
      return;
    }

    dispatch({ type: 'GENERATE_REPORT_START' });

    try {
      const fullTranscript = state.history
        .map((h) => `${h.role}: ${h.text}`)
        .join('\n');

      const result = await generateReport({
        session_id: state.sessionId,
        chief_complaint: state.chiefComplaint,
        full_transcript: fullTranscript,
      });

      dispatch({ type: 'GENERATE_REPORT_SUCCESS', reportId: result.report_id });
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? UI_COPY.error[err.code as keyof typeof UI_COPY.error] || UI_COPY.error.default
          : UI_COPY.error.network_error;
      dispatch({ type: 'GENERATE_REPORT_ERROR', message });
    }
  }, [state.sessionId, state.chiefComplaint, state.history]);

  // ─── Polling ───

  const handlePoll = useCallback(async () => {
    if (!state.reportId) return;

    dispatch({ type: 'POLL_START' });

    try {
      const result = await checkDoctorResponse(state.reportId);

      if (result.responded) {
        dispatch({ type: 'POLL_SUCCESS', response: result });
        // Play TTS for doctor response
        const text = `${result.action}. ${result.note || ''}`;
        playTTS(text);
      } else {
        dispatch({ type: 'POLL_SUCCESS', response: result });
      }
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : UI_COPY.error.network_error;
      dispatch({ type: 'POLL_ERROR', message });
    }
  }, [state.reportId, playTTS]);

  // ─── Effects ───

  // Effect: when status becomes 'processing', trigger interview turn
  useEffect(() => {
    if (state.status === 'processing' && state.currentTranscript) {
      handleInterviewTurn();
    }
  }, [state.status, state.currentTranscript, handleInterviewTurn]);

  // Effect: when status becomes 'playing_tts', play audio
  useEffect(() => {
    if (state.status === 'playing_tts' && state.ttsText) {
      playTTS(state.ttsText);
    }
  }, [state.status, state.ttsText, playTTS]);

  // Effect: when status becomes 'generating_report', generate report
  useEffect(() => {
    if (state.status === 'generating_report') {
      handleGenerateReport();
    }
  }, [state.status, handleGenerateReport]);

  // Effect: when status becomes 'submitted', start polling
  useEffect(() => {
    if (state.status === 'submitted') {
      // First poll after a short delay
      const timer = setTimeout(() => {
        handlePoll();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.status, handlePoll]);

  // Effect: polling loop
  useEffect(() => {
    if (state.status === 'polling' && state.pollAttempts < MAX_POLL_ATTEMPTS) {
      pollTimerRef.current = setTimeout(() => {
        handlePoll();
      }, POLL_INTERVAL_MS);
      return () => {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      };
    }
  }, [state.status, state.pollAttempts, handlePoll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return {
    state,
    startRecording,
    stopRecording,
    retry: () => dispatch({ type: 'RETRY' }),
    reset: () => dispatch({ type: 'RESET' }),
  };
}
