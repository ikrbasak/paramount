export type BaseJobData = {
  upstream?: string | number;
};

export type JobRegistry = {
  SampleLog: BaseJobData & {
    content: string;
  };
};
