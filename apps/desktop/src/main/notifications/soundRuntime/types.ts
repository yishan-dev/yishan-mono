export type SoundPlayer = {
  play: (input: { filePath: string; volume: number }) => Promise<void>;
};

export type PlaySound = (input: { filePath: string; volume: number }) => Promise<void> | void;
