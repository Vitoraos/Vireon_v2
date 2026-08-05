/**
 * Real-time audio waveform visualization using Web Audio API AnalyserNode.
 * Connects to the MediaRecorder stream to draw actual amplitude data.
 */

import { useRef, useCallback, useEffect } from 'react';

interface WaveformConfig {
  width: number;
  height: number;
  barCount?: number;
  barWidth?: number;
  gap?: number;
  color?: string;
}

export function useWaveform() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);

  const startVisualization = useCallback((stream: MediaStream, config?: WaveformConfig) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Clean up any previous context
    stopVisualization();

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    sourceRef.current = source;
    isActiveRef.current = true;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const {
      width = canvas.width || 300,
      height = canvas.height || 100,
      barCount = 60,
      barWidth = 3,
      gap = 2,
      color = '#2563EB',
    } = config || {};

    // Set canvas size to match display size for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const totalBars = Math.min(barCount, Math.floor(width / (barWidth + gap)));
    const step = Math.floor(bufferLength / totalBars);

    function draw() {
      if (!isActiveRef.current) return;

      animationFrameRef.current = requestAnimationFrame(draw);

      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(dataArray);

      ctx!.clearRect(0, 0, width, height);

      for (let i = 0; i < totalBars; i++) {
        const dataIndex = i * step;
        const value = dataArray[dataIndex];
        // Map 0-255 to -1 to 1, then take absolute amplitude
        const amplitude = Math.abs((value - 128) / 128);
        const barHeight = amplitude * height * 0.8 + height * 0.1; // Min height 10%

        const x = i * (barWidth + gap) + (width - totalBars * (barWidth + gap)) / 2;
        const y = (height - barHeight) / 2;

        // Rounded bars
        ctx!.fillStyle = color;
        ctx!.beginPath();
        ctx!.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        ctx!.fill();
      }
    }

    draw();
  }, []);

  const stopVisualization = useCallback(() => {
    isActiveRef.current = false;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {
        // Ignore
      }
      analyserRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVisualization();
    };
  }, [stopVisualization]);

  return {
    canvasRef,
    startVisualization,
    stopVisualization,
  };
}
