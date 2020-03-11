# Keys

1. Generate a keypair:

   ```
   openssl genrsa -out private.pem 4096
   openssl rsa -in private.pem -pubout -out public.pem
   ```

2. Store the contents of `private.pem` in GitHub.

   Go to repo **Settings** &rarr; **Secrets** &rarr; **Add a new secret**, and create a secret with the following info:

   - **Name:** `PRIVATE_KEY`
   - **Value:** Contents of private.pem
