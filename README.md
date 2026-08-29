# ghosttint-theme

## Media library

`media-library.json` catalogs every video/image currently uploaded to Shopify (Settings > Content > Files) for the GhostTint build — filenames, Shopify GIDs, permanent CDN URLs, and which theme section (if any) each one is wired into. It doesn't contain the actual media files, just durable links to them, so it stays lightweight and never goes stale relative to the CDN. Regenerate by querying Shopify Admin GraphQL's `files` field.