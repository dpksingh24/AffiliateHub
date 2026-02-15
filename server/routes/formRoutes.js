/**
 * API routes: affiliate forms, admin customer (search/create)
 */

const express = require('express');
const router = express.Router();

const { searchCustomerByEmail, createCustomer } = require('../controllers/adminCustomerController');

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

const createFormRoutes = (db) => {

  // ===== ADMIN CUSTOMER (for affiliate submission approval etc.) =====
  router.get('/customers/search', (req, res) => searchCustomerByEmail(req, res, db));
  router.post('/customers/create', (req, res) => createCustomer(req, res, db));

  // ===== AFFILIATE FORM ROUTES =====
  router.post('/affiliate-forms', (req, res) => createAffiliateForm(req, res, db));
  router.get('/affiliate-forms', (req, res) => getAffiliateForms(req, res, db));
  router.get('/affiliate-forms/:id', (req, res) => getAffiliateFormById(req, res, db));
  router.put('/affiliate-forms/:id', (req, res) => updateAffiliateForm(req, res, db));
  router.delete('/affiliate-forms/:id', (req, res) => deleteAffiliateForm(req, res, db));

  // ===== AFFILIATE FORM SUBMISSION ROUTES =====
  router.post('/affiliate-forms/:formId/submit', upload.any(), (req, res) => createAffiliateFormSubmission(req, res, db));
  router.get('/affiliate-forms/:formId/submissions', (req, res) => getAffiliateFormSubmissions(req, res, db));
  router.get('/affiliate-forms/:formId/submissions/:id', (req, res) => getAffiliateFormSubmissionById(req, res, db));
  router.delete('/affiliate-forms/:formId/submissions/:id', (req, res) => deleteAffiliateFormSubmission(req, res, db));
  router.post('/affiliate-forms/:formId/submissions/delete-multiple', (req, res) => deleteMultipleAffiliateFormSubmissions(req, res, db));
  router.post('/affiliate-forms/:formId/submissions/:id/approve', upload.single('attachment'), (req, res) => approveAffiliateFormSubmission(req, res, db));
  router.post('/affiliate-forms/:formId/submissions/:id/reject', upload.single('attachment'), (req, res) => rejectAffiliateFormSubmission(req, res, db));

  return router;
};

module.exports = createFormRoutes;
