import { todayUtc, type Clock as DateClock } from '@hyzmat/shared';

export interface Clock extends DateClock {
  now: () => Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
  today: () => todayUtc(),
};
