export interface EmailContent {
  subject: string
  preview_text: string
  opening_summary: string
  completed_today: {
    label: string
    bullets: string[]
    link?: { text: string; url: string }
  }[]
  in_progress: string[]
  for_your_attention?: string
  recommendation?: string
  tomorrow_focus: string[]
  work_outputs: { text: string; url: string }[]
  plain_text_body: string
}

export interface VPBadges {
  streak: number
  qualityCount: number
}

export function buildEmailHtml(
  vpName: string,
  submissionDate: string,
  content: EmailContent,
  badges?: VPBadges,
  aiScore?: number
): string {
  const firstName = vpName.split(' ')[0]

  const completedItems = content.completed_today.map(item => {
    const bullets = (item.bullets ?? []).map(b => `
              <tr>
                <td style="padding:2px 0 2px 14px;font-size:13px;line-height:1.55;color:#1a2e2f;position:relative;">
                  <span style="color:#9ab0b1;margin-right:6px;">–</span>${escHtml(b)}
                </td>
              </tr>`).join('')

    const linkRow = item.link ? `
            <tr>
              <td style="padding-top:8px;border-top:1px solid #e4e9e9;margin-top:4px;">
                <a href="${escAttr(item.link.url)}" style="font-family:'DM Sans',Arial,sans-serif;font-size:13px;font-weight:700;color:#075056;text-decoration:underline;text-underline-offset:3px;display:inline-block;">
                  ↗ ${escHtml(item.link.text)}
                </a>
              </td>
            </tr>` : ''

    return `
    <tr>
      <td style="padding:0 0 10px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:3px solid #075056;border-radius:0 4px 4px 0;background:#f7f7f5;">
          <tr>
            <td style="padding:12px 14px 4px 14px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;white-space:nowrap;">
                    <span style="font-family:'DM Mono',monospace;font-size:9px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:#ffffff;background:#075056;padding:2px 7px;border-radius:2px;display:inline-block;">Done</span>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:11px;font-weight:600;color:#075056;line-height:1.3;">${escHtml(item.label)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 14px 0 14px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">${bullets}
              </table>
            </td>
          </tr>
          ${linkRow ? `<tr><td style="padding:8px 14px 12px 14px;">${linkRow.trim()}</td></tr>` : `<tr><td style="height:12px;"></td></tr>`}
        </table>
      </td>
    </tr>`
  }).join('')

  const inProgressItems = content.in_progress.map(item => `
    <tr>
      <td style="padding:0 0 8px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:3px solid #EBDB1E;border-radius:0 4px 4px 0;background:#f7f7f5;">
          <tr>
            <td style="padding:10px 14px;vertical-align:top;width:1%;white-space:nowrap;">
              <span style="font-family:'DM Mono',monospace;font-size:9px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:#0a1a1b;background:#b8a800;padding:2px 7px;border-radius:2px;display:inline-block;">Active</span>
            </td>
            <td style="padding:10px 14px 10px 0;vertical-align:top;font-size:13px;line-height:1.5;color:#1a2e2f;">${escHtml(item)}</td>
          </tr>
        </table>
      </td>
    </tr>`).join('')

  const tomorrowItems = content.tomorrow_focus.map(item => `
    <tr>
      <td style="padding:0 0 8px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:3px solid #FF611A;border-radius:0 4px 4px 0;background:#f7f7f5;">
          <tr>
            <td style="padding:10px 14px;vertical-align:top;width:1%;white-space:nowrap;">
              <span style="font-family:'DM Mono',monospace;font-size:9px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:#ffffff;background:#FF611A;padding:2px 7px;border-radius:2px;display:inline-block;">Tomorrow</span>
            </td>
            <td style="padding:10px 14px 10px 0;vertical-align:top;font-size:13px;line-height:1.5;color:#1a2e2f;">${escHtml(item)}</td>
          </tr>
        </table>
      </td>
    </tr>`).join('')

  const attentionSection = content.for_your_attention ? `
              <tr><td style="padding-top:32px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;border-bottom:1px solid #e8e8e4;">
                  <tr>
                    <td style="padding-bottom:10px;vertical-align:middle;width:18px;">
                      <div style="width:8px;height:8px;border-radius:2px;background:#EBDB1E;display:inline-block;"></div>
                    </td>
                    <td style="padding-bottom:10px;vertical-align:middle;">
                      <span style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6b7a7b;font-weight:500;">For Your Attention</span>
                    </td>
                  </tr>
                </table>
                <div style="background:#fff8e6;border:1px solid #EBDB1E;border-left:4px solid #EBDB1E;border-radius:0 6px 6px 0;padding:16px 18px;font-size:13px;line-height:1.6;color:#2a1f00;">
                  ${escHtml(content.for_your_attention)}
                </div>
              </td></tr>` : ''

  const recommendationSection = content.recommendation ? `
              <tr><td style="padding-top:32px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;border-bottom:1px solid #e8e8e4;">
                  <tr>
                    <td style="padding-bottom:10px;vertical-align:middle;width:18px;">
                      <div style="width:8px;height:8px;border-radius:2px;background:#FF611A;display:inline-block;"></div>
                    </td>
                    <td style="padding-bottom:10px;vertical-align:middle;">
                      <span style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6b7a7b;font-weight:500;">${escHtml(firstName)}'s Recommendation for Your Business</span>
                    </td>
                  </tr>
                </table>
                <div style="background:#fff3ee;border:1px solid #FF611A;border-left:4px solid #FF611A;border-radius:0 6px 6px 0;padding:16px 18px 16px 20px;font-size:13px;line-height:1.6;color:#2a0f00;font-style:italic;">
                  <span style="display:inline-block;font-size:36px;line-height:1;color:#FF611A;font-style:normal;font-family:Georgia,serif;vertical-align:-10px;margin-right:4px;">&#8220;</span>${escHtml(content.recommendation)}
                </div>
              </td></tr>` : ''

  const workOutputs = content.work_outputs ?? []
  const workOutputRows = workOutputs.map(link => `
                <tr>
                  <td style="padding:0 0 8px 0;">
                    <a href="${escAttr(link.url)}" style="font-family:'DM Sans',Arial,sans-serif;font-size:13px;font-weight:700;color:#075056;text-decoration:underline;text-underline-offset:3px;display:inline-block;">
                      ↗ ${escHtml(link.text)}
                    </a>
                  </td>
                </tr>`).join('')

  const workOutputsSection = `
              <tr><td style="padding-top:32px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;border-bottom:1px solid #e8e8e4;">
                  <tr>
                    <td style="padding-bottom:10px;vertical-align:middle;width:18px;">
                      <div style="width:8px;height:8px;border-radius:2px;background:#075056;display:inline-block;"></div>
                    </td>
                    <td style="padding-bottom:10px;vertical-align:middle;">
                      <span style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6b7a7b;font-weight:500;">Work Outputs</span>
                    </td>
                  </tr>
                </table>
                ${workOutputs.length > 0
                  ? `<table width="100%" cellpadding="0" cellspacing="0" border="0">${workOutputRows}</table>`
                  : `<p style="font-size:13px;color:#9ab0b1;font-style:italic;">No additional links this report.</p>`
                }
              </td></tr>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(content.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#f0f0ed;font-family:'DM Sans',Arial,sans-serif;color:#0a1a1b;-webkit-font-smoothing:antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding:0;">
      <table width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;background:#ffffff;">

        <!-- HEADER -->
        <tr>
          <td style="background:#0a1a1b;border-bottom:4px solid #FF611A;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:16px 20px;vertical-align:middle;width:160px;">
                  <img src="https://www.netavirtualteam.com.au/_next/image?url=%2Fimages%2Flogo-dark.png&w=256&q=75" alt="NVT Logo" width="130" style="display:block;">
                </td>
                <td style="padding:16px 28px;text-align:right;vertical-align:middle;">
                  <div style="font-family:'DM Mono',monospace;font-size:8px;letter-spacing:0.2em;text-transform:uppercase;color:#4a9a9b;margin-bottom:4px;">End of Day Report</div>
                  <div style="font-family:'DM Mono',monospace;font-size:13px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#ffffff;margin-bottom:4px;">${escHtml(vpName)}</div>
                  <div style="font-family:'DM Mono',monospace;font-size:9px;color:#EBDB1E;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">${escHtml(submissionDate)}</div>
                  <div>
                    ${aiScore != null ? `<span style="display:inline-block;background:#FF611A;color:#ffffff;font-size:9px;font-weight:700;padding:2px 9px;border-radius:20px;font-family:'DM Mono',monospace;letter-spacing:0.06em;margin-right:4px;">AI SCORE ${aiScore}/10</span>` : ''}
                    ${badges && badges.streak >= 2 ? `<span style="display:inline-block;background:rgba(255,255,255,0.12);color:#EBDB1E;font-size:9px;font-weight:600;padding:2px 9px;border-radius:20px;font-family:'DM Mono',monospace;letter-spacing:0.05em;">${badges.streak}-DAY STREAK</span>` : ''}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- SUMMARY -->
        <tr>
          <td style="background:#075056;padding:22px 40px;">
            <p style="font-size:14px;line-height:1.65;color:#e8f4f4;font-weight:300;margin:0;">${escHtml(content.opening_summary)}</p>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:0 40px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">

              <!-- Completed Today -->
              <tr><td style="padding-top:32px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;border-bottom:1px solid #e8e8e4;">
                  <tr>
                    <td style="padding-bottom:10px;vertical-align:middle;width:18px;">
                      <div style="width:8px;height:8px;border-radius:2px;background:#075056;display:inline-block;"></div>
                    </td>
                    <td style="padding-bottom:10px;vertical-align:middle;">
                      <span style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6b7a7b;font-weight:500;">Completed Today</span>
                    </td>
                  </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">${completedItems}</table>
              </td></tr>

              <!-- In Progress -->
              <tr><td style="padding-top:32px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;border-bottom:1px solid #e8e8e4;">
                  <tr>
                    <td style="padding-bottom:10px;vertical-align:middle;width:18px;">
                      <div style="width:8px;height:8px;border-radius:2px;background:#EBDB1E;display:inline-block;"></div>
                    </td>
                    <td style="padding-bottom:10px;vertical-align:middle;">
                      <span style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6b7a7b;font-weight:500;">In Progress &amp; Next Actions</span>
                    </td>
                  </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">${inProgressItems}</table>
              </td></tr>

              ${attentionSection}
              ${recommendationSection}

              <!-- Tomorrow -->
              <tr><td style="padding-top:32px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;border-bottom:1px solid #e8e8e4;">
                  <tr>
                    <td style="padding-bottom:10px;vertical-align:middle;width:18px;">
                      <div style="width:8px;height:8px;border-radius:2px;background:#0a1a1b;display:inline-block;"></div>
                    </td>
                    <td style="padding-bottom:10px;vertical-align:middle;">
                      <span style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6b7a7b;font-weight:500;">Tomorrow's Focus</span>
                    </td>
                  </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">${tomorrowItems}</table>
              </td></tr>

              <!-- Work Outputs (always shown) -->
              ${workOutputsSection}

            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#0a1a1b;border-top:4px solid #FF611A;padding:16px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;">
                  <div style="font-size:13px;font-weight:600;color:#ffffff;margin-bottom:3px;">${escHtml(vpName)}</div>
                  <div style="font-size:10px;color:#6b9a9b;margin-bottom:5px;">Virtual Professional &ndash; NVT</div>
                  ${badges && (badges.streak >= 2 || badges.qualityCount >= 1) ? `
                  <div style="display:inline-block;">
                    ${badges.streak >= 2 ? `<span style="display:inline-block;background:#FF611A;color:#ffffff;font-size:9px;font-weight:600;padding:2px 8px;border-radius:20px;margin-right:4px;font-family:'DM Mono',monospace;letter-spacing:0.05em;">${badges.streak}-DAY STREAK</span>` : ''}
                    ${badges.qualityCount >= 1 ? `<span style="display:inline-block;background:#075056;color:#5CE8C8;font-size:9px;font-weight:600;padding:2px 8px;border-radius:20px;font-family:'DM Mono',monospace;letter-spacing:0.05em;">${badges.qualityCount} QUALITY REPORTS</span>` : ''}
                  </div>` : ''}
                </td>
                <td style="vertical-align:middle;text-align:right;">
                  <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:#EBDB1E;margin-bottom:2px;">NVT Daily Brief</div>
                  <div style="font-size:9px;color:#4a6162;">Sent via NVT Daily Brief</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`
}

function escHtml(str: string | undefined): string {
  return (str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escAttr(str: string | undefined): string {
  return (str ?? '').replace(/"/g, '&quot;')
}
