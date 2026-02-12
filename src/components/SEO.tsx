import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
}

export function SEO({
  title = 'Tutor Prep - South African Learning Platform | Past Papers, Tutoring & Study Notes',
  description = 'Tutor Prep offers Past Papers, Tutoring (Physical & Virtual), and Exam/Study Notes for South African students. Aligned with CAPS & IEB curricula. POPI Act compliant.',
  keywords = 'South African tutoring, CAPS curriculum, IEB curriculum, past papers, exam preparation, study notes, online tutoring, virtual tutoring, South Africa education, Grade 4-12, Mathematics, Physics, exam prep',
  image = '/og-image.jpg',
  url,
  type = 'website',
}: SEOProps) {
  const location = useLocation();
  const currentUrl = url || (typeof window !== 'undefined' ? window.location.origin + location.pathname : '');

  useEffect(() => {
    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
      
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      
      element.setAttribute('content', content);
    };

    // Update title
    document.title = title;

    // Basic meta tags
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);
    updateMetaTag('author', 'Tutor Prep');
    updateMetaTag('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    updateMetaTag('googlebot', 'index, follow');
    updateMetaTag('language', 'English');
    updateMetaTag('revisit-after', '7 days');

    // Open Graph tags
    updateMetaTag('og:title', title, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:image', image, true);
    updateMetaTag('og:url', currentUrl, true);
    updateMetaTag('og:type', type, true);
    updateMetaTag('og:site_name', 'Tutor Prep', true);
    updateMetaTag('og:locale', 'en_ZA', true);

    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', title);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', image);

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', currentUrl);

    // Structured Data (JSON-LD)
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'EducationalOrganization',
      name: 'Tutor Prep',
      description: description,
      url: typeof window !== 'undefined' ? window.location.origin : '',
      logo: typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : '',
      sameAs: [
        // Add social media links when available
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'Customer Service',
        email: 'support@tutorprep.co.za',
        availableLanguage: ['English'],
      },
      areaServed: {
        '@type': 'Country',
        name: 'South Africa',
      },
      educationalCredentialAwarded: 'Certificate',
      offers: {
        '@type': 'Offer',
        name: 'Online Tutoring and Study Resources',
        description: 'Past Papers, Tutoring Services, and Exam/Study Notes for South African students',
      },
    };

    // Remove existing structured data script
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Add new structured data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(structuredData);
    document.head.appendChild(script);
  }, [title, description, keywords, image, currentUrl, type]);

  return null;
}
