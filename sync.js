const { execSync } = require('child_process')
const passthru = { stdio: 'inherit' }
const fs = require('fs')
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
      execSync(`git push origin FETCH_HEAD:master`, passthru)
      console.log('')
    } finally {
      delete process.env.GIT_SSH_COMMAND
    }
  } catch (e) {
    console.error('Failed to synchronize project', projectName, e)
  } finally {
    console.log('')
  }
}
