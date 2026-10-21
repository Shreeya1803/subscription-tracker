/** Free accounts can track this many ACTIVE subscriptions. The server enforces it too (403). */
export const FREE_ACTIVE_LIMIT = 3;

export type PlanId = 'monthly' | 'annual' | 'lifetime';

/**
 * Plans shown on the upgrade screen. Prices are deliberately not hard-coded here:
 * when purchases go live they come from the App Store / Google Play (localized, correct currency).
 */
export const PLANS: { id: PlanId; title: string; blurb: string }[] = [
  { id: 'monthly', title: 'Monthly', blurb: 'Billed every month. Cancel any time.' },
  { id: 'annual', title: 'Annual', blurb: 'Billed once a year. Cancel any time.' },
  { id: 'lifetime', title: 'Lifetime', blurb: 'One payment, yours to keep.' },
];


/**
 * Fill in the real pages before release. Apple and Google expect Terms and Privacy
 * links on any screen that sells a subscription. Empty strings hide the links.
 */
export const LEGAL = {
  termsUrl: 'https://www.kolhsys.com/support', 
  privacyUrl: 'https://www.kolhsys.com/privacy-policy',
};

/** Where users manage or cancel a subscription (the store handles it, not the app). */
export const MANAGE_SUBSCRIPTION_URL = {
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
};