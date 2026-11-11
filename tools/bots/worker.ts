import { playRun, type RunConfig } from './run';
import { strategyNamed } from './strategies';

export type Job = Omit<RunConfig, 'strategy'> & {
  index: number;
  strategy: string;
};

declare const self: Worker;

self.onmessage = (event: MessageEvent<Job>) => {
  const { index, strategy, ...config } = event.data;
  try {
    const record = playRun({ ...config, strategy: strategyNamed(strategy) });
    self.postMessage({ index, record });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
      index
    });
  }
};
