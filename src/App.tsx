import { useState, lazy, Suspense } from 'react';
import { IntroSequence } from './components/intro/IntroSequence';
import './index.css';

const Explorer = lazy(() => import('./pages/Explorer'));
const GestureLab = lazy(() => import('./pages/GestureLab'));

function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const shouldSkipIntro = urlParams.get('skip_intro') === 'true' || localStorage.getItem('ocean_sentry_skip_intro') === 'true';

  const [introDone, setIntroDone] = useState(shouldSkipIntro);
  const [explorerMounted, setExplorerMounted] = useState(true);

  // Simple path routing for the gesture lab
  const isGestureLab = window.location.pathname === '/gesture-lab';

  if (isGestureLab) {
    return (
      <Suspense fallback={<div style={{ background: '#000', width: '100vw', height: '100vh' }} />}>
        <GestureLab />
      </Suspense>
    );
  }

  // Mount Explorer as soon as intro starts transitioning out
  const handleIntroComplete = () => {
    localStorage.setItem('ocean_sentry_skip_intro', 'true');
    setExplorerMounted(true);
    setIntroDone(true);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#000' }}>
      {/* Always mount the 3D world so it loads in background */}
      {explorerMounted && (
        <div
          style={{
            position: 'absolute', inset: 0,
            opacity: introDone ? 1 : 0,
            transition: 'opacity 1.2s ease',
          }}
        >
          <Suspense fallback={<div style={{ background: '#000', width: '100%', height: '100%' }} />}>
            <Explorer />
          </Suspense>
        </div>
      )}

      {/* Intro overlay — unmount after fully faded */}
      {!introDone && (
        <IntroSequence onComplete={handleIntroComplete} />
      )}
    </div>
  );
}

export default App;
