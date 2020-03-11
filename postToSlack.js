module.exports = function postToSlack(json) {
  if (!process.env.SLACK_WEBHOOK_URL) {
    console.error(
      'Did not post to Slack because no SLACK_WEBHOOK_URL is set...',
      json,
    )
    return
  }
  try {
    require('child_process').execSync(
      `curl -s -H "Content-Type: application/json" -X POST -d @- "$SLACK_WEBHOOK_URL"`,
      { input: JSON.stringify(json) },
    )
  } catch (e) {
    console.error('Failed to post to Slack...', json)
  }
}

if (require.main === module) {
  module.exports({ text: 'test' })
}
