const { execSync } = require('child_process')
const passthru = { stdio: 'inherit' }
const fs = require('fs')
const postToSlack = require('./postToSlack')
const projectNames = fs
  .readdirSync('projects')
  .map((p) => p.match(/^([^]+)\.config\.json$/))
  .filter((m) => m)
  .map((m) => m[1])

process.env.GIT_COMMITTER_NAME = 'dtinth-bot'
process.env.GIT_AUTHOR_NAME = 'dtinth-bot'
process.env.GIT_COMMITTER_EMAIL = 'dtinth-bot@users.noreply.github.com'
process.env.GIT_AUTHOR_EMAIL = 'dtinth-bot@users.noreply.github.com'

const here = process.cwd()

for (const projectName of projectNames) {
  const configPath = `projects/${projectName}.config.json`
  const privateKeyPath = `projects/${projectName}.sshkey`
  const gitRepoPath = `projects/${projectName}-git`
  const encryptionKeyPath = `projects/${projectName}.enckey`
  const encryptedEncryptionKeyPath = `${encryptionKeyPath}.enc`
  const encryptedPrivateKeyPath = `${privateKeyPath}.enc`
  const config = require(fs.realpathSync(configPath))

  process.chdir(here)
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

    process.env.GIT_SSH_COMMAND = `ssh -i ${fs.realpathSync(privateKeyPath)}`
    try {
      console.log('Cleaning up Git directory...')
      execSync(`rm -rf '${gitRepoPath}'`, passthru)
      console.log('')

      console.log('Cloning Git repository...')
      execSync(
        `git clone 'git@github.com:${config.targetRepo}' '${gitRepoPath}'`,
        passthru,
      )
      console.log('')

      process.chdir(gitRepoPath)
      try {
        console.log('Fetching from Glitch...')
        execSync(
          `git fetch 'https://api.glitch.com/git/${projectName}' master`,
          passthru,
        )
        const commitTime = (() => {
          try {
            const t = String(
              execSync('git log -1 --format=%cI FETCH_HEAD'),
            ).trim()
            return ' (as of ' + t + ')'
          } catch (err) {
            console.error('Failed to get last commit time', err)
            return ''
          }
        })()
        console.log('Latest commit on Glitch is at', commitTime)
        console.log('')

        console.log('Pushing back to GitHub...')
        const thisRepo = process.env.GITHUB_REPOSITORY
        const runId = process.env.GITHUB_RUN_ID
        const branch = config.targetBranch || 'master'
        try {
          execSync(`git branch glitch-synchronizer FETCH_HEAD`, passthru)
          execSync(
            `git push origin -f glitch-synchronizer:refs/heads/glitch`,
            passthru,
          )
          execSync(
            `git merge --no-ff glitch-synchronizer -m 'Updates from Glitch${commitTime}'`,
            passthru,
          )
          execSync(`git push origin HEAD:refs/heads/${branch}`, passthru)
        } catch (error) {
          try {
            console.error(error)
            const targetRepo = config.targetRepo
            const title = encodeURIComponent(`Updates from Glitch` + commitTime)
            postToSlack({
              text:
                `[glitch-synchronizer] ` +
                `Failed to synchronize Glitch project "${projectName}". ` +
                `I pushed the Glitch project to the branch "glitch", ` +
                `please open a PR here: ` +
                `https://github.com/${targetRepo}/compare/${branch}...glitch?title=${title}`,
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
        process.chdir(here)
      }
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
