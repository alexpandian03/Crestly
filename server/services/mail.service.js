export async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim() || 'PosterAI <onboarding@resend.dev>';

  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Email Service - Dev Mode] To: ${to} | Subject: ${subject}`);
      if (text) {
        console.log(`[Email Content]:\n${text}`);
      }
    }
    return { id: `dev-${Date.now()}`, simulated: true };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data?.message || data?.error?.message || response.statusText;
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[Email Service - Dev Warning] Resend failed (${response.status}): ${errorMsg}. Falling back to dev logger.`);
      console.log(`[Email Service - Dev Mode] To: ${to} | Subject: ${subject}`);
      if (text) {
        console.log(`[Email Content]:\n${text}`);
      }
      return { id: `dev-${Date.now()}`, simulated: true };
    }
    throw new Error(`Resend email failed (${response.status}): ${errorMsg}`);
  }
  return data;
}

function getAppUrl() {
  return (
    process.env.APP_URL?.trim() ||
    process.env.CLIENT_URL?.trim() ||
    'http://localhost:5173'
  ).replace(/\/+$/, '');
}

export async function sendInviteEmail({ email, orgName, rawToken }) {
  const appUrl = getAppUrl();
  const link = `${appUrl}/invite?token=${rawToken}`;
  const subject = orgName ? `Invitation to join ${orgName}` : 'Invitation to join PosterAI';
  const text = `You have been invited to join ${orgName || 'PosterAI'}.\n\nClick the link below to accept your invitation and set up your account:\n${link}\n\nThis invitation link expires in 7 days.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="color: #111827;">You're invited to join ${orgName || 'PosterAI'}</h2>
      <p>You have been invited to access ${orgName || 'the team account'}. Click the button below to set up your password and get started.</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="background-color: #2563EB; color: #FFFFFF; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Accept Invitation</a>
      </p>
      <p style="font-size: 13px; color: #6B7280;">If the button does not work, copy and paste this link into your browser:<br/><a href="${link}" style="color: #2563EB;">${link}</a></p>
      <p style="font-size: 13px; color: #6B7280;">This invitation expires in 7 days.</p>
    </div>
  `;
  return sendEmail({ to: email, subject, text, html });
}

export async function sendPasswordResetEmail({ email, rawToken }) {
  const appUrl = getAppUrl();
  const link = `${appUrl}/reset-password?token=${rawToken}`;
  const subject = 'Reset your PosterAI password';
  const text = `We received a request to reset your PosterAI password.\n\nClick the link below to choose a new password:\n${link}\n\nThis link expires in 30 minutes. If you did not request a password reset, you can safely ignore this email.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="color: #111827;">Reset your password</h2>
      <p>We received a request to reset your PosterAI account password. Click the button below to set a new password:</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="background-color: #2563EB; color: #FFFFFF; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Reset Password</a>
      </p>
      <p style="font-size: 13px; color: #6B7280;">If the button does not work, copy and paste this link into your browser:<br/><a href="${link}" style="color: #2563EB;">${link}</a></p>
      <p style="font-size: 13px; color: #6B7280;">This link expires in 30 minutes. If you did not request this, please disregard this message.</p>
    </div>
  `;
  return sendEmail({ to: email, subject, text, html });
}

export async function sendPasswordChangedEmail({ email }) {
  const subject = 'Your PosterAI password has changed';
  const text = `Your PosterAI account password was recently changed.\n\nIf you performed this action, no further steps are needed.\nIf you did not change your password, please contact your administrator or support immediately.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="color: #111827;">Your password has been changed</h2>
      <p>Your PosterAI account password was just updated successfully.</p>
      <p style="font-size: 13px; color: #DC2626;">If you did not make this change, please contact support or your organization administrator immediately.</p>
    </div>
  `;
  return sendEmail({ to: email, subject, text, html });
}

export async function sendVerificationEmail({ email, rawToken }) {
  const appUrl = getAppUrl();
  const link = `${appUrl}/verify-email?token=${rawToken}`;
  const subject = 'Verify your email address';
  const text = `Please verify your email address for PosterAI by clicking the link below:\n${link}\n\nThis verification link expires in 24 hours.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="color: #111827;">Verify your email address</h2>
      <p>Please confirm your email address to complete your PosterAI account setup:</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="background-color: #2563EB; color: #FFFFFF; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Verify Email</a>
      </p>
      <p style="font-size: 13px; color: #6B7280;">If the button does not work, copy and paste this link into your browser:<br/><a href="${link}" style="color: #2563EB;">${link}</a></p>
      <p style="font-size: 13px; color: #6B7280;">This link expires in 24 hours.</p>
    </div>
  `;
  return sendEmail({ to: email, subject, text, html });
}

export async function sendEmailChangeConfirmation({ newEmail, rawToken }) {
  const appUrl = getAppUrl();
  const link = `${appUrl}/confirm-email?token=${rawToken}`;
  const subject = 'Confirm your new email address';
  const text = `Please click the link below to confirm this new email address for your PosterAI account:\n${link}\n\nThis link expires in 24 hours.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="color: #111827;">Confirm your new email</h2>
      <p>A request was made to update your PosterAI email address to this one. Click below to confirm:</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="background-color: #2563EB; color: #FFFFFF; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">Confirm Email Address</a>
      </p>
      <p style="font-size: 13px; color: #6B7280;">If the button does not work, copy and paste this link into your browser:<br/><a href="${link}" style="color: #2563EB;">${link}</a></p>
      <p style="font-size: 13px; color: #6B7280;">This link expires in 24 hours.</p>
    </div>
  `;
  return sendEmail({ to: newEmail, subject, text, html });
}

export async function sendMfaResetEmail({ email, name }) {
  const subject = 'Your multi-factor authentication was reset';
  const text = `Hello ${name || 'there'},\n\nYour multi-factor authentication (MFA) was reset by an administrator.\n\nIf you did not request this, please contact your administrator immediately.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="color: #111827;">MFA reset by administrator</h2>
      <p>Hello ${name || 'there'},</p>
      <p>Your multi-factor authentication (MFA) was reset by an administrator.</p>
      <p style="font-size: 13px; color: #DC2626;">If you did not expect this change, please contact your organization administrator immediately.</p>
    </div>
  `;
  return sendEmail({ to: email, subject, text, html });
}
