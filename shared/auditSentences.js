/**
 * Pure isomorphic helpers for human-readable audit sentences and CSV export.
 * Zero external dependencies. Used on server and client.
 */

export function formatAuditSentence(event) {
  if (!event) return '';

  const actor = event.actorId && typeof event.actorId === 'object' ? event.actorId : null;
  const actorName = actor?.name || event.actorName || (event.actorId ? 'A member' : 'System');
  const meta = event.meta || {};

  switch (event.action) {
    case 'auth.login':
      if (event.result === 'failure') {
        const target = meta.email ? ` for ${meta.email}` : '';
        return `Failed sign-in attempt${target}`;
      }
      return `${actorName} signed in`;

    case 'auth.logout':
      return `${actorName} signed out`;

    case 'auth.session_revoke':
      return `${actorName} signed out a device session`;

    case 'auth.token_reuse':
      return 'Suspicious activity: an expired or rotated session token was reused';

    case 'auth.password_change':
      return `${actorName} changed their password`;

    case 'auth.password_reset':
      if (meta.adminReset) {
        return `${actorName} reset a member password`;
      }
      return `${actorName} reset their password`;

    case 'auth.mfa':
      if (meta.action === 'enabled') return `${actorName} enabled multi-factor authentication`;
      if (meta.action === 'disabled') return `${actorName} disabled multi-factor authentication`;
      return `${actorName} completed multi-factor authentication`;

    case 'auth.mfa_reset': {
      const targetMfaUser = meta.email ? ` for ${meta.email}` : '';
      return `${actorName} reset multi-factor authentication${targetMfaUser}`;
    }

    case 'user.invite': {
      const invitedEmail = meta.email ? ` (${meta.email})` : '';
      return `${actorName} invited a new user${invitedEmail}`;
    }

    case 'user.accept_invite':
      return `${actorName} accepted their invitation and joined the team`;

    case 'user.role_change': {
      const fromRole = meta.from ? ` from ${meta.from}` : '';
      const toRole = meta.to ? ` to ${meta.to}` : '';
      return `${actorName} changed a member role${toRole}${fromRole}`;
    }

    case 'user.deactivate': {
      const deactivatedUser = meta.email ? ` (${meta.email})` : '';
      return `${actorName} deactivated member account${deactivatedUser}`;
    }

    case 'user.delete': {
      const deletedUser = meta.email ? ` (${meta.email})` : '';
      return `${actorName} deleted member account${deletedUser}`;
    }

    case 'client.delete': {
      const deletedOrg = meta.name ? ` "${meta.name}"` : '';
      return `${actorName} deleted organization${deletedOrg}`;
    }

    case 'client.deactivate': {
      const deactOrg = meta.name ? ` "${meta.name}"` : '';
      return `${actorName} deactivated organization${deactOrg}`;
    }

    case 'client.settings_update':
      return `${actorName} updated organization security settings`;

    case 'brandkit.update':
      return `${actorName} updated the brand kit`;

    case 'template.create': {
      const createdName = meta.name ? ` "${meta.name}"` : '';
      return `${actorName} created template${createdName}`;
    }

    case 'template.update': {
      const updatedName = meta.name ? ` "${meta.name}"` : '';
      return `${actorName} updated template${updatedName}`;
    }

    case 'template.delete': {
      const deletedName = meta.name ? ` "${meta.name}"` : '';
      return `${actorName} deleted template${deletedName}`;
    }

    case 'approval.decide': {
      const decision = meta.decision === 'rejected' ? 'rejected' : 'approved';
      return `${actorName} ${decision} a poster design`;
    }

    case 'poster.export': {
      const format = meta.format ? ` as ${String(meta.format).toUpperCase()}` : '';
      return `${actorName} exported a poster${format}`;
    }

    case 'poster.share':
      return `${actorName} created a poster share link`;

    case 'auth.permission_denied':
      return 'Access blocked: repeated unauthorized requests detected';

    default:
      return `${actorName} performed ${event.action}`;
  }
}

function escapeCsvField(val) {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatAuditCsv(events) {
  const headers = [
    'Timestamp',
    'Organization',
    'Actor Name',
    'Actor Email',
    'Action',
    'Result',
    'Activity Description',
    'Target Type',
    'Target ID',
    'IP Hash',
    'Request ID',
  ];

  const rows = (events || []).map((e) => {
    const timestamp = e.createdAt ? new Date(e.createdAt).toISOString() : '';
    const org = e.clientId?.name || '';
    const actor = e.actorId && typeof e.actorId === 'object' ? e.actorId : null;
    const actorName = actor?.name || '';
    const actorEmail = actor?.email || '';
    const action = e.action || '';
    const result = e.result || 'success';
    const description = formatAuditSentence(e);
    const targetType = e.targetType || '';
    const targetId = e.targetId || '';
    const ipHash = e.ipHash || '';
    const requestId = e.requestId || '';

    return [
      escapeCsvField(timestamp),
      escapeCsvField(org),
      escapeCsvField(actorName),
      escapeCsvField(actorEmail),
      escapeCsvField(action),
      escapeCsvField(result),
      escapeCsvField(description),
      escapeCsvField(targetType),
      escapeCsvField(targetId),
      escapeCsvField(ipHash),
      escapeCsvField(requestId),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}
