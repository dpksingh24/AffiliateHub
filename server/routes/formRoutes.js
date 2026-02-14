/**
 * API routes: pricing rules, Shopify search, admin customer search/create
 */

const express = require('express');
const router = express.Router();

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
  getStorefrontPricingRules
} = require('../controllers/pricingController');

const { searchCustomerByEmail, createCustomer } = require('../controllers/adminCustomerController');

// Factory function to create routes with db access
const createFormRoutes = (db) => {

  // ===== ADMIN CUSTOMER (for flows that need Shopify customer lookup/create) =====
  router.get('/customers/search', (req, res) => searchCustomerByEmail(req, res, db));
  router.post('/customers/create', (req, res) => createCustomer(req, res, db));

  // ===== PRICING RULES (literal paths before :id) =====
  router.get('/pricing-rules', (req, res) => getPricingRules(req, res, db));
  router.post('/pricing-rules/sync', (req, res) => syncPricingRulesMetafields(req, res, db));
  router.get('/pricing-rules/storefront', (req, res) => getStorefrontPricingRules(req, res, db));
  router.get('/pricing-rules/:id', (req, res) => getPricingRuleById(req, res, db));
  router.post('/pricing-rules', (req, res) => createPricingRule(req, res, db));
  router.put('/pricing-rules/:id', (req, res) => updatePricingRule(req, res, db));
  router.delete('/pricing-rules/:id', (req, res) => deletePricingRule(req, res, db));

  // ===== SHOPIFY SEARCH (for pricing) =====
  router.get('/shopify/products/search', (req, res) => searchProducts(req, res, db));
  router.get('/shopify/customers/search', (req, res) => searchCustomers(req, res, db));
  router.get('/shopify/collections/search', (req, res) => searchCollections(req, res, db));
  router.get('/shopify/customer-tags', (req, res) => getCustomerTags(req, res, db));
  router.get('/shopify/product-tags', (req, res) => getProductTags(req, res, db));

  return router;
};

module.exports = createFormRoutes;
