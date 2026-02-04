# Deployment Guide for Tutor Prep

This guide will help you prepare and deploy Tutor Prep to a production domain.

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Supabase Configuration
# Get these from your Supabase project settings: https://app.supabase.com/project/_/settings/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Application URL (REQUIRED for production)
# Set this to your production domain (e.g., https://tutorprep.co.za)
# This is used for password reset emails and other redirects
# DO NOT include a trailing slash
# Leave empty for development (will use window.location.origin)
VITE_APP_URL=https://tutorprep.co.za

# Google Generative AI (for content generation)
# Get this from: https://makersuite.google.com/app/apikey
VITE_GOOGLE_GENERATIVE_AI_API_KEY=your-api-key-here
```

## Critical: Supabase Configuration

### 1. Configure Site URL in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Add your production domain to **Site URL**: `https://tutorprep.co.za`
4. Add redirect URLs:
   - `https://tutorprep.co.za/reset-password`
   - `https://tutorprep.co.za/**` (wildcard for all routes)

### 2. Configure Email Templates

1. Go to **Authentication** → **Email Templates**
2. Update the **Reset Password** template to use your domain
3. Ensure the reset link uses: `{{ .SiteURL }}/reset-password#access_token={{ .Token }}&type=recovery`

### 3. Configure RLS Policies

Ensure all Row Level Security (RLS) policies are properly configured for production. Test that:
- Users can only access their own data
- Admins can access admin features
- Public routes (like contact form) work correctly

## Building for Production

```bash
# Install dependencies
npm install

# Build for production
npm run build

# The build output will be in the `dist/` directory
```

## Deployment Checklist

- [ ] Set `VITE_APP_URL` to your production domain
- [ ] Configure Supabase Site URL
- [ ] Configure Supabase redirect URLs
- [ ] Test password reset flow
- [ ] Test email verification (if enabled)
- [ ] Verify all API endpoints work
- [ ] Check CORS settings in Supabase
- [ ] Test on mobile devices
- [ ] Verify SSL certificate is active
- [ ] Set up error monitoring (optional)
- [ ] Configure CDN for static assets (optional)

## Testing Password Reset

1. Go to `/forgot-password`
2. Enter a valid email
3. Check email inbox for reset link
4. Click the link - it should redirect to `https://yourdomain.com/reset-password`
5. Set a new password
6. Verify you can log in with the new password

## Common Issues

### Password Reset Links Don't Work

- Verify `VITE_APP_URL` is set correctly (no trailing slash)
- Check Supabase redirect URLs include your domain
- Ensure Supabase Site URL matches your domain

### CORS Errors

- Add your domain to Supabase allowed origins
- Check browser console for specific CORS errors

### Environment Variables Not Loading

- Ensure `.env` file is in the root directory
- Restart the dev server after changing `.env`
- For production builds, environment variables are baked in at build time

## Production Build

The application uses Vite, which bakes environment variables into the build at compile time. This means:

1. Set all environment variables BEFORE running `npm run build`
2. The `dist/` folder contains the production-ready files
3. Deploy the `dist/` folder to your hosting provider

## Recommended Hosting Providers

- **Vercel**: Excellent for React apps, automatic SSL, easy deployment
- **Netlify**: Great for static sites, easy CI/CD
- **Cloudflare Pages**: Fast CDN, free SSL
- **AWS S3 + CloudFront**: Scalable, enterprise-grade

## Security Considerations

1. Never commit `.env` files to version control
2. Use environment variables for all sensitive data
3. Enable HTTPS/SSL in production
4. Configure proper CORS policies
5. Regularly update dependencies
6. Monitor Supabase usage and set up alerts
