export type Vec3 = [number, number, number];

export type CameraShot = {
  /** Pozice a cíl kamery na začátku scény */
  from: {position: Vec3; target: Vec3};
  /** Pozice a cíl kamery na konci scény (kamera se mezi nimi pomalu pohybuje) */
  to: {position: Vec3; target: Vec3};
  /** Vertikální zorný úhel ve stupních */
  fov: number;
};

export type Effects = {
  /** Fotony letící ze Slunce na panely */
  photons?: boolean;
  /** Panely jemně září */
  panelGlow?: boolean;
  /** Elektrony (stejnosměrný proud) z panelů do střídače */
  dcCurrent?: boolean;
  /** Střídavý proud ze střídače do domu */
  acCurrent?: boolean;
  /** Rozsvícená okna */
  lights?: boolean;
};

export type CounterConfig = {
  from: number;
  to: number;
  /** Text za číslem, např. " W" */
  suffix?: string;
  /** Text před číslem */
  prefix?: string;
  /** Popisek pod číslem */
  label: string;
  decimals?: number;
};

export type LabelConfig = {
  emoji: string;
  text: string;
  /** Bod ve 3D světě, na který štítek ukazuje */
  target: Vec3;
  /** Posun štítku od bodu v pixelech [x, y] */
  offset: [number, number];
  /** Zpoždění objevení ve snímcích od začátku scény */
  delay?: number;
};

export type SceneConfig = {
  id: string;
  durationInFrames: number;
  camera: CameraShot;
  effects: Effects;
  /**
   * Titulky – každá položka je 2–4 slova zobrazená najednou.
   * Klíčová slova obal hvězdičkami: "NA *SOLÁRNÍ PANELY*" → žlutě.
   */
  captions: string[];
  counter?: CounterConfig;
  labels: LabelConfig[];
};
