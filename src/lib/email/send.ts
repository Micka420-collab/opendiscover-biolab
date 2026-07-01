import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendMagicLinkEmail(email: string, url: string) {
  if (!resend) {
    console.log('[email/dev] magic link for', email, '→', url);
    return;
  }
  await resend.emails.send({
    from: 'OpenDiscover <login@opendiscover.science>',
    to: email,
    subject: 'Your OpenDiscover sign-in link',
    text: `Click to sign in:\n${url}\n\nThis link expires in 10 minutes.`,
  });
}

export async function sendDiscoveryNotification(args: {
  to: string;
  contributorHandle: string;
  discoveryTitle: string;
  discoveryUrl: string;
  role: 'author' | 'corroborator';
}) {
  if (!resend) {
    console.log('[email/dev] discovery notification', args);
    return;
  }
  const subject =
    args.role === 'author'
      ? `🧬 You triggered a Discovery on OpenDiscover`
      : `🧬 Your submission corroborated a Discovery`;
  await resend.emails.send({
    from: 'OpenDiscover <discoveries@opendiscover.science>',
    to: args.to,
    subject,
    text: `Hi @${args.contributorHandle},\n\nThe discovery engine has just generated a Discovery Card based on your submission${args.role === 'corroborator' ? ' (corroborating role)' : ''}:\n\n"${args.discoveryTitle}"\n\nReview it here: ${args.discoveryUrl}\n\nNext steps: invite peers to replicate, or follow the suggested experiments in the card.`,
  });
}
