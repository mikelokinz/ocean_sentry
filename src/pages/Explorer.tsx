import { useRef, useEffect, useState, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Starfield } from '../components/scene/Starfield';
import { RealisticEarth } from '../components/scene/RealisticEarth';

import { CloudLayer } from '../components/scene/CloudLayer';
import { RealisticAtmosphere } from '../components/scene/RealisticAtmosphere';
import { GlobalWindLayer } from '../components/scene/GlobalWindLayer';
import { OceanCurrents } from '../components/scene/OceanCurrents';
import { DifferenceLayer } from '../components/scene/DifferenceLayer';
import { ObservationMarkers } from '../components/scene/ObservationMarkers';
import { GliderMarkers } from '../components/scene/GliderMarkers';
import { IndiaEEZ } from '../components/scene/IndiaEEZ';
import { SubsurfaceMarkers } from '../components/scene/SubsurfaceMarkers';
import { SubsurfaceEnvironment } from '../components/scene/SubsurfaceEnvironment';
import { CameraController } from '../components/scene/CameraController';
import { CinematicTransitionManager } from '../components/scene/CinematicTransitionManager';
import { StationPanel } from '../components/ui/StationPanel';
import { GroundTruthModal } from '../components/ui/GroundTruthModal';
import { PHAnalyzerModal } from '../components/ui/PHAnalyzerModal';
import { AsciiIngestModal } from '../components/ui/AsciiIngestModal';
import { UnifiedControlDock } from '../components/ui/UnifiedControlDock';
import { ColorLegend } from '../components/ui/ColorLegend';
import { Timeline } from '../components/ui/Timeline';
import { Navigation } from '../components/ui/Navigation';
import { HandControlWidget } from '../components/ui/HandControlWidget';
import { SubsurfaceHUD } from '../components/ui/SubsurfaceHUD';
import { DiveButton } from '../components/ui/DiveButton';
import { WIND_SYSTEMS_CONFIG } from '../components/ui/WindControlPanel';
import type { WindSystemType } from '../components/ui/WindControlPanel';
import { AnomalyDetailPanel } from '../components/ui/AnomalyDetailPanel';
import { IntelligenceSummary } from '../components/ui/IntelligenceSummary';
import { useHandGesture } from '../hooks/useHandGesture';
import { useOceanData } from '../hooks/useOceanData';
import type { Station, OceanLayer, OceanParameter, DepthLevel, CameraStage } from '../types/ocean';
import type { AnomalyRecord } from '../services/oceanApi';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { CinematicTransitionManagerHandle } from '../components/scene/CinematicTransitionManager';
import type { CinematicTransitionState } from '../hooks/useCinematicTransition';
import { LocalOcean3D } from '../components/localocean/LocalOceanScene';
import { HandCrosshair } from '../components/ui/HandCrosshair';
import { X, Cpu, Radio, GitCompare, Layers } from 'lucide-react';

interface ExplorerProps {
  initialStage?: CameraStage;
}

