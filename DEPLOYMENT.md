# Cloudflare deployment

This application is deployed to Cloudflare Workers using OpenNext for Next.js.

- Worker: `rahbord-shushtarr`
- Production branch: `main`
- Build: `npx opennextjs-cloudflare build`
- Deploy: `npx wrangler deploy`

Runtime secrets are managed in Cloudflare Workers Variables & Secrets. Do not commit secret values to this repository.
