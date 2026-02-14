/**
 * Form Builder Routes
 * API routes for form CRUD operations
 */

const express = require('express');
const router = express.Router();

const {
  getAllForms,
  getFormById,
  createForm,
  updateForm,
  deleteForm,
  duplicateForm,
  updateFormStatus
} = require('../controllers/formController');

const {
  getFormSubmissions,
  getSubmissionById,
  createSubmission,
  deleteSubmission,
  deleteMultipleSubmissions,
  exportSubmissions,
  searchCustomerByEmail,
  createCustomer,
  addTagToCustomer,
  removeTagFromCustomer,
  deleteCustomer,
  approveSubmission,
  rejectSubmission
} = require('../controllers/submissionController');

const {
  getPricingRules,
  getPricingRuleById,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
  searchProducts,
  searchCustomers,
  searchCollections,
  getCustomerTags,
  getProductTags,
  syncPricingRulesMetafields,
  getStorefrontPricingRules,

  verifySegmentAssignment,
  getCustomerSegments,
  assignSegmentToDiscount,
  removeSegmentFromDiscount,
  getDiscountProductsFromShopify,
  updateRuleProducts,
} = require('../controllers/pricingController');

const {
  createAffiliateForm,
  getAffiliateForms,
  getAffiliateFormById,
  updateAffiliateForm,
  deleteAffiliateForm
} = require('../controllers/affiliateFormController');

const {
  createAffiliateFormSubmission,
  getAffiliateFormSubmissions,
  getAffiliateFormSubmissionById,
  deleteAffiliateFormSubmission,
  deleteMultipleAffiliateFormSubmissions,
  approveAffiliateFormSubmission,
  rejectAffiliateFormSubmission,
} = require('../controllers/affiliateFormSubmissonController');

const { upload } = require('../utils/fileUpload');

// Factory function to create routes with db access
const createFormRoutes = (db) => {
  
  // ===== FORM ROUTES =====
  
  // GET /api/forms - Get all forms for a shop
  router.get('/forms', (req, res) => getAllForms(req, res, db));

  // GET /api/forms/:id - Get a single form by ID
  router.get('/forms/:id', (req, res) => getFormById(req, res, db));

  // POST /api/forms - Create a new form
  router.post('/forms', (req, res) => createForm(req, res, db));

  // PUT /api/forms/:id - Update an existing form
  router.put('/forms/:id', (req, res) => updateForm(req, res, db));

  // DELETE /api/forms/:id - Delete a form
  router.delete('/forms/:id', (req, res) => deleteForm(req, res, db));

  // POST /api/forms/:id/duplicate - Duplicate a form
  router.post('/forms/:id/duplicate', (req, res) => duplicateForm(req, res, db));

  // PATCH /api/forms/:id/status - Update form status (publish/unpublish)
  router.patch('/forms/:id/status', (req, res) => updateFormStatus(req, res, db));

  // ===== SUBMISSION ROUTES =====

  // GET /api/forms/:formId/submissions - Get all submissions for a form
  router.get('/forms/:formId/submissions', (req, res) => getFormSubmissions(req, res, db));

  // GET /api/forms/:formId/submissions/export - Export submissions as CSV
  router.get('/forms/:formId/submissions/export', (req, res) => exportSubmissions(req, res, db));

  // GET /api/submissions/:id - Get a single submission by ID
  router.get('/submissions/:id', (req, res) => getSubmissionById(req, res, db));

  // POST /api/forms/:formId/submit - Create a new submission (public endpoint)
  // Use multer middleware to handle file uploads (accepts up to 10 files)
  router.post('/forms/:formId/submit', upload.any(), (req, res) => createSubmission(req, res, db));

  // DELETE /api/submissions/:id - Delete a submission
  router.delete('/submissions/:id', (req, res) => deleteSubmission(req, res, db));

  // POST /api/submissions/delete-multiple - Delete multiple submissions
  router.post('/submissions/delete-multiple', (req, res) => deleteMultipleSubmissions(req, res, db));

  // ===== APPROVAL ROUTES =====

  // GET /api/customers/search - Search for a Shopify customer by email
  router.get('/customers/search', (req, res) => searchCustomerByEmail(req, res, db));

  // POST /api/customers/create - Create a new Shopify customer
  router.post('/customers/create', (req, res) => createCustomer(req, res, db));

  // POST /api/customers/add-tag - Add a tag to a Shopify customer
  router.post('/customers/add-tag', (req, res) => addTagToCustomer(req, res, db));

  // POST /api/customers/remove-tag - Remove a tag from a Shopify customer (e.g. when deleting submission)
  router.post('/customers/remove-tag', (req, res) => removeTagFromCustomer(req, res, db));

  // POST /api/customers/delete - Delete a Shopify customer (e.g. when deleting submission)
  router.post('/customers/delete', (req, res) => deleteCustomer(req, res, db));

  // POST /api/submissions/:id/approve - Approve a submission (optional file attachment for email)
  router.post('/submissions/:id/approve', upload.single('attachment'), (req, res) => approveSubmission(req, res, db));

  // POST /api/submissions/:id/reject - Reject a submission (optional file attachment for email)
  router.post('/submissions/:id/reject', upload.single('attachment'), (req, res) => rejectSubmission(req, res, db));

  // ===== PRICING RULES ROUTES =====
  // IMPORTANT: Register literal paths (customer-segments, sync, storefront, verify-segment) BEFORE
  // parametric /pricing-rules/:id so they are not matched as id = "customer-segments" etc.

  // GET /api/pricing-rules - Get all pricing rules for a shop
  router.get('/pricing-rules', (req, res) => getPricingRules(req, res, db));

  // GET /api/pricing-rules/customer-segments - Get customer segments (must be before :id)
  router.get('/pricing-rules/customer-segments', (req, res) => getCustomerSegments(req, res, db));

  // POST /api/pricing-rules/sync - Manually sync pricing rules to Shopify metafields
  router.post('/pricing-rules/sync', (req, res) => syncPricingRulesMetafields(req, res, db));

  // GET /api/pricing-rules/storefront - Get pricing rules for storefront (app proxy)
  router.get('/pricing-rules/storefront', (req, res) => getStorefrontPricingRules(req, res, db));

  // POST /api/pricing-rules/remove-segment - Remove segment from discount (literal path, before :id)
  router.post('/pricing-rules/remove-segment', (req, res) => removeSegmentFromDiscount(req, res, db));

  // GET /api/pricing-rules/:id - Get a single pricing rule by ID
  router.get('/pricing-rules/:id', (req, res) => getPricingRuleById(req, res, db));

  // POST /api/pricing-rules - Create a new pricing rule
  router.post('/pricing-rules', (req, res) => createPricingRule(req, res, db));

  // PUT /api/pricing-rules/:id - Update an existing pricing rule
  router.put('/pricing-rules/:id', (req, res) => updatePricingRule(req, res, db));

  // DELETE /api/pricing-rules/:id - Delete a pricing rule
  router.delete('/pricing-rules/:id', (req, res) => deletePricingRule(req, res, db));

  // POST /api/pricing-rules/:id/verify-segment - Verify segment assignment
  router.post('/pricing-rules/:id/verify-segment', (req, res) => verifySegmentAssignment(req, res, db));

  // GET /api/pricing-rules/:id/discount-products - Get products on linked discount (for product modal)
  router.get('/pricing-rules/:id/discount-products', (req, res) => getDiscountProductsFromShopify(req, res, db));

  // POST /api/pricing-rules/:id/update-products - Update rule products and sync to discount (for product modal)
  router.post('/pricing-rules/:id/update-products', (req, res) => updateRuleProducts(req, res, db));

  // ===== SHOPIFY SEARCH ROUTES (for pricing) =====

  // GET /api/shopify/products/search - Search products
  router.get('/shopify/products/search', (req, res) => searchProducts(req, res, db));

  // GET /api/shopify/customers/search - Search customers
  router.get('/shopify/customers/search', (req, res) => searchCustomers(req, res, db));

  // GET /api/shopify/collections/search - Search collections
  router.get('/shopify/collections/search', (req, res) => searchCollections(req, res, db));

  // GET /api/shopify/customer-tags - Get all customer tags
  router.get('/shopify/customer-tags', (req, res) => getCustomerTags(req, res, db));

  // GET /api/shopify/product-tags - Get all product tags
  router.get('/shopify/product-tags', (req, res) => getProductTags(req, res, db));


  // ===== AFFILIATE FORM ROUTES =====
  
  // POST /api/affiliate-forms - Create a new affiliate form
  router.post('/affiliate-forms', (req, res) => createAffiliateForm(req, res, db));
  
  // GET /api/affiliate-forms - Get all affiliate forms
  router.get('/affiliate-forms', (req, res) => getAffiliateForms(req, res, db));
  
  // GET /api/affiliate-forms/:id - Get a single affiliate form by ID
  router.get('/affiliate-forms/:id', (req, res) => getAffiliateFormById(req, res, db));
  
  // PUT /api/affiliate-forms/:id - Update an existing affiliate form
  router.put('/affiliate-forms/:id', (req, res) => updateAffiliateForm(req, res, db));
  
  // DELETE /api/affiliate-forms/:id - Delete an affiliate form
  router.delete('/affiliate-forms/:id', (req, res) => deleteAffiliateForm(req, res, db));


   // ===== AFFILIATE FORM SUBMISSION ROUTES =====
    
    // POST /api/affiliate-forms/:formId/submit - Create new submission (public endpoint)
    router.post('/affiliate-forms/:formId/submit', upload.any(), (req, res) => createAffiliateFormSubmission(req, res, db));

    // GET /api/affiliate-forms/:formId/submissions - Get all submissions for a form
    router.get('/affiliate-forms/:formId/submissions', (req, res) => getAffiliateFormSubmissions(req, res, db));

    // GET /api/affiliate-forms/:formId/submissions/:id - Get single submission
    router.get('/affiliate-forms/:formId/submissions/:id', (req, res) => getAffiliateFormSubmissionById(req, res, db));

    // DELETE /api/affiliate-forms/:formId/submissions/:id - Delete single submission
    router.delete('/affiliate-forms/:formId/submissions/:id', (req, res) => deleteAffiliateFormSubmission(req, res, db));

    // POST /api/affiliate-forms/:formId/submissions/delete-multiple - Delete multiple submissions
    router.post('/affiliate-forms/:formId/submissions/delete-multiple', (req, res) => deleteMultipleAffiliateFormSubmissions(req, res, db));

    // POST /api/affiliate-forms/:formId/submissions/:id/approve - Approve submission (optional file attachment for email)
    router.post('/affiliate-forms/:formId/submissions/:id/approve', upload.single('attachment'), (req, res) => approveAffiliateFormSubmission(req, res, db));

    // POST /api/affiliate-forms/:formId/submissions/:id/reject - Reject submission (optional file attachment for email)
    router.post('/affiliate-forms/:formId/submissions/:id/reject', upload.single('attachment'), (req, res) => rejectAffiliateFormSubmission(req, res, db));
    

    // POST /api/discounts/assign-segment - Assign customer segment to discount
    router.post('/discounts/assign-segment', (req, res) => assignSegmentToDiscount(req, res, db));

    // POST /api/discounts/remove-segment - Remove customer segment from discount
    router.post('/discounts/remove-segment', (req, res) => removeSegmentFromDiscount(req, res, db));

  return router;
};

module.exports = createFormRoutes;
