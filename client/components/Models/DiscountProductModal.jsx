/**
 * DiscountProductModal – Full "Applies to" block (like the discount page).
 * Applies to: All products | Specific products. Search + Browse. Selected list with remove.
 * Save updates the discount with the selected data.
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Text,
  BlockStack,
  InlineStack,
  Banner,
  Spinner,
  Button,
  Box,
  TextField,
  Checkbox,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Icon,
  ChoiceList,
  Divider,
} from '@shopify/polaris';
import { SearchIcon, ProductIcon } from '@shopify/polaris-icons';
import {
  getDiscountProductsFromShopify,
  updateRuleProducts,
  searchProducts,
} from '../../services/pricingApi';

const APPLIES_TO_OPTIONS = [
  { label: 'All products', value: 'all' },
  { label: 'Specific products', value: 'specific_products' },
];

const DiscountProductModal = ({
  isOpen,
  onClose,
  ruleId,
  discountTitle,
  currentProducts = [],
  currentApplyTo = 'specific_products',
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [appliesTo, setAppliesTo] = useState(['specific_products']);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !ruleId) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getDiscountProductsFromShopify(ruleId);
        const isAll = res.appliesToAll === true;
        setAppliesTo([isAll ? 'all' : 'specific_products']);
        const list = Array.isArray(res?.products) ? res.products : currentProducts;
        setSelectedProducts(list.map((p) => ({ id: p.id, title: p.title || '', handle: p.handle })));
      } catch (err) {
        setError(err.message || 'Could not load discount products');
        setAppliesTo(currentApplyTo === 'all' ? ['all'] : ['specific_products']);
        setSelectedProducts(currentProducts.map((p) => ({ id: p.id, title: p.title || '', handle: p.handle })));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isOpen, ruleId]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await searchProducts(searchQuery);
        setSearchResults(res?.products || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const isSpecificProducts = appliesTo[0] === 'specific_products';

  const toggleProduct = (product) => {
    const exists = selectedProducts.some((p) => p.id === product.id);
    if (exists) {
      setSelectedProducts(selectedProducts.filter((p) => p.id !== product.id));
    } else {
      setSelectedProducts([
        ...selectedProducts,
        { id: product.id, title: product.title || '', handle: product.handle },
      ]);
    }
  };

  const removeProduct = (id) => {
    setSelectedProducts(selectedProducts.filter((p) => p.id !== id));
  };

  const handleConfirm = async () => {
    if (!ruleId) return;
    const productsToSave = isSpecificProducts ? selectedProducts : [];
    console.log('[App] Product selection: save request', { ruleId, count: productsToSave.length, applyTo: isSpecificProducts ? 'specific_products' : 'all', productIds: productsToSave.map((p) => p.id) });
    setSaving(true);
    setError(null);
    try {
      await updateRuleProducts(ruleId, { specificProducts: productsToSave });
      console.log('[App] Product selection: success — updated in app and synced to store discount');
      onConfirm?.(productsToSave, isSpecificProducts ? 'specific_products' : 'all');
      onClose();
    } catch (err) {
      console.error('[App] Product selection: error', err);
      setError(err.message || 'Failed to save. Discount will not be updated.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSearchQuery('');
    setSearchResults([]);
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      limitHeight
      onClose={handleCancel}
      title={`Applies to — ${discountTitle || 'Discount'}`}
      primaryAction={{
        content: 'Save changes',
        onAction: handleConfirm,
        loading: saving,
        disabled: loading,
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: handleCancel,
          disabled: saving,
        },
      ]}
      large
    >
      <Modal.Section>
        <BlockStack gap="400">
          {error && (
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          )}

          {loading ? (
            <Box padding="400">
              <InlineStack align="center" blockAlign="center" gap="300">
                <Spinner size="small" />
                <Text variant="bodySm" tone="subdued">
                  Loading from discount…
                </Text>
              </InlineStack>
            </Box>
          ) : (
            <>
              {/* Full "Applies to" block – same as discount page */}
              <Text variant="headingMd" as="h2">
                Applies to
              </Text>
              <ChoiceList
                title=""
                titleHidden
                choices={APPLIES_TO_OPTIONS}
                selected={appliesTo}
                onChange={setAppliesTo}
              />

              {isSpecificProducts && (
                <>
                  <Divider />
                  <BlockStack gap="300">
                    <TextField
                      label="Search products"
                      prefix={<Icon source={SearchIcon} />}
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={setSearchQuery}
                      autoComplete="off"
                    />
                    <InlineStack gap="200" blockAlign="center">
                      <Button icon={ProductIcon} disabled>
                        Browse
                      </Button>
                      <Text variant="bodySm" tone="subdued">
                        Use Search products above to add products. Remove with the button below.
                      </Text>
                    </InlineStack>
                  </BlockStack>

                  {searchResults.length > 0 && (
                    <BlockStack gap="200">
                      <Text variant="bodySm" fontWeight="semibold">
                        Search results (click to add or remove)
                      </Text>
                      <ResourceList
                        resourceName={{ singular: 'product', plural: 'products' }}
                        items={searchResults}
                        renderItem={(product) => {
                          const isSelected = selectedProducts.some((p) => p.id === product.id);
                          return (
                            <ResourceItem
                              id={product.id}
                              onClick={() => toggleProduct(product)}
                              media={
                                <Thumbnail
                                  source={
                                    product.image ||
                                    'https://cdn.shopify.com/s/files/1/0757/9955/files/placeholder-image.png'
                                  }
                                  alt={product.title}
                                  size="small"
                                />
                              }
                            >
                              <InlineStack align="space-between" blockAlign="center">
                                <Text variant="bodyMd" fontWeight="semibold">
                                  {product.title}
                                </Text>
                                <Checkbox checked={isSelected} onChange={() => {}} />
                              </InlineStack>
                            </ResourceItem>
                          );
                        }}
                      />
                    </BlockStack>
                  )}

                  {searchLoading && (
                    <InlineStack align="center">
                      <Spinner size="small" />
                    </InlineStack>
                  )}

                  {selectedProducts.length > 0 && (
                    <BlockStack gap="200">
                      <Text variant="bodySm" fontWeight="semibold">
                        Selected products ({selectedProducts.length})
                      </Text>
                      <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                        <BlockStack gap="200">
                          {selectedProducts.map((p) => (
                            <InlineStack key={p.id} align="space-between" blockAlign="center" gap="200">
                              <Text variant="bodyMd">{p.title}</Text>
                              <Button
                                size="slim"
                                variant="plain"
                                tone="critical"
                                onClick={() => removeProduct(p.id)}
                                accessibilityLabel={`Remove ${p.title}`}
                              >
                                Remove
                              </Button>
                            </InlineStack>
                          ))}
                        </BlockStack>
                      </Box>
                    </BlockStack>
                  )}

                  {isSpecificProducts && selectedProducts.length === 0 && !searchQuery && (
                    <Text variant="bodySm" tone="subdued">
                      No products selected. Use search or Browse to add products.
                    </Text>
                  )}
                </>
              )}

              {!isSpecificProducts && (
                <Text variant="bodySm" tone="subdued">
                  This discount will apply to all products.
                </Text>
              )}
            </>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
};

export default DiscountProductModal;
