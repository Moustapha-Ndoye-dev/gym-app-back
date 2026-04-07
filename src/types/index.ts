import { Member, Subscription } from '../../prisma/generated-client';

export type MemberWithSubscription = Member & {
  subscription: Subscription | null;
};
