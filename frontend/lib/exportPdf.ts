import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

// Shape of GET /user/export (see UserService.exportData). Decimals arrive as strings, dates as ISO strings.
type ExportData = {
  exportedAt: string;
  user: { email: string; displayName: string; defaultCurrency: string; premiumStatus: string; createdAt: string };
  subscriptions: {
    id: string;
    name: string;
    amount: string | number;
    currency: string;
    billingCycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
    customCycleDays: number | null;
    nextRenewal: string;
    category: string;
    reminderEnabled: boolean;
    reminderDaysBefore: number;
    lastUsedDate: string | null;
    status: 'active' | 'paused' | 'canceled';
    notes: string | null;
  }[];
  savedEvents: { subscriptionId: string; monthlyAmountSaved: string | number; canceledAt: string }[];
  memberships: { role: string; household?: { name: string } | null }[];
};

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
};

const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : '—');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Same rule as the backend's normalizeToMonthly.
function monthly(amount: number, cycle: string, customDays?: number | null) {
  if (cycle === 'custom') return customDays ? amount * (30.44 / customDays) : 0;
  const f: Record<string, number> = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
  return amount * (f[cycle] ?? 1);
}

export function buildExportHtml(data: ExportData): string {
  const subs = data.subscriptions;
  const active = subs.filter((s) => s.status === 'active');

  // Totals per currency so different currencies are never added together.
  const totals = new Map<string, number>();
  for (const s of active) {
    totals.set(s.currency, (totals.get(s.currency) ?? 0) + monthly(Number(s.amount), s.billingCycle, s.customCycleDays));
  }
  const totalsHtml = [...totals.entries()]
    .map(([cur, m]) => `<tr><td>${esc(cur)}</td><td>${esc(money(m, cur))}</td><td>${esc(money(m * 12, cur))}</td></tr>`)
    .join('');

  const nameById = new Map(subs.map((s) => [s.id, s.name]));

  const subRows = subs
    .map((s) => {
      const cycle = s.billingCycle === 'custom' ? `Every ${s.customCycleDays ?? '?'} days` : cap(s.billingCycle);
      return `<tr>
        <td>${esc(s.name)}${s.notes ? `<div class="note">${esc(s.notes)}</div>` : ''}</td>
        <td class="r">${esc(money(Number(s.amount), s.currency))}</td>
        <td>${esc(cycle)}</td>
        <td>${esc(day(s.nextRenewal))}</td>
        <td>${esc(cap(s.category))}</td>
        <td>${esc(cap(s.status))}</td>
        <td>${s.reminderEnabled ? `${s.reminderDaysBefore}d before` : 'Off'}</td>
      </tr>`;
    })
    .join('');

  const savedRows = data.savedEvents
    .map(
      (e) =>
        `<tr><td>${esc(nameById.get(e.subscriptionId) ?? 'Removed subscription')}</td>
         <td class="r">${esc(money(Number(e.monthlyAmountSaved), data.user.defaultCurrency))}/mo</td>
         <td>${esc(day(e.canceledAt))}</td></tr>`,
    )
    .join('');

  const households = data.memberships
    .map((m) => `<li>${esc(m.household?.name ?? 'Household')} (${esc(m.role)})</li>`)
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  body{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#1c2b3a;margin:28px;font-size:11px}
  h1{font-size:22px;margin:0 0 2px} h2{font-size:14px;margin:22px 0 8px;border-bottom:1px solid #d9dee3;padding-bottom:4px}
  .muted{color:#6b7885} table{width:100%;border-collapse:collapse}
  th{text-align:left;background:#eef2f5;padding:6px;font-size:10px;text-transform:uppercase;letter-spacing:.4px}
  td{padding:6px;border-bottom:1px solid #e6eaee;vertical-align:top} .r{text-align:right;white-space:nowrap}
  .grid td:first-child{width:130px} .note{color:#6b7885;font-size:10px;margin-top:2px} .grid td{border:0;padding:2px 6px 2px 0}
</style></head><body>
  <h1>Subscription Tracker – Data Export</h1>
  <div class="muted">Generated ${esc(data.exportedAt.slice(0, 10))}</div>

  <h2>Account</h2>
  <table class="grid">
    <tr><td class="muted">Name</td><td>${esc(data.user.displayName)}</td></tr>
    <tr><td class="muted">Email</td><td>${esc(data.user.email)}</td></tr>
    <tr><td class="muted">Default currency</td><td>${esc(data.user.defaultCurrency)}</td></tr>
    <tr><td class="muted">Plan</td><td>${esc(cap(data.user.premiumStatus))}</td></tr>
    <tr><td class="muted">Member since</td><td>${esc(day(data.user.createdAt))}</td></tr>
  </table>

  <h2>Spending summary (active subscriptions)</h2>
  ${totals.size ? `<table><tr><th>Currency</th><th>Per month</th><th>Per year</th></tr>${totalsHtml}</table>` : '<div class="muted">No active subscriptions.</div>'}

  <h2>Subscriptions (${subs.length})</h2>
  ${subs.length ? `<table><tr><th>Name</th><th>Amount</th><th>Billing</th><th>Next renewal</th><th>Category</th><th>Status</th><th>Reminder</th></tr>${subRows}</table>` : '<div class="muted">No subscriptions.</div>'}

  ${data.savedEvents.length ? `<h2>Money saved from canceled subscriptions</h2><table><tr><th>Subscription</th><th>Saved</th><th>Canceled on</th></tr>${savedRows}</table>` : ''}
  ${households ? `<h2>Households</h2><ul>${households}</ul>` : ''}
</body></html>`;
}

/** Builds the PDF, gives it a readable file name, and opens the share / save sheet. */

export async function exportAccountPdf(data: ExportData) {
  const { base64 } = await Print.printToFileAsync({ html: buildExportHtml(data), base64: true });
  if (Platform.OS === 'web') return; // browser print dialog handles it
  if (!base64) throw new Error('Could not generate the PDF.');

  const file = new File(Paths.cache, `subscription-tracker-export-${data.exportedAt.slice(0, 10)}.pdf`);
  await Promise.resolve(file.create({ overwrite: true }));
  await Promise.resolve(file.write(base64, { encoding: 'base64' }));

  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Save or share your data export',
  });
}
export type { ExportData };
