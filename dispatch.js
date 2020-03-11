const repo = require('./config').repo
const token = require('./secrets').githubToken

require('child_process').execSync(
  `curl -X POST -d event_type=sync 'https://api.github.com/repos/${repo}/dispatches?access_token=${token}'`,
  { stdio: 'inherit' },
)
