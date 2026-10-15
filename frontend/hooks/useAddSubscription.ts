import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { FREE_ACTIVE_LIMIT } from '@/lib/plan';

/**
 * Use this instead of router.push('/add'). Free accounts that already track the maximum number of
 * active subscriptions are sent to the upgrade screen before they fill in a form.
 * (The server also blocks the request with a 403, so this is a convenience, not the only check.)
 */
export function useAddSubscription() {
  const { user } = useAuth();
  const { subscriptions } = useSubscriptions();
  const activeCount = subscriptions.filter((s) => s.status === 'active').length;
  const atLimit = user?.premiumStatus === 'free' && activeCount >= FREE_ACTIVE_LIMIT;
  const openAdd = () => router.push(atLimit ? '/upgrade' : '/add');
  return { atLimit, activeCount, openAdd };
}