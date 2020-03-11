# glitch-synchronizer [WIP]

Automatically synchronize Glitch projects to GitHub using GitHub Actions.

## Testing the workflow

1. Create a `secrets.js` file:

   ```js
   module.exports = {
     githubToken: '${{ personal access token with `repo:public` scope }}',
   }
   ```

2. Run `node dispatch.js`. It will use GitHub’s API to [dispatch an event to trigger a workflow run](https://developer.github.com/v3/repos/#create-a-repository-dispatch-event).
