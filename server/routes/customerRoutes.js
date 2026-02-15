/**
 * Customer Routes
 * Storefront API for Account Details: profile, update customer, addresses (CRUD + set default).
 * Also includes admin helpers: GET /search, POST /create (used by affiliate approval).
 */

module.exports = (db) => {
  const express = require('express');
  const router = express.Router();
  const {
    getCustomerProfile,
    updateCustomer,
    getCustomerAddresses,
    createCustomerAddress,
    updateCustomerAddress,
    deleteCustomerAddress,
    setDefaultCustomerAddress,
    getCustomerBillingAddresses,
    createCustomerBillingAddress,
    updateCustomerBillingAddress,
    deleteCustomerBillingAddress,
    setDefaultCustomerBillingAddress,
    getCustomerOrders,
    getCustomerOrderById,
    getCustomerPaymentMethods,
    deleteCustomerPaymentMethod
  } = require('../controllers/customerController');
  const { searchCustomerByEmail, createCustomer } = require('../controllers/adminCustomerController');

  router.get('/search', (req, res) => searchCustomerByEmail(req, res, db));
  router.post('/create', (req, res) => createCustomer(req, res, db));

  router.get('/profile', (req, res) => getCustomerProfile(req, res, db));
  router.post('/update', (req, res) => updateCustomer(req, res, db));

  router.get('/orders', (req, res) => getCustomerOrders(req, res, db));
  router.get('/orders/:orderId', (req, res) => getCustomerOrderById(req, res, db));
  router.get('/addresses', (req, res) => getCustomerAddresses(req, res, db));
  router.post('/addresses', (req, res) => createCustomerAddress(req, res, db));
  router.put('/addresses/:addressId', (req, res) => updateCustomerAddress(req, res, db));
  router.delete('/addresses/:addressId', (req, res) => deleteCustomerAddress(req, res, db));
  router.put('/addresses/:addressId/default', (req, res) => setDefaultCustomerAddress(req, res, db));

  router.get('/billing-addresses', (req, res) => getCustomerBillingAddresses(req, res, db));
  router.post('/billing-addresses', (req, res) => createCustomerBillingAddress(req, res, db));
  router.put('/billing-addresses/:addressId', (req, res) => updateCustomerBillingAddress(req, res, db));
  router.delete('/billing-addresses/:addressId', (req, res) => deleteCustomerBillingAddress(req, res, db));
  router.put('/billing-addresses/:addressId/default', (req, res) => setDefaultCustomerBillingAddress(req, res, db));

  router.get('/payment-methods', (req, res) => getCustomerPaymentMethods(req, res, db));
  router.delete('/payment-methods/:paymentMethodId', (req, res) => deleteCustomerPaymentMethod(req, res, db));

  return router;
};