export default function Explorer({ initialStage = 'space' }: ExplorerProps) {
  // Camera / scene stage state
  const [stage, setStage] = useState<CameraStage>(initialStage);
  const [showControls, setShowControls] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [markersVisible, setMarkersVisible] = useState(false);

  // Ocean intelligence state
  const [layer, setLayer] = useState<OceanLayer>('observation');
  const [parameter, setParameter] = useState<OceanParameter>('waveHeight');
  const [depth, setDepth] = useState<DepthLevel>(0);
  const [timeIndex, setTimeIndex] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [isSubsurface, setIsSubsurface] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyRecord | null>(null);
  const [showEEZ, setShowEEZ] = useState(false);
  const [showArgo, setShowArgo] = useState(true);
  const [showGlider, setShowGlider] = useState(true);

  // Local Ocean / Dive state
  const [viewMode, setViewMode] = useState<'global' | 'localOcean'>('global');
  const [exploringStation, setExploringStation] = useState<Station | null>(null);
  const [localOceanDepth, setLocalOceanDepth] = useState<DepthLevel>(0);
  const [transitionOpacity, setTransitionOpacity] = useState(0);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [isGroundTruthOpen, setIsGroundTruthOpen] = useState(false);
  const [groundTruthStation, setGroundTruthStation] = useState<Station | null>(null);
  const [isPHAnalyzerOpen, setIsPHAnalyzerOpen] = useState(false);
  const [phStation, setPhStation] = useState<Station | null>(null);
  const [isIngestOpen, setIsIngestOpen] = useState(false);

  // Wind control state
  const [activeWindSystems, setActiveWindSystems] = useState<Set<WindSystemType>>(
    new Set(WIND_SYSTEMS_CONFIG.map(s => s.id))
  );

  // Ocean data from API (falls back to mock if unavailable)
  const {
    stations: STATIONS, dataSource, isLoading: dataLoading,
    anomalyCount, anomalySummary, deviceInfo,
    depthObservations, depthAnomalies, depthLoading, depthError,
    loadDepthData, clearDepthData, reload,
  } = useOceanData();

  const meanCurrentSpeed = STATIONS.length > 0
    ? STATIONS.reduce((sum, s) => sum + s.currentSpeed, 0) / STATIONS.length
    : undefined;

  const [webglGpu, setWebglGpu] = useState<string>('');

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          setTimeout(() => setWebglGpu(renderer || ''), 0);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    (window as any).__testExploreValid = () => {
      setExploringStation(STATIONS[0]);
      setTransitionOpacity(1);
      setTimeout(() => {
        setViewMode('localOcean');
        setStage('exploration');
        setTimeout(() => setTransitionOpacity(0), 100);
      }, 600);
    };
    return () => {
      delete (window as any).__testExploreValid;
    };
  }, [STATIONS]);


  // Hand gesture control hook
  const hand = useHandGesture();
  // Crosshair hover state ref (mutated by ObservationMarkers raycaster)
  const handHoverRef = useRef<boolean>(false);

  // Cinematic transition ref (bridges R3F scene with React state)
  const cinematicRef = useRef<CinematicTransitionManagerHandle>(null);
  const cameraTargetRef = useRef(new THREE.Vector3(0, 0, 0));

  const [transitionState, setTransitionState] = useState<CinematicTransitionState | null>(null);

  // Orbit controls ref
  const orbitRef = useRef<OrbitControlsImpl>(null!);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sun directional light position
  const sunPosition: [number, number, number] = [12, 5, 8];



  // Cinematic sequence timing
  useEffect(() => {
    const stages: CameraStage[] = ['space', 'earth', 'indianOcean', 'bayOfBengal', 'exploration'];
    const delays = [1200, 3600, 6800, 10500];
    const timers: ReturnType<typeof setTimeout>[] = [];

    stages.forEach((s, i) => {
      if (i === 0) return;
      const t = setTimeout(() => {
        setStage(s);
        if (s === 'indianOcean') {
          setShowControls(true);
        }
        if (s === 'bayOfBengal') {
          setShowParticles(true);
          setMarkersVisible(true);
        }
        if (s === 'exploration') {
          if (orbitRef.current) {
            orbitRef.current.enabled = true;
          }
        }
      }, delays[i - 1]);
      timers.push(t);
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  // Timeline auto playback
  useEffect(() => {
    if (isPlaying) {
      playRef.current = setInterval(() => {
        setTimeIndex((t) => {
          if (t >= 4) {
            setIsPlaying(false);
            return t;
          }
          return t + 1;
        });
      }, 1500);
    } else {
      if (playRef.current) clearInterval(playRef.current);
    }
    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [isPlaying]);

  const handleStationSelect = useCallback((station: Station | null) => {
    setSelectedStation(station);
  }, []);

  const handleDepthChange = useCallback((d: DepthLevel) => {
    setDepth(d);
    if (d > 0) loadDepthData(d);
  }, [loadDepthData]);

  const handleDive = useCallback(() => {
    setIsSubsurface(true);
    setDepth(10);
    loadDepthData(10);
  }, [loadDepthData]);

  const handleReturnToSurface = useCallback(() => {
    setIsSubsurface(false);
    setDepth(0);
    setSelectedAnomaly(null);
    setSelectedStation(null);
    clearDepthData();
  }, [clearDepthData]);

  const handleAnomalySelect = useCallback((anomaly: AnomalyRecord) => {
    setSelectedAnomaly(anomaly);
    setSelectedStation(null);
  }, []);

  const handleTransitionStateChange = useCallback((state: CinematicTransitionState) => {
    setTransitionState(state);
  }, []);

  const handleExploreOcean = useCallback((stationOverride?: Station) => {
    if (!selectedStation && !stationOverride) return;
    const s = (stationOverride && !('nativeEvent' in stationOverride)) ? stationOverride : selectedStation;
    if (!s) return;
    setExploringStation(s);
    setTransitionOpacity(1);
    setTimeout(() => {
      setViewMode('localOcean');
      setStage('exploration');
      setTimeout(() => setTransitionOpacity(0), 100);
    }, 600);
  }, [selectedStation]);

  const handleExitLocalOcean = useCallback(() => {
    setTransitionOpacity(1);
    setTimeout(() => {
      setViewMode('global');
      setExploringStation(null);
      setLocalOceanDepth(0);
      setTimeout(() => setTransitionOpacity(0), 100);
    }, 600);
  }, []);

  const handleOpenGroundTruth = useCallback((stationOverride?: Station | null) => {
    const target = stationOverride || selectedStation || STATIONS.find((s) => s.id === 'IND-ESP32-01') || STATIONS[0] || null;
    setGroundTruthStation(target);
    setIsGroundTruthOpen(true);
  }, [selectedStation, STATIONS]);

  const handleOpenPHAnalyzer = useCallback((stationOverride?: Station | null) => {
    const target = stationOverride || selectedStation || STATIONS.find((s) => s.id === 'BOB-014') || STATIONS[0] || null;
    setPhStation(target);
    setIsPHAnalyzerOpen(true);
  }, [selectedStation, STATIONS]);
  // Hook up new gesture events
  useEffect(() => {
    hand.onCloseEvent(() => {
      if (viewMode === 'localOcean') {
        handleExitLocalOcean();
      } else if (isSubsurface) {
        handleReturnToSurface();
      } else if (selectedAnomaly) {
        setSelectedAnomaly(null);
      } else if (selectedStation) {
        setSelectedStation(null);
      }
    });
  }, [hand, viewMode, isSubsurface, selectedAnomaly, selectedStation, handleExitLocalOcean, handleReturnToSurface]);

  useEffect(() => {
    hand.onRecenterEvent(() => {
      if (orbitRef.current) {
        orbitRef.current.target.set(0, 0, 0);
        cameraTargetRef.current.set(0, 0, 0);
      }
      if (selectedStation) setSelectedStation(null);
      if (selectedAnomaly) setSelectedAnomaly(null);
    });
  }, [hand, selectedStation, selectedAnomaly]);

  const isExploring = stage === 'exploration';
  const isTransitioning = transitionState != null && transitionState.effectState !== 'IDLE' && transitionState.effectState !== 'COOLDOWN';

  // Compute particle/marker boost from transition
  const particleBoost = transitionState?.particleIntensity ?? 0;
  const effectiveShowParticles = showParticles || particleBoost > 0;
  const effectiveMarkersVisible = markersVisible || (transitionState?.markerVisibility ?? 0) > 0;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000208', overflow: 'hidden' }}>
      {/* THREE.JS WEBGL CANVAS */}
      <Canvas
        camera={{ position: [1.2, 2.0, -15.0], fov: 42, near: 0.1, far: 300 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        dpr={[1, 2]}
        style={{ background: '#000208' }}
      >
        {/* Lighting system calibrated for photorealistic high dynamic range */}
        <ambientLight intensity={0.08} />
        <directionalLight
          position={sunPosition}
          intensity={1.35}
          color="#fffdfa"
          castShadow={false}
        />
        {/* Deep space back-fill light */}
        <pointLight position={[-12, -6, 12]} intensity={0.12} color="#081832" />


        {/* Deep cosmos stars: tiny, glittering pinprick starfield */}
        <Starfield count={3200} />


        {/* Realistic Earth + Atmosphere + Cloud Layer */}
        {viewMode === 'global' && (
          <Suspense fallback={null}>
            <RealisticEarth depth={depth} sunPosition={sunPosition} />
            <CloudLayer depth={depth} sunPosition={sunPosition} />
            <GlobalWindLayer depth={depth} activeSystems={activeWindSystems} />
            <RealisticAtmosphere sunPosition={sunPosition} />
          </Suspense>
        )}

        {/* Ocean current streamlines */}
        {viewMode === 'global' && (
          <OceanCurrents
            visible={effectiveShowParticles}
            parameter={parameter}
            depth={depth}
            meanCurrentSpeed={meanCurrentSpeed}
          />
        )}

        {/* Difference & Anomaly spatial layers */}
        {viewMode === 'global' && (
          <DifferenceLayer
            stations={STATIONS}
            layer={layer}
            parameter={parameter}
            visible={effectiveMarkersVisible}
          />
        )}

        {/* Ocean observation stations & buoys (surface mode) */}
        {viewMode === 'global' && (
          <ObservationMarkers
            stations={STATIONS}
            layer={layer}
            parameter={parameter}
            depth={depth}
            selectedId={selectedStation?.id ?? null}
            visible={effectiveMarkersVisible && !isSubsurface && showArgo}
            onSelect={handleStationSelect}
            onClickEvent={hand.onClickEvent}
            handPointerRef={hand.pointerRef}
            handHoverRef={handHoverRef}
            handHoverTargetRef={hand.hoverTargetRef}
          />
        )}

        {/* Glider observations & trajectories (surface/global mode) */}
        {viewMode === 'global' && (
          <GliderMarkers
            stations={STATIONS}
            layer={layer}
            parameter={parameter}
            depth={depth}
            selectedStation={selectedStation}
            visible={showGlider}
            onSelect={handleStationSelect}
            onHover={(s, _x, _y) => {
              if (s) {
                // Not passing full hand refs to gliders yet, but keep hover signature
              }
            }}
          />
        )}

        {/* India EEZ Overlay */}
        {viewMode === 'global' && (
          <IndiaEEZ visible={showEEZ} />
        )}

        {/* Depth-specific markers (subsurface mode) */}
        {viewMode === 'global' && (
          <SubsurfaceMarkers
            observations={depthObservations}
            anomalies={depthAnomalies}
            depth={depth}
            visible={isSubsurface && !depthLoading}
            onAnomalySelect={handleAnomalySelect}
            selectedAnomalyId={selectedAnomaly ? `${selectedAnomaly.station_id}-${selectedAnomaly.depth}-${selectedAnomaly.timestamp}` : null}
          />
        )}

        {/* Subsurface underwater environment */}
        {viewMode === 'global' && (
          <SubsurfaceEnvironment depth={depth} visible={isSubsurface} />
        )}

        <CameraController
          stage={stage}
          targetStation={selectedAnomaly ? { latitude: selectedAnomaly.latitude, longitude: selectedAnomaly.longitude } : selectedStation}
          isExploring={isExploring}
          handDelta={hand.deltaRot}
          handZoom={hand.zoomFactor}
          currentTargetRef={cameraTargetRef}
          orbitControlsRef={orbitRef}
        />

        {/* Cinematic Transition Manager (effects + camera override) */}
        <CinematicTransitionManager
          ref={cinematicRef}
          currentTargetRef={cameraTargetRef}
          targetLatitude={13.08}
          targetLongitude={80.27}
          onTransitionStateChange={handleTransitionStateChange}
        />

        {/* OrbitControls */}
        {viewMode === 'global' && (
          <OrbitControls
            ref={orbitRef}
            enabled={isExploring && !selectedStation && !selectedAnomaly && !isTransitioning}
            enablePan={false}
            minDistance={2.8}
            maxDistance={14.0}
            rotateSpeed={0.4}
            zoomSpeed={0.6}
            enableDamping
            dampingFactor={0.06}
            makeDefault={false}
          />
        )}

        {/* ═══ LOCAL OCEAN 3D ═══ */}
        {viewMode === 'localOcean' && exploringStation && (
          <LocalOcean3D
            station={exploringStation}
            depth={localOceanDepth}
            layer={layer}
            parameter={parameter}
            handDelta={hand.deltaRot}
            handZoom={hand.zoomFactor}
            numHands={hand.handCount}
            isHandEnabled={hand.isEnabled}
          />
        )}
      </Canvas>

      {/* Cinematic Vignette Overlay to ensure HUD readability over bright ocean */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(circle at center, transparent 40%, rgba(1, 4, 9, 0.75) 100%)',
          zIndex: 1, // Above canvas, below HUD
        }}
      />

      {/* 2D Overlay Elements */}
      
      {/* Top Navigation HUD */}
      <Navigation
        onNavClick={(section) => {
          if (section === 'EXPLORE') {
            if (viewMode === 'localOcean') handleExitLocalOcean();
            if (isSubsurface) handleReturnToSurface();
            setSelectedStation(null);
            setSelectedAnomaly(null);
          } else if (section === 'OBSERVATIONS') {
            setLayer('observation');
            if (viewMode === 'localOcean') handleExitLocalOcean();
            if (isSubsurface) handleReturnToSurface();
            if (STATIONS.length > 0) setSelectedStation(STATIONS[0]);
          } else if (section === 'MODELS') {
            setLayer('model');
            if (viewMode === 'localOcean') handleExitLocalOcean();
            if (isSubsurface) handleReturnToSurface();
          } else if (section === 'ANALYTICS') {
            setLayer('anomaly');
            if (viewMode === 'localOcean') handleExitLocalOcean();
            if (isSubsurface) handleReturnToSurface();
          } else if (section === 'ABOUT') {
            setShowAboutModal(true);
          }
        }}
        anomalyCount={anomalyCount}
        stationCount={STATIONS.length}
        onOpenCompare={() => handleOpenGroundTruth()}
        onOpenPHAnalyzer={() => handleOpenPHAnalyzer()}
        onOpenIngest={() => setIsIngestOpen(true)}
      />



      {/* Anomaly Detail Panel — Top Right (when anomaly selected) */}
      {selectedAnomaly && (
        <AnomalyDetailPanel
          anomaly={selectedAnomaly}
          onClose={() => setSelectedAnomaly(null)}
        />
      )}

      {/* Dive Button — Bottom Center (when at surface and exploring) */}
      {showControls && isExploring && !isSubsurface && (
        <DiveButton
          isSubsurface={false}
          onDive={handleDive}
          onSurface={handleReturnToSurface}
        />
      )}

      {/* Subsurface HUD — Right side when diving */}
      {isSubsurface && (
        <SubsurfaceHUD
          depth={depth}
          observationCount={depthObservations.length}
          anomalyCount={depthAnomalies.length}
          isLoading={depthLoading}
          error={depthError}
          onReturnToSurface={handleReturnToSurface}
          onDepthChange={handleDepthChange}
        />
      )}

      {/* ═══ LEFT SIDEBAR CONTAINER ═══ */}
      {showControls && (
        <div
          style={{
            position: 'absolute',
            left: '18px',
            top: '64px',
            bottom: '80px',
            width: '260px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            zIndex: 30,
            pointerEvents: 'none',
            opacity: showControls ? 1 : 0,
            transition: 'opacity 0.6s ease',
          }}
        >
          {/* ML Intelligence Summary */}
          <div style={{ pointerEvents: 'auto', flexShrink: 0 }}>
            {!isSubsurface && (
              <IntelligenceSummary
                summary={anomalySummary}
                isLoading={dataLoading}
                dataSource={dataSource}
              />
            )}
          </div>

          {/* Tactical Unified Command Deck */}
          <div style={{ pointerEvents: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <UnifiedControlDock
              layer={layer}
              onLayerChange={setLayer}
              parameter={parameter}
              onParameterChange={setParameter}
              depth={viewMode === 'localOcean' ? localOceanDepth : depth}
              onDepthChange={viewMode === 'localOcean' ? setLocalOceanDepth : handleDepthChange}
              activeWindSystems={activeWindSystems}
              onWindChange={setActiveWindSystems}
              onOpenCompare={() => handleOpenGroundTruth()}
              onOpenPHAnalyzer={() => handleOpenPHAnalyzer()}
              showEEZ={showEEZ}
              onEEZChange={setShowEEZ}
              showArgo={showArgo}
              onArgoChange={setShowArgo}
              showGlider={showGlider}
              onGliderChange={setShowGlider}
            />
          </div>

          {/* Color Legend */}
          <div style={{ pointerEvents: 'auto', flexShrink: 0 }}>
            <ColorLegend parameter={parameter} />
          </div>
        </div>
      )}

      {/* Scientific Station Information Panel — Right Side */}
      {(selectedStation || exploringStation) && (
        <div style={{ position: 'absolute', right: '18px', top: '64px', zIndex: 35 }}>
          <StationPanel
            station={exploringStation || selectedStation!}
            parameter={parameter}
            depth={viewMode === 'localOcean' ? localOceanDepth : depth}
            onClose={() => {
              if (viewMode === 'localOcean') handleExitLocalOcean();
              else setSelectedStation(null);
            }}
            onExploreOcean={viewMode === 'global' ? handleExploreOcean : undefined}
            onAnalyzeVariance={handleOpenGroundTruth}
            onOpenPHAnalyzer={handleOpenPHAnalyzer}
          />
        </div>
      )}

      {/* Timeline Controls — Bottom Center */}
      {showControls && (
        <div style={{ position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)', zIndex: 35 }}>
          <Timeline
            timeIndex={timeIndex}
            isPlaying={isPlaying}
            onChange={setTimeIndex}
            onPlayPause={() => setIsPlaying((p) => !p)}
          />
        </div>
      )}

      {/* Hand Gesture Control Widget — Bottom Right */}
      {showControls && (
        <HandControlWidget
          isEnabled={hand.isEnabled}
          onToggle={hand.toggleEnabled}
          status={hand.status}
          gesture={hand.gesture}
          confidence={hand.confidence}
          videoRef={hand.videoRef}
          canvasRef={hand.canvasRef}
        />
      )}

      {/* Hand Gesture Spatial Crosshair */}
      <HandCrosshair
        isEnabled={hand.isEnabled}
        pointerRef={hand.pointerRef}
        hoverRef={handHoverRef}
      />

      {/* Depth Indicator Bar — Right side when depth > 0 (surface mode only) */}
      {depth > 0 && showControls && !isSubsurface && (
        <div
          className="sci-panel animate-fade-in"
          style={{
            position: 'absolute',
            top: '50%',
            right: selectedStation ? '320px' : '18px',
            transform: 'translateY(-50%)',
            zIndex: 25,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            borderRadius: '6px',
            padding: '8px 6px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          <div style={{ fontSize: '7px', color: '#64748b', letterSpacing: '0.15em', fontWeight: 800, fontFamily: 'monospace' }}>
            DEPTH
          </div>
          <div
            style={{
              width: '2px',
              height: '90px',
              background: 'linear-gradient(180deg, rgba(34,211,238,0.8), rgba(34,211,238,0.1))',
              borderRadius: '1px',
              position: 'relative',
            }}
          >
            <div
              className="led-pulse"
              style={{
                position: 'absolute',
                left: '-4px',
                top: `${([0, 10, 50, 100, 500, 1000].indexOf(depth) / 5) * 100}%`,
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#22d3ee',
                boxShadow: '0 0 8px #22d3ee',
                transition: 'top 0.4s ease',
              }}
            />
          </div>
          <div style={{ fontSize: '8.5px', color: '#22d3ee', fontFamily: 'monospace', fontWeight: 700 }}>
            {depth === 0 ? 'SURF' : `${depth}m`}
          </div>
        </div>
      )}

      {/* ═══ TACTICAL SYSTEM TELEMETRY FOOTER ═══ */}
      {showControls && (
        <div
          className="sci-panel"
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '18px',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '4px',
            padding: '4px 10px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(56, 189, 248, 0.15)',
          }}
        >
          <div
            className="led-pulse"
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: dataSource === 'api' ? '#22d3ee' : dataSource === 'loading' ? '#f59e0b' : '#64748b',
              boxShadow: dataSource === 'api' ? '0 0 6px #22d3ee' : 'none',
            }}
          />
          <span style={{ fontSize: '7.5px', color: '#94a3b8', letterSpacing: '0.12em', fontFamily: 'monospace', fontWeight: 600 }}>
            {dataLoading
              ? 'CONNECTING...'
              : dataSource === 'api'
              ? 'INCOIS DATA GRID + ARGO · ML ONLINE'
              : 'OFFLINE DEMO DATA'}
          </span>
          {dataSource === 'api' && (
            <span
              style={{
                fontSize: '7px',
                color: deviceInfo?.device === 'cuda' ? '#10b981' : '#22d3ee',
                letterSpacing: '0.08em',
                fontWeight: 700,
                fontFamily: 'monospace',
                background: deviceInfo?.device === 'cuda' ? 'rgba(16,185,129,0.15)' : 'rgba(34,211,238,0.12)',
                padding: '1px 5px',
                borderRadius: '3px',
                border: `1px solid ${deviceInfo?.device === 'cuda' ? 'rgba(16,185,129,0.35)' : 'rgba(34,211,238,0.25)'}`,
              }}
            >
              {deviceInfo?.device === 'cuda'
                ? `GPU: ${deviceInfo.gpu_name || 'NVIDIA RTX 5060'} (CUDA)`
                : `DEVICE: ${deviceInfo?.device_name || 'AUTOENCODER GPU'}`}
            </span>
          )}
          {webglGpu && (
            <span
              style={{
                fontSize: '7px',
                color: '#38bdf8',
                letterSpacing: '0.06em',
                fontFamily: 'monospace',
                opacity: 0.85,
              }}
            >
              RENDERER: {webglGpu.includes('NVIDIA') ? 'NVIDIA RTX 5060' : webglGpu.includes('Radeon') ? 'AMD RADEON 780M' : 'HARDWARE GPU'}
            </span>
          )}
        </div>
      )}


      {/* Camera Stage Status Indicator during Intro */}
      {stage !== 'exploration' && (
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '9px',
            letterSpacing: '0.24em',
            color: 'rgba(34,211,238,0.6)',
            fontFamily: 'monospace',
            zIndex: 20,
            pointerEvents: 'none',
            background: 'rgba(2,8,22,0.6)',
            padding: '4px 14px',
            borderRadius: '4px',
            border: '1px solid rgba(34,211,238,0.15)',
          }}
        >
          {stage === 'space'       && '● ORBITAL SATELLITE VIEW'}
          {stage === 'earth'       && '● APPROACHING PLANET EARTH'}
          {stage === 'indianOcean' && '● LOCKING TARGET: INDIAN OCEAN BASIN'}
          {stage === 'bayOfBengal' && '● FOCUSING OBSERVATION GRID: BAY OF BENGAL'}
        </div>
      )}
      {/* About Mission & System Architecture Modal */}
      {showAboutModal && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 100,
            background: 'rgba(2, 6, 23, 0.88)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => setShowAboutModal(false)}
        >
          <div
            style={{
              maxWidth: '740px',
              width: '100%',
              background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(9, 14, 26, 0.98) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.22)',
              borderRadius: '16px',
              padding: '28px 32px',
              color: '#e2e8f0',
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05), 0 0 40px -10px rgba(14, 165, 233, 0.15)',
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Institutional Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    background: 'rgba(14, 165, 233, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', letterSpacing: '0.14em', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                      INCOIS · MINISTRY OF EARTH SCIENCES · GOVT. OF INDIA
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                    OPERATIONAL PLATFORM
                  </span>
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                  Ocean Sentry System Architecture
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                  Autonomous In-Situ Profiling, Subsurface Hydrodynamics & Hardware-Accelerated Quality Control
                </p>
              </div>
              <button
                onClick={() => setShowAboutModal(false)}
                title="Close Overview (Esc)"
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.color = '#94a3b8';
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Core Capability Pillars (2x2 Grid) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '22px' }}>
              {/* Card 1: Hardware-Accelerated ML */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(148, 163, 184, 0.14)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Cpu size={18} color="#38bdf8" />
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', fontFamily: 'monospace', letterSpacing: '0.08em', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                      NEURAL INFERENCE & QC
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                      Hardware-Accelerated Anomaly Engine
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.55 }}>
                  Real-time hydrographic anomaly detection utilizing multi-layer autoencoders and Isolation Forest models running low-latency inference on DirectML/GPU.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'auto', paddingTop: '4px' }}>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 7px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.08)', color: '#7dd3fc', border: '1px solid rgba(56, 189, 248, 0.18)' }}>
                    PyTorch Autoencoder
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 7px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.08)', color: '#7dd3fc', border: '1px solid rgba(56, 189, 248, 0.18)' }}>
                    ONNX DirectML
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 7px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.04)', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    {deviceInfo?.device_name || 'GPU DirectML'}
                  </span>
                </div>
              </div>

              {/* Card 2: In-Situ Telemetry */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(148, 163, 184, 0.14)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: 'rgba(52, 211, 153, 0.1)',
                    border: '1px solid rgba(52, 211, 153, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Radio size={18} color="#34d399" />
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', fontFamily: 'monospace', letterSpacing: '0.08em', color: '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>
                      IN-SITU OBSERVATIONS
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                      Argo & Glider Telemetry Array
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.55 }}>
                  Continuous spatial ingestion and tracking of autonomous profiling floats, moored ocean buoys, and underwater glider trajectories across the Indian Ocean basin.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'auto', paddingTop: '4px' }}>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 7px', borderRadius: '4px', background: 'rgba(52, 211, 153, 0.08)', color: '#6ee7b7', border: '1px solid rgba(52, 211, 153, 0.18)' }}>
                    INCOIS Argo Array
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 7px', borderRadius: '4px', background: 'rgba(52, 211, 153, 0.08)', color: '#6ee7b7', border: '1px solid rgba(52, 211, 153, 0.18)' }}>
                    WMO / GTS Feed
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 7px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.04)', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    3.5s Telemetry Cycle
                  </span>
                </div>
              </div>

              {/* Card 3: Hydrodynamic Cross-Validation */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(148, 163, 184, 0.14)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: 'rgba(251, 191, 36, 0.1)',
                    border: '1px solid rgba(251, 191, 36, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <GitCompare size={18} color="#fbbf24" />
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', fontFamily: 'monospace', letterSpacing: '0.08em', color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase' }}>
                      DATA ASSIMILATION & QC
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                      Hydrodynamic Cross-Validation
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.55 }}>
                  Spatiotemporal depth collocation engine validating numerical simulation baselines (INCOIS ROMS/NCODA with CMEMS reanalysis) against empirical in-situ observations.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'auto', paddingTop: '4px' }}>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 7px', borderRadius: '4px', background: 'rgba(251, 191, 36, 0.08)', color: '#fde68a', border: '1px solid rgba(251, 191, 36, 0.18)' }}>
                    INCOIS ROMS / NCODA
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 7px', borderRadius: '4px', background: 'rgba(251, 191, 36, 0.08)', color: '#fde68a', border: '1px solid rgba(251, 191, 36, 0.18)' }}>
                    Variance Matrix
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 7px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.04)', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    0 – 2000m Depth Columns
                  </span>
                </div>
              </div>

              {/* Card 4: Spatial Controls */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(148, 163, 184, 0.14)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: 'rgba(167, 139, 250, 0.1)',
                    border: '1px solid rgba(167, 139, 250, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Layers size={18} color="#a78bfa" />
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', fontFamily: 'monospace', letterSpacing: '0.08em', color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase' }}>
                      OPERATIONAL INTERFACE
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                      Spatial & Vision Navigation
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.55 }}>
                  Touchless natural user interface powered by MediaPipe WebGL 2.0 landmarks for hands-free 3D planetary rotation and volumetric depth exploration in operations rooms.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'auto', paddingTop: '4px' }}>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 7px', borderRadius: '4px', background: 'rgba(167, 139, 250, 0.08)', color: '#ddd6fe', border: '1px solid rgba(167, 139, 250, 0.18)' }}>
                    MediaPipe Vision
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 7px', borderRadius: '4px', background: 'rgba(167, 139, 250, 0.08)', color: '#ddd6fe', border: '1px solid rgba(167, 139, 250, 0.18)' }}>
                    WebGL 2.0 Shaders
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', padding: '2px 7px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.04)', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    Contactless Control
                  </span>
                </div>
              </div>
            </div>

            {/* Operational Telemetry Metrics Strip */}
            <div style={{
              background: 'rgba(8, 14, 28, 0.85)',
              border: '1px solid rgba(56, 189, 248, 0.16)',
              borderRadius: '10px',
              padding: '12px 18px',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              marginBottom: '18px',
            }}>
              <div>
                <div style={{ fontSize: '9.5px', fontFamily: 'monospace', color: '#64748b', letterSpacing: '0.05em' }}>MONITORED ASSETS</div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#38bdf8', marginTop: '2px', fontFamily: 'monospace' }}>
                  {STATIONS.length} Active Stations
                </div>
              </div>
              <div>
                <div style={{ fontSize: '9.5px', fontFamily: 'monospace', color: '#64748b', letterSpacing: '0.05em' }}>QC ANOMALIES</div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#f87171', marginTop: '2px', fontFamily: 'monospace' }}>
                  {anomalyCount} Flagged Records
                </div>
              </div>
              <div>
                <div style={{ fontSize: '9.5px', fontFamily: 'monospace', color: '#64748b', letterSpacing: '0.05em' }}>DATA INGESTION</div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#4ade80', marginTop: '2px', fontFamily: 'monospace' }}>
                  {dataSource.toUpperCase()} · Live Stream
                </div>
              </div>
              <div>
                <div style={{ fontSize: '9.5px', fontFamily: 'monospace', color: '#64748b', letterSpacing: '0.05em' }}>ML ACCELERATION</div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#c084fc', marginTop: '2px', fontFamily: 'monospace' }}>
                  {deviceInfo?.cuda_available || deviceInfo?.device_name ? 'DirectML (Active)' : 'DirectML Ready'}
                </div>
              </div>
            </div>

            {/* Footer Institutional Attribution & Actions */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '6px',
            }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Primary Authority: <span style={{ color: '#94a3b8' }}>Indian National Centre for Ocean Information Services (INCOIS), Hyderabad</span>
              </div>
              <button
                onClick={() => setShowAboutModal(false)}
                style={{
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.28)',
                  borderRadius: '6px',
                  color: '#38bdf8',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '6px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.28)';
                }}
              >
                Close Overview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ground-Truth Validation / Variance Analysis Modal */}
      <GroundTruthModal
        isOpen={isGroundTruthOpen}
        onClose={() => setIsGroundTruthOpen(false)}
        station={groundTruthStation || selectedStation}
        onSelectStation={(st) => {
          setGroundTruthStation(st);
          setSelectedStation(st);
        }}
      />

      {/* Live Ocean Water pH Determination & Acidification Modal */}
      <PHAnalyzerModal
        isOpen={isPHAnalyzerOpen}
        onClose={() => setIsPHAnalyzerOpen(false)}
        initialStation={phStation || selectedStation}
      />

      {/* ASCII / Text Ocean Observation Ingestion Modal */}
      <AsciiIngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onRefreshData={reload}
        onStationIngested={(stId) => {
          reload();
          setTimeout(() => {
            const found = STATIONS.find((s) => s.id === stId);
            if (found) {
              setSelectedStation(found);
            }
          }, 350);
        }}
      />

      {/* Local Ocean Transition Fade Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#000208',
          opacity: transitionOpacity,
          pointerEvents: transitionOpacity > 0 ? 'auto' : 'none',
          transition: 'opacity 0.6s ease',
          zIndex: 90,
        }}
      />
    </div>
  );
}
