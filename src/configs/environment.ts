import dotenv from 'dotenv-flow';

import { logger } from '@/lib/logger';
import { environmentSchema } from '@/validators/schemas/environment';

dotenv.config({ purge_dotenv: true, silent: true });

const result = environmentSchema.safeParse(process.env);

if (result.error) {
  logger.log('error', 'config:env:failed', { issues: result.error.issues });
  // oxlint-disable-next-line unicorn/no-process-exit
  process.exit(1);
}

export const env = result.data;
