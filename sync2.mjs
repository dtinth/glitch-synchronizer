// @ts-check

import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'
import { mkdirSync, readFileSync } from 'fs'
import glob from 'glob'
import { basename } from 'path'
import pMemoize from 'p-memoize'
import { execa } from 'execa'
import { execSync } from 'child_process'

process.env.GIT_COMMITTER_NAME = 'dtinth-bot'
process.env.GIT_AUTHOR_NAME = 'dtinth-bot'
process.env.GIT_COMMITTER_EMAIL = 'dtinth-bot@users.noreply.github.com'
process.env.GIT_AUTHOR_EMAIL = 'dtinth-bot@users.noreply.github.com'

mkdirSync('tmp/projects', { recursive: true })

const authConfig = {
  appId: 192741,
  privateKey: process.env.GH_APP_PRIVATE_KEY,
}
const auth = createAppAuth(authConfig)
const gh = new Octokit({
  authStrategy: createAppAuth,
  auth: authConfig,
})

const enhanceError = (extraMessage) => (error) => {
  if (error.message) {
    error.message = `${extraMessage}: ${error.message}`
  }
  if (error.stack) {
    error.stack = `${extraMessage}: ${error.stack}`
  }
  throw error
}

const getAccessToken = pMemoize(async (owner) => {
  const installation = await gh.apps
    .getUserInstallation({ username: owner })
    .catch(enhanceError(`Unable to get installation for "${owner}"`))
  const installationId = installation.data.id
  const installationAuthResult = await auth({
    type: 'installation',
    installationId,
  }).catch(
    enhanceError(`Unable to get installation access token for "${owner}"`),
  )
  const token = installationAuthResult.token
  console.log(`::add-mask::${token}`)
  return token
})

async function run(cmd, { env = {} } = {}) {
  console.log('[run]', cmd)
  await execa(cmd, {
    shell: true,
    stdio: ['ignore', 'inherit', 'inherit'],
    env,
  })
}

async function sync(projectName, targetRepo) {
  console.log(`::group::${projectName}`)
  try {
    const accessToken = await getAccessToken(targetRepo.split('/')[0])
    const gitRepoPath = `tmp/projects/${projectName}-git`
    await run(`rm -rf '${gitRepoPath}'`)
    await run(
      `git clone "https://x-access-token:$GITHUB_TOKEN@github.com/${targetRepo}.git" '${gitRepoPath}'`,
      { env: { GITHUB_TOKEN: accessToken } },
    )
    await run(
      `cd '${gitRepoPath}' && git fetch 'https://api.glitch.com/git/${projectName}' master`,
    )
    const commitTime = (() => {
      try {
        const t = String(
          execSync(`cd '${gitRepoPath}' && git log -1 --format=%cI FETCH_HEAD`),
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
    await run(
      `cd '${gitRepoPath}' && git branch glitch-synchronizer FETCH_HEAD`,
    )
    await run(
      `cd '${gitRepoPath}' && git push origin -f glitch-synchronizer:refs/heads/glitch`,
    )
    await run(
      `cd '${gitRepoPath}' && git merge --no-ff glitch-synchronizer -m 'Updates from Glitch${commitTime}'`,
    )
    await run(`cd '${gitRepoPath}' && git push`)
  } finally {
    console.log(`::endgroup::`)
  }
}

const files = glob.sync('./projects/*.config.json')
for (const configFile of files) {
  const projectName = basename(configFile, '.config.json')
  try {
    const config = JSON.parse(
      readFileSync(new URL(configFile, import.meta.url), 'utf8'),
    )
    await sync(projectName, config.targetRepo)
  } catch (e) {
    console.error(e)
  }
}
