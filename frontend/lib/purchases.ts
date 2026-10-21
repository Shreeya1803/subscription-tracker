import { Platform } from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import type { PlanId } from '@/lib/plan';

/**
 * RevenueCat public SDK keys (safe to ship in the app, unlike the backend's secret key).
 * During development set EXPO_PUBLIC_REVENUECAT_TEST_KEY (Test Store, no real money).
 * For store builds set the platform keys and REMOVE the test key: a Test Store key must never ship.
 */
const API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY ||
  (Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY) ||
  '';

export const purchasesAvailable = !!API_KEY && Platform.OS !== 'web';

let configured = false;

/** Links purchases to our own user id, so the backend webhook knows whose plan to change. */
export async function identifyPurchaser(userId: string) {
  if (!purchasesAvailable) return;
  if (!configured) {
    Purchases.configure({ apiKey: API_KEY, appUserID: userId });
    configured = true;
    return;
  }
  await Purchases.logIn(userId);
}

/** Called on sign-out / account deletion so the next person on this phone starts clean. */
export async function resetPurchaser() {
  if (!configured) return;
  try {
    if (!(await Purchases.isAnonymous())) await Purchases.logOut();
  } catch {
    /* already anonymous */
  }
}

export type StorePlan = {
  id: PlanId;
  pkg: PurchasesPackage;
  price: string; // localized, e.g. "A$2.99" or "₹99.00"
  perMonth: string | null; // annual only, e.g. "A$1.92/mo"
  savePercent: number | null; // annual vs paying monthly for a year
};

const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

/** Reads the current offering from RevenueCat; prices come from the store in the buyer's currency. */
export async function loadStorePlans(): Promise<StorePlan[]> {
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  const find = (type: string) => packages.find((p) => p.packageType === type);

  const monthly = find(Purchases.PACKAGE_TYPE.MONTHLY);
  const annual = find(Purchases.PACKAGE_TYPE.ANNUAL);
  const lifetime = find(Purchases.PACKAGE_TYPE.LIFETIME);

  const plans: StorePlan[] = [];
  if (monthly) {
    plans.push({ id: 'monthly', pkg: monthly, price: monthly.product.priceString, perMonth: null, savePercent: null });
  }
  if (annual) {
    const a = annual.product;
    let savePercent: number | null = null;
    if (monthly && monthly.product.currencyCode === a.currencyCode && monthly.product.price > 0) {
      const pct = Math.round((1 - a.price / (monthly.product.price * 12)) * 100);
      savePercent = pct > 0 ? pct : null;
    }
    plans.push({
      id: 'annual',
      pkg: annual,
      price: a.priceString,
      perMonth: `${money(a.price / 12, a.currencyCode)}/mo`,
      savePercent,
    });
  }
  if (lifetime) {
    plans.push({ id: 'lifetime', pkg: lifetime, price: lifetime.product.priceString, perMonth: null, savePercent: null });
  }
  return plans;
}

export function isUserCancelled(e: any) {
  return e?.userCancelled === true || e?.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

export function isAlreadyPurchased(e: any) {
  return e?.code === Purchases.PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR;
}

export const purchasePackage = (pkg: PurchasesPackage) => Purchases.purchasePackage(pkg);
export const restorePurchases = () => Purchases.restorePurchases();