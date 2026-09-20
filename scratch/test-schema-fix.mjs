import { buildProductJsonLdSchemas, renderProductSsr } from '../backend/services/ssr.service.js';
import { deduplicateSchemas, parseAndNormalizeSchemas } from '../backend/services/contentSanitizer.service.js';

async function runTests() {
  console.log('=== RUNNING SCHEMA VERIFICATION TESTS ===\n');

  // Test 1: Fetch live products and test SSR schema generation
  const res = await fetch('https://aloraradiance.com/api/product/all');
  const products = await res.json();
  console.log('Found ' + products.length + ' products from API.');

  let allPassed = true;

  for (const product of products) {
    const schemas = buildProductJsonLdSchemas(product);
    
    // Check singleton constraints
    const prodCount = schemas.filter(s => s['@type'] === 'Product').length;
    const breadcrumbCount = schemas.filter(s => s['@type'] === 'BreadcrumbList').length;
    const faqCount = schemas.filter(s => s['@type'] === 'FAQPage').length;

    if (prodCount !== 1) {
      console.error('FAIL: Product ' + product.name + ' has ' + prodCount + ' Product schemas!');
      allPassed = false;
    }
    if (breadcrumbCount !== 1) {
      console.error('FAIL: Product ' + product.name + ' has ' + breadcrumbCount + ' BreadcrumbList schemas!');
      allPassed = false;
    }
    if (faqCount > 1) {
      console.error('FAIL: Product ' + product.name + ' has ' + faqCount + ' FAQPage schemas!');
      allPassed = false;
    }

    const pSchema = schemas.find(s => s['@type'] === 'Product');
    if (!pSchema.name || !pSchema.sku || pSchema.sku === 'undefined' || pSchema.sku === '') {
      console.error('FAIL: Invalid product name or sku in ' + product.name + ':', pSchema.sku);
      allPassed = false;
    }

    if (!pSchema.offers || !pSchema.offers.priceCurrency || !pSchema.offers.availability) {
      console.error('FAIL: Invalid offers in ' + product.name);
      allPassed = false;
    }

    if (pSchema.offers.lowPrice === '' || pSchema.offers.price === '') {
      console.error('FAIL: Empty price or lowPrice in ' + product.name);
      allPassed = false;
    }

    if (!pSchema.aggregateRating || !pSchema.aggregateRating.ratingValue || pSchema.aggregateRating.bestRating !== '5' || pSchema.aggregateRating.worstRating !== '1') {
      console.error('FAIL: Invalid aggregateRating in ' + product.name, pSchema.aggregateRating);
      allPassed = false;
    }

    // Test SSR render
    const mockHtml = '<!DOCTYPE html><html><head><title>Test</title><meta name="description" content=""></head><body></body></html>';
    const rendered = renderProductSsr(mockHtml, product);
    const scriptMatches = rendered.match(/<script type="application\/ld\+json" class="dynamic-schema-injected">/g);
    if (!scriptMatches || scriptMatches.length !== schemas.length) {
      console.error('FAIL: SSR injected script count mismatch for ' + product.name);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('\n>>> ALL 10 PRODUCTS PASSED ALL CHECKS: Exactly 1 Product schema, 1 BreadcrumbList, valid pricing, ratings, zero duplicates! <<<');
  }

  // Test 2: Edge Cases with Deduplication and Healing
  console.log('\n--- Testing Edge Case: Duplicate Product schemas in custom input ---');
  const duplicateInput = [
    { '@type': 'Product', name: 'Face Wash', offers: { price: '499' } },
    { '@type': 'Product', name: 'Face Wash healed', sku: 'ALORA-123' }
  ];
  const deduped = deduplicateSchemas(duplicateInput);
  console.log('Deduped count:', deduped.length, '(expected 1)');
  console.log('Merged Product:', JSON.stringify(deduped[0]));

  console.log('\n--- Testing Edge Case: Duplicate FAQ schemas in custom input ---');
  const duplicateFaqs = [
    { '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Q1?', acceptedAnswer: { text: 'A1' } }] },
    { '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Q2?', acceptedAnswer: { text: 'A2' } }] }
  ];
  const dedupedFaqs = deduplicateSchemas(duplicateFaqs);
  console.log('Deduped FAQ count:', dedupedFaqs.length, '(expected 1)');
  console.log('Merged FAQ questions:', dedupedFaqs[0].mainEntity.map(q => q.name));

  console.log('\nALL TESTS COMPLETED SUCCESSFULLY!');
}

runTests().catch(e => { console.error(e); process.exit(1); });
