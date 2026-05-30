import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';

export default function SimulatingScreen() {
  const teamA = useGameStore((s) => s.teamA);
  const teamB = useGameStore((s) => s.teamB);
  const initialVelocities = useGameStore((s) => s.initialVelocities);
  const setSimulationComplete = useGameStore((s) => s.setSimulationComplete);

  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Simulating fight...');

  useEffect(() => {
    if (!initialVelocities) return;

    const worker = new Worker(
      new URL('../../simulation/simulator.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (e: MessageEvent) => {
      const { type } = e.data;
      if (type === 'progress') {
        setProgress(e.data.pct);
        if (e.data.pct >= 0.99) setStatusText('Encoding video...');
      } else if (type === 'complete') {
        const blob = new Blob([e.data.buffer as ArrayBuffer], { type: 'video/mp4' });
        setSimulationComplete(blob, e.data.vels, e.data.result);
        worker.terminate();
      } else if (type === 'error') {
        console.error('Simulation worker error:', e.data.message);
        worker.terminate();
      }
    };

    worker.onerror = (err) => { console.error('Worker crashed:', err); worker.terminate(); };
    worker.postMessage({ teamA, teamB, initialVelocities, fps: 30, bitrate: 4_000_000 });

    return () => worker.terminate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.round(progress * 100);

  return (
    <div
      className="w-full h-screen flex flex-col items-center justify-center"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="flex flex-col items-center gap-6 px-8" style={{ maxWidth: 480, width: '100%' }}>
        {/* Title */}
        <div className="text-center">
          <p
            className="font-retro text-[28px] mb-2"
            style={{ color: 'var(--color-primary, #01006B)' }}
          >
            BALL BATTLE
          </p>
          <p
            className="font-retro text-[13px]"
            style={{ color: 'var(--color-primary, #01006B)', opacity: 0.55, letterSpacing: '0.12em' }}
          >
            {statusText.toUpperCase()}
          </p>
        </div>

        {/* Fighter matchup */}
        <div
          className="flex items-center gap-4 w-full justify-center"
        >
          <div className="text-center">
            <span style={{ fontSize: 36 }}>{teamA.ball.icon ?? '⚽'}</span>
            <p className="font-retro text-[10px] mt-1" style={{ color: '#E47D79' }}>{teamA.name}</p>
          </div>
          <p className="font-retro text-[12px]" style={{ color: '#01006B44' }}>VS</p>
          <div className="text-center">
            <span style={{ fontSize: 36 }}>{teamB.ball.icon ?? '⚽'}</span>
            <p className="font-retro text-[10px] mt-1" style={{ color: '#4A90E2' }}>{teamB.name}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <div
            style={{
              width: '100%',
              height: 12,
              borderRadius: 6,
              background: 'rgba(1,0,107,0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                borderRadius: 6,
                background: 'linear-gradient(90deg, #E47D79, #4A90E2)',
                transition: 'width 0.15s ease',
              }}
            />
          </div>
          <p
            className="font-retro text-[10px] text-center mt-2"
            style={{ color: 'rgba(1,0,107,0.35)' }}
          >
            {pct}%
          </p>
        </div>
      </div>
    </div>
  );
}
