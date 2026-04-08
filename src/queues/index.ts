import { SampleLogQueue, SampleLogQueueWorker } from '@/queues/sample-log';

export const workers = {
  sampleLog: new SampleLogQueueWorker('SampleLog'),
} as const;

export const queues = {
  sampleLog: new SampleLogQueue('SampleLog'),
} as const;
