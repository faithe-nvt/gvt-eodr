export interface EmailContent {
  subject: string
  preview_text: string
  opening_summary: string
  completed_today: { label: string; description: string }[]
  in_progress: string[]
  for_your_attention?: string
  recommendation?: string
  tomorrow_focus: string[]
  plain_text_body: string
}

export function buildEmailHtml(
  vpName: string,
  submissionDate: string,
  content: EmailContent
): string {
  const firstName = vpName.split(' ')[0]

  const completedItems = content.completed_today.map(item => `
        <li class="task-item done">
          <span class="task-tag">Done</span>
          <span class="task-text"><strong>${escHtml(item.label)}:</strong> ${escHtml(item.description)}</span>
        </li>`).join('')

  const inProgressItems = content.in_progress.map(item => `
        <li class="task-item inprog">
          <span class="task-tag yellow">Active</span>
          <span class="task-text">${escHtml(item)}</span>
        </li>`).join('')

  const tomorrowItems = content.tomorrow_focus.map(item => `
        <li class="task-item tomorrow">
          <span class="task-tag orange">Tomorrow</span>
          <span class="task-text">${escHtml(item)}</span>
        </li>`).join('')

  const attentionSection = content.for_your_attention ? `
    <div class="section">
      <div class="section-header">
        <div class="section-dot dot-yellow"></div>
        <div class="section-title">For Your Attention</div>
      </div>
      <div class="attention-box">${escHtml(content.for_your_attention)}</div>
    </div>` : ''

  const recommendationSection = content.recommendation ? `
    <div class="section">
      <div class="section-header">
        <div class="section-dot dot-orange"></div>
        <div class="section-title">${escHtml(firstName)}'s Recommendation for Your Business</div>
      </div>
      <div class="rec-box">
        <span class="rec-quote-mark">&#8220;</span>${escHtml(content.recommendation)}
      </div>
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(content.subject)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #f0f0ed; font-family: 'DM Sans', sans-serif; color: #0a1a1b; -webkit-font-smoothing: antialiased; }
  .wrapper { max-width: 680px; margin: 0 auto; background: #ffffff; }
  .header { background: #0a1a1b; border-bottom: 4px solid #FF611A; display: flex; align-items: stretch; }
  .logo-col { padding: 16px 20px; display: flex; align-items: center; flex: 0 0 auto; line-height: 0; }
  .logo-col img { width: 130px; height: auto; display: block; vertical-align: bottom; }
  .header-divider { width: 1px; background: #1e3a3c; flex-shrink: 0; margin: 12px 0; }
  .meta-col { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: flex-end; padding: 16px 28px; text-align: right; gap: 3px; }
  .header-label { font-family: 'DM Mono', monospace; font-size: 8px; letter-spacing: 0.2em; text-transform: uppercase; color: #4a9a9b; }
  .header-title { font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: #ffffff; line-height: 1.3; }
  .header-date { font-family: 'DM Mono', monospace; font-size: 9px; color: #EBDB1E; letter-spacing: 0.1em; text-transform: uppercase; }
  .summary-band { background: #075056; padding: 22px 40px; }
  .summary-band p { font-size: 14px; line-height: 1.65; color: #e8f4f4; font-weight: 300; }
  .body { padding: 0 40px 32px; }
  .section { margin-top: 32px; }
  .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid #e8e8e4; }
  .section-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
  .dot-teal { background: #075056; }
  .dot-yellow { background: #EBDB1E; }
  .dot-orange { background: #FF611A; }
  .dot-dark { background: #0a1a1b; }
  .section-title { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #6b7a7b; font-weight: 500; }
  .task-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .task-item { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; background: #f7f7f5; border-left: 3px solid #e8e8e4; border-radius: 0 4px 4px 0; }
  .task-item.done { border-left-color: #075056; }
  .task-item.inprog { border-left-color: #EBDB1E; }
  .task-item.tomorrow { border-left-color: #FF611A; }
  .task-tag { font-family: 'DM Mono', monospace; font-size: 9px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: #ffffff; background: #075056; padding: 2px 7px; border-radius: 2px; white-space: nowrap; margin-top: 1px; flex-shrink: 0; }
  .task-tag.yellow { background: #b8a800; color: #0a1a1b; }
  .task-tag.orange { background: #FF611A; }
  .task-text { font-size: 13px; line-height: 1.55; color: #1a2e2f; }
  .task-text strong { font-weight: 600; color: #075056; }
  .attention-box { background: #fff8e6; border: 1px solid #EBDB1E; border-left: 4px solid #EBDB1E; border-radius: 0 6px 6px 0; padding: 16px 18px; font-size: 13px; line-height: 1.6; color: #2a1f00; }
  .rec-box { background: #fff3ee; border: 1px solid #FF611A; border-left: 4px solid #FF611A; border-radius: 0 6px 6px 0; padding: 16px 18px 16px 20px; font-size: 13px; line-height: 1.6; color: #2a0f00; font-style: italic; }
  .rec-quote-mark { display: inline-block; font-size: 36px; line-height: 1; color: #FF611A; font-style: normal; font-family: Georgia, serif; vertical-align: -10px; margin-right: 4px; }
  .footer { background: #0a1a1b; border-top: 4px solid #FF611A; padding: 16px 28px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .footer-name { font-size: 13px; font-weight: 600; color: #ffffff; margin-bottom: 2px; }
  .footer-role { font-size: 10px; color: #6b9a9b; }
  .footer-brand { font-family: 'DM Mono', monospace; font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: #EBDB1E; margin-bottom: 2px; text-align: right; }
  .footer-note { font-size: 9px; color: #4a6162; text-align: right; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="logo-col">
      <img src="https://www.netavirtualteam.com.au/_next/image?url=%2Fimages%2Flogo-dark.png&w=256&q=75" alt="NVT Logo" width="130">
    </div>
    <div class="header-divider"></div>
    <div class="meta-col">
      <div class="header-label">End of Day Report</div>
      <div class="header-title">${escHtml(vpName)}</div>
      <div class="header-date">${escHtml(submissionDate)}</div>
    </div>
  </div>

  <div class="summary-band">
    <p>${escHtml(content.opening_summary)}</p>
  </div>

  <div class="body">
    <div class="section">
      <div class="section-header">
        <div class="section-dot dot-teal"></div>
        <div class="section-title">Completed Today</div>
      </div>
      <ul class="task-list">${completedItems}</ul>
    </div>

    <div class="section">
      <div class="section-header">
        <div class="section-dot dot-yellow"></div>
        <div class="section-title">In Progress &amp; Next Actions</div>
      </div>
      <ul class="task-list">${inProgressItems}</ul>
    </div>

    ${attentionSection}
    ${recommendationSection}

    <div class="section">
      <div class="section-header">
        <div class="section-dot dot-dark"></div>
        <div class="section-title">Tomorrow's Focus</div>
      </div>
      <ul class="task-list">${tomorrowItems}</ul>
    </div>
  </div>

  <div class="footer">
    <div>
      <div class="footer-name">${escHtml(vpName)}</div>
      <div class="footer-role">Virtual Professional &ndash; NVT</div>
    </div>
    <div>
      <div class="footer-brand">NVT Daily Brief</div>
      <div class="footer-note">Sent via NVT Daily Brief</div>
    </div>
  </div>
</div>
</body>
</html>`
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
