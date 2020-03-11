const { execSync } = require('child_process')
const passthru = { stdio: 'inherit' }
const fs = require('fs')
const postToSlack = require('./postToSlack')
const projectNames = fs
  .readdirSync('projects')
  .map(p => p.match(/^([^]+)\.config\.json$/))
  .filter(m => m)
  .map(m => m[1])

for (const projectName of projectNames) {
  const configPath = `projects/${projectName}.config.json`
  const privateKeyPath = `projects/${projectName}.sshkey`
  const gitRepoPath = `projects/${projectName}.git`
  const encryptionKeyPath = `projects/${projectName}.enckey`
  const encryptedEncryptionKeyPath = `${encryptionKeyPath}.enc`
  const encryptedPrivateKeyPath = `${privateKeyPath}.enc`
  const config = require(fs.realpathSync(configPath))

  console.log('#', projectName)
  try {
    // https://www.czeskis.com/random/openssl-encrypt-file.html
    console.log('Decrypting the encryption key...')
    execSync(
      `openssl rsautl -decrypt -inkey keys/private.pem -in '${encryptedEncryptionKeyPath}' -out '${encryptionKeyPath}'`,
      passthru,
    )
    console.log('')

    console.log('Decrypting the deploy key...')
    execSync(
      `openssl enc -d -aes-256-cbc -md sha256 -in '${encryptedPrivateKeyPath}' -out '${privateKeyPath}' -pass 'file:${encryptionKeyPath}'`,
      passthru,
    )
    execSync(`chmod 600 '${privateKeyPath}'`, passthru)
    console.log('')

    process.env.GIT_SSH_COMMAND = `ssh -i ${privateKeyPath}`
    process.env.GIT_DIR = gitRepoPath
    try {
      console.log('Cleaning up Git directory...')
      execSync(`rm -rf '${gitRepoPath}'`, passthru)
      console.log('')

      console.log('Cloning Git repository...')
      execSync(
        `git clone --bare 'git@github.com:${config.targetRepo}' '${gitRepoPath}'`,
        passthru,
      )
      console.log('')

      console.log('Fetching from Glitch...')
      execSync(
        `git fetch 'https://api.glitch.com/git/${projectName}' master`,
        passthru,
      )
      console.log('')

      console.log('Pushing back to GitHub...')
      const thisRepo = process.env.GITHUB_REPOSITORY
      const runId = process.env.GITHUB_RUN_ID
      const branch = config.targetBranch || 'master'
      try {
        execSync(`git push origin FETCH_HEAD:refs/heads/${branch}`, passthru)
        execSync(`git push origin -f FETCH_HEAD:refs/heads/glitch`, passthru)
      } catch (error) {
        try {
          console.error(error)
          execSync(`git push origin -f FETCH_HEAD:refs/heads/glitch`, passthru)
          postToSlack({
            text:
              `[glitch-synchronizer] ` +
              `Failed to synchronize Glitch project "${projectName}". ` +
              `I pushed the Glitch project to the branch "glitch", ` +
              `please open a PR here: ` +
              `https://github.com/${config.targetRepo}/compare/${branch}...glitch`,
          })
        } catch (error_) {
          console.error(error_)
          postToSlack({
            text:
              `[glitch-synchronizer] ` +
              `Failed to synchronize Glitch project "${projectName}" ` +
              `and cannot push to "glitch" branch either... ` +
              `Please check out the workflow run for more info: ` +
              `https://github.com/${thisRepo}/actions/runs/${runId}`,
          })
          throw error_
        }
        throw error
      }
      console.log('')
    } finally {
      delete process.env.GIT_SSH_COMMAND
    }
  } catch (e) {
    console.error('Failed to synchronize project', projectName, e)
    process.exitCode = 1
  } finally {
    console.log('')
  }
}
