import React from 'react';
import { useGameStore } from './store/useGameStore';
import SetupScreen from './components/SetupScreen/SetupScreen';
import SimulatingScreen from './components/SimulatingScreen/SimulatingScreen';
import PlaybackScreen from './components/PlaybackScreen/PlaybackScreen';
import { loadAllSprites } from './sprites/SpriteRegistry';

loadAllSprites();

export default function App() {
  const phase = useGameStore((s) => s.phase);

  return (
    <div className="w-full min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {phase === 'setup'      && <SetupScreen />}
      {phase === 'simulating' && <SimulatingScreen />}
      {phase === 'playing'    && <PlaybackScreen />}
    </div>
  );
}
