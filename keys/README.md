# Keys

1. Generate a keypair:

   ```
   openssl genrsa -out private.pem 4096
   openssl rsa -in private.pem -pubout -out public.pem
   ```

2. Store the contents of `private.pem` in GitHub.
