# Apple Pay Domain Verification Setup

This guide explains how to set up Apple Pay domain verification for Tutor Prep.

## File Location

The Apple Pay domain association file is located at:
```
public/.well-known/apple-developer-merchantid-domain-association
```

## Deployment Configuration

### Vercel

The `vercel.json` file is configured to:
1. **Exclude `.well-known` from SPA rewrites** - This ensures the file is served as a static file, not redirected to `index.html`
2. **Set proper headers** - Content-Type: `text/plain`, CORS headers, and caching

### Testing the File

After deployment, verify the file is accessible:

```bash
# Test with curl
curl -I https://tutorprep.co.za/.well-known/apple-developer-merchantid-domain-association

# Should return:
# HTTP/1.1 200 OK
# Content-Type: text/plain
# Access-Control-Allow-Origin: *
```

Or visit directly in your browser:
```
https://tutorprep.co.za/.well-known/apple-developer-merchantid-domain-association
```

The file should display as plain text, not a 404 or HTML page.

## Common Issues

### Issue: "Domain could not be registered"

**Possible causes:**
1. **File not deployed** - Ensure the file exists in the `public/` folder and is included in the build
2. **Rewrite rule blocking** - The `vercel.json` must exclude `.well-known` from rewrites
3. **Wrong Content-Type** - Must be `text/plain`, not `application/json` or `text/html`
4. **File content incorrect** - Verify the file contains the exact content provided by Apple
5. **SSL/HTTPS required** - Apple Pay requires HTTPS

### Solution Steps

1. **Verify file exists in build:**
   ```bash
   npm run build
   ls dist/.well-known/apple-developer-merchantid-domain-association
   ```

2. **Check vercel.json configuration:**
   - Ensure the rewrite rule uses `((?!\\.well-known).*)` to exclude `.well-known`
   - Verify headers are set correctly

3. **Test after deployment:**
   - Wait 5-10 minutes after deployment for DNS/CDN propagation
   - Test the URL directly in browser
   - Check response headers in browser DevTools

4. **Verify file content:**
   - The file should be a single line (no line breaks)
   - Content should match exactly what Apple provided
   - File should not have a `.txt` extension

## File Format

The `apple-developer-merchantid-domain-association` file is:
- A JSON string (may appear as hex-encoded)
- Served as `text/plain` (not `application/json`)
- Must be accessible without authentication
- Must return HTTP 200 status
- Must be served over HTTPS

## Deployment Checklist

- [ ] File exists in `public/.well-known/` folder
- [ ] `vercel.json` excludes `.well-known` from rewrites
- [ ] `vercel.json` sets correct headers (Content-Type: text/plain)
- [ ] File is included in build output (`dist/.well-known/`)
- [ ] File is accessible at `https://yourdomain.com/.well-known/apple-developer-merchantid-domain-association`
- [ ] Returns HTTP 200 (not 404 or 403)
- [ ] Content-Type header is `text/plain`
- [ ] SSL certificate is valid
- [ ] Tested after deployment (wait 5-10 min for propagation)

## Additional Notes

- The file is automatically copied from `public/` to the build root during `npm run build`
- Vercel serves files from the build root, so the file will be at `/.well-known/...` in production
- No server-side code is needed - this is a static file
- The file should never be modified manually - only update if Apple provides a new version
