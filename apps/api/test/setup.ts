import { afterAll } from 'vitest';
import { disconnectTestPrisma } from './helpers/context';

afterAll(async () => {
  await disconnectTestPrisma();
});
