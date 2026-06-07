# PageSpeedLab.io

Static SEO content site for Practical web performance and Core Web Vitals guides for static content sites.

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run check
npm run build
```

## GitHub Pages

1. Push to the `main` branch.
2. Set Pages source to GitHub Actions.
3. The workflow in `.github/workflows/deploy.yml` publishes `dist`.
