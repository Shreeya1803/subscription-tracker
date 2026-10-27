/** Subject, plain text and HTML for the password-reset email, shared by every email provider. */
export function passwordResetEmail(appName: string, resetLink: string) {
  const subject = `Reset your ${appName} password`;
  const text =
    `We received a request to reset your ${appName} password.\n\n` +
    `Open this link to choose a new password (valid for 1 hour):\n${resetLink}\n\n` +
    `If you didn't ask for this, you can ignore this email. Your password won't change.`;
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f5f2;font-family:Arial,Helvetica,sans-serif;color:#1c2b3a">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
    <tr><td>
      <h2 style="margin:0 0 12px;font-size:20px">Reset your password</h2>
      <p style="margin:0 0 20px;line-height:1.5">We received a request to reset your ${appName} password. This link is valid for 1 hour.</p>
      <p style="margin:0 0 24px"><a href="${resetLink}" style="display:inline-block;background:#1c2b3a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold">Choose a new password</a></p>
      <p style="margin:0 0 8px;font-size:13px;color:#5f6b76">If the button doesn't work, copy this link into your browser:</p>
      <p style="margin:0 0 20px;font-size:13px;word-break:break-all"><a href="${resetLink}" style="color:#2f6f5e">${resetLink}</a></p>
      <p style="margin:0;font-size:13px;color:#5f6b76">If you didn't ask for this, you can ignore this email. Your password won't change.</p>
    </td></tr>
  </table></body></html>`;
  return { subject, text, html };
}