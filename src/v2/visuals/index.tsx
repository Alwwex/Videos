import React from 'react';
import {BarsV, CompareV, CounterV, FormulaV, GaugeV, GraphV, IconV, OutroV, QuizV, StepsV} from './basic';
import {FallV, FieldV, ForcesV, OrbitV, ParticlesV, RaysV, WaveV} from './physics';
import type {VProps} from './common';

/** Vybere komponentu podle typu vizuálu. */
export const Visual: React.FC<VProps> = (p) => {
  const v = p.v;
  switch (v.type) {
    case 'icon':
      return <IconV {...p} v={v} />;
    case 'formula':
      return <FormulaV {...p} v={v} />;
    case 'counter':
      return <CounterV {...p} v={v} />;
    case 'gauge':
      return <GaugeV {...p} v={v} />;
    case 'graph':
      return <GraphV {...p} v={v} />;
    case 'bars':
      return <BarsV {...p} v={v} />;
    case 'compare':
      return <CompareV {...p} v={v} />;
    case 'steps':
      return <StepsV {...p} v={v} />;
    case 'quiz':
      return <QuizV {...p} v={v} />;
    case 'outro':
      return <OutroV {...p} v={v} />;
    case 'forces':
      return <ForcesV {...p} v={v} />;
    case 'wave':
      return <WaveV {...p} v={v} />;
    case 'particles':
      return <ParticlesV {...p} v={v} />;
    case 'orbit':
      return <OrbitV {...p} v={v} />;
    case 'rays':
      return <RaysV {...p} v={v} />;
    case 'field':
      return <FieldV {...p} v={v} />;
    case 'fall':
      return <FallV {...p} v={v} />;
    default:
      return null;
  }
};
