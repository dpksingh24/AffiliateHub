import React, { useState, useEffect, useCallback } from 'react'
import DiscountSegmentModal from './Models/DiscountSegmentModal';
import DiscountProductModal from './Models/DiscountProductModal';
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  TextField,
  Box,
  InlineStack,
  BlockStack,
  Frame,
  Badge,
  Icon,
  EmptyState,
  IndexTable,
  Toast,
  Spinner,
  Banner,
  Select,
  Modal,
  TextContainer,
  Tag,
  Thumbnail,
  ResourceList,
  ResourceItem,
  Avatar,
  Autocomplete,
  Checkbox,
  Divider,
  InlineGrid,
  Tabs,
  Tooltip,
  Pagination
} from '@shopify/polaris'
import {
  PlusIcon,
  DeleteIcon,
  EditIcon,
  SearchIcon,
  ProductIcon,
  PersonIcon,
  RefreshIcon,
  CheckCircleIcon,
  HashtagIcon,
  CollectionIcon,
  DiscountIcon,
  CashDollarIcon
} from '@shopify/polaris-icons'
import NavBar from './NavBar'
import {
  getPricingRules,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
  searchProducts,
  searchCustomers,
  searchCollections,
  getCustomerTags,
  getProductTags,
  syncPricingRulesToShopify,

  getShopifyDiscountByRuleId,
} from '../services/pricingApi'

// Selection Card Component for better visual selection
const SelectionCard = ({ title, description, icon, selected, onClick, children, badge }) => (
  <div 
    onClick={onClick}
    style={{
      padding: '16px',
      border: selected ? '2px solid #008060' : '1px solid #e1e3e5',
      borderRadius: '12px',
      cursor: 'pointer',
      backgroundColor: selected ? '#f1f8f5' : '#fff',
      transition: 'all 0.2s ease',
      position: 'relative'
    }}
  >
    <InlineStack gap="300" blockAlign="start">
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        backgroundColor: selected ? '#008060' : '#f6f6f7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon source={icon} tone={selected ? 'base' : 'subdued'} />
      </div>
      <BlockStack gap="100">
        <InlineStack gap="200" blockAlign="center">
          <Text variant="bodyMd" fontWeight="semibold">{title}</Text>
          {badge && <Badge tone="info">{badge}</Badge>}
        </InlineStack>
        <Text variant="bodySm" tone="subdued">{description}</Text>
      </BlockStack>
      {selected && (
        <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
          <Icon source={CheckCircleIcon} tone="success" />
        </div>
      )}
    </InlineStack>
    {selected && children && (
      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e1e3e5' }}>
        {children}
      </div>
    )}
  </div>
)

// Section Header Component
const SectionHeader = ({ icon, title, subtitle, number }) => (
  <InlineStack gap="300" blockAlign="center">
    <div style={{
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      backgroundColor: '#f4f6f8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: '600',
      fontSize: '14px',
      color: '#6d7175'
    }}>
      {number}
    </div>
    <BlockStack gap="050">
      <Text variant="headingMd" as="h3">{title}</Text>
      {subtitle && <Text variant="bodySm" tone="subdued">{subtitle}</Text>}
    </BlockStack>
  </InlineStack>
)

// Summary Item Component
const SummaryItem = ({ label, value, icon }) => (
  <InlineStack gap="200" blockAlign="center">
    {icon && <Icon source={icon} tone="subdued" />}
    <Text variant="bodySm" tone="subdued">{label}:</Text>
    <Text variant="bodySm" fontWeight="medium">{value}</Text>
  </InlineStack>
)

const CustomPricingPage = ({ shop }) => {
  // View state: 'list' or 'editor'
  const [view, setView] = useState('list')
  const [editingRule, setEditingRule] = useState(null)
  
  // List state
  const [pricingRules, setPricingRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)
  const [toastActive, setToastActive] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastError, setToastError] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [deleteModalActive, setDeleteModalActive] = useState(false)
  const [ruleToDelete, setRuleToDelete] = useState(null)
  const [selectedTab, setSelectedTab] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const rulesPerPage = 8
  
  // Editor form state
  const [ruleName, setRuleName] = useState('')
  const [ruleStatus, setRuleStatus] = useState('active')
  const [discountTitle, setDiscountTitle] = useState('')
  
  // Customers
  const [applyToCustomers, setApplyToCustomers] = useState('all')
  const [customerTags, setCustomerTags] = useState([])
  const [customerTagInput, setCustomerTagInput] = useState('')
  const [specificCustomers, setSpecificCustomers] = useState([])
  const [availableCustomerTags, setAvailableCustomerTags] = useState([])
  const [customerTagSuggestions, setCustomerTagSuggestions] = useState([])
  
  // Products
  const [applyToProducts, setApplyToProducts] = useState('all')
  const [specificProducts, setSpecificProducts] = useState([])
  const [collections, setCollections] = useState([])
  const [productTags, setProductTags] = useState([])
  const [productTagInput, setProductTagInput] = useState('')
  const [availableProductTags, setAvailableProductTags] = useState([])
  const [productTagSuggestions, setProductTagSuggestions] = useState([])
  
  // Custom Price
  const [priceType, setPriceType] = useState('percent_off')
  const [discountValue, setDiscountValue] = useState('')
  
  // Price validation state
  const [productPrices, setProductPrices] = useState({}) // { productId: price }
  const [priceValidationWarning, setPriceValidationWarning] = useState(null)

  // Search modals
  const [productSearchModal, setProductSearchModal] = useState(false)
  const [customerSearchModal, setCustomerSearchModal] = useState(false)
  const [collectionSearchModal, setCollectionSearchModal] = useState(false)
  
  // Search state
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [productSearchResults, setProductSearchResults] = useState([])
  const [productSearchLoading, setProductSearchLoading] = useState(false)
  const [selectedProductsTemp, setSelectedProductsTemp] = useState([])
  
  // Edit variants for a selected product (Specific Products) — commented out for now
  // const [variantEditModalOpen, setVariantEditModalOpen] = useState(false)
  // const [variantEditProduct, setVariantEditProduct] = useState(null)
  // const [variantEditVariants, setVariantEditVariants] = useState([])
  // const [variantEditSelectedIds, setVariantEditSelectedIds] = useState([])
  // const [variantEditLoading, setVariantEditLoading] = useState(false)

  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [customerSearchResults, setCustomerSearchResults] = useState([])
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false)
  const [selectedCustomersTemp, setSelectedCustomersTemp] = useState([])
  
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('')
  const [collectionSearchResults, setCollectionSearchResults] = useState([])
  const [collectionSearchLoading, setCollectionSearchLoading] = useState(false)
  const [selectedCollectionsTemp, setSelectedCollectionsTemp] = useState([])

  // state for segment assignment
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [modalDiscountId, setModalDiscountId] = useState(null);
  const [modalDiscountTitle, setModalDiscountTitle] = useState('');
  const [modalSegmentName, setModalSegmentName] = useState('');
  const [currentRuleId, setCurrentRuleId] = useState(null)

  useEffect(() => {
    fetchPricingRules()
    fetchTags()
  }, [])

  const fetchPricingRules = async () => {
    try {
      setLoading(true)
      const response = await getPricingRules()
      setPricingRules(response.rules || [])
    } catch (err) {
      setError(err.message)
      showToast(err.message, true)
    } finally {
      setLoading(false)
    }
  }

  const fetchTags = async () => {
    try {
      const [customerTagsRes, productTagsRes] = await Promise.all([
        getCustomerTags().catch(() => ({ tags: [] })),
        getProductTags().catch(() => ({ tags: [] }))
      ])
      setAvailableCustomerTags(customerTagsRes.tags || [])
      setAvailableProductTags(productTagsRes.tags || [])
    } catch (err) {
      console.error('Error fetching tags:', err)
    }
  }

  // Validate new price against product prices
  useEffect(() => {
    if (priceType === 'new_price' && discountValue && applyToProducts === 'specific_products') {
      const newPrice = parseFloat(discountValue)
      if (isNaN(newPrice)) {
        setPriceValidationWarning(null)
        return
      }

      const invalidProducts = []

      for (const product of specificProducts) {
        const originalPrice = productPrices[product.id]
        if (originalPrice && newPrice > originalPrice) {
          invalidProducts.push({
            id: product.id,
            name: product.title || `Product ${product.id}`,
            originalPrice,
            newPrice
          })
        }
      }

      if (invalidProducts.length > 0) {
        const productNames = invalidProducts.map(p => p.name).join(', ')
        setPriceValidationWarning({
          message: `Warning: The new price ($${newPrice.toFixed(2)}) is higher than the original price for some items. Shopify discounts can only reduce prices, so these items will show the new price visually on the product page, but checkout will use the original price.`,
          products: invalidProducts
        })
      } else {
        setPriceValidationWarning(null)
      }
    } else {
      setPriceValidationWarning(null)
    }
  }, [priceType, discountValue, applyToProducts, specificProducts, productPrices])

  // Fetch product prices when products are selected
  useEffect(() => {
    const fetchPrices = async () => {
      if (applyToProducts !== 'specific_products') {
        setProductPrices({})
        return
      }

      try {
        const prices = {}
        for (const product of specificProducts) {
          try {
            const response = await searchProducts(product.title || product.id)
            const foundProduct = response.products?.find(p => p.id === product.id)
            if (foundProduct && foundProduct.variants?.length > 0) {
              const variantPrice = parseFloat(foundProduct.variants[0].price)
              if (!isNaN(variantPrice)) {
                prices[product.id] = variantPrice
              }
            }
          } catch (err) {
            console.error(`Error fetching price for product ${product.id}:`, err)
          }
        }
        setProductPrices(prices)
      } catch (err) {
        console.error('Error fetching product prices:', err)
      }
    }

    if (applyToProducts === 'specific_products' && specificProducts.length > 0) {
      fetchPrices()
    } else {
      setProductPrices({})
    }
  }, [applyToProducts, specificProducts])

  const handleSyncToShopify = async () => {
    try {
      setSyncing(true)
      await syncPricingRulesToShopify()
      showToast('Pricing rules synced to Shopify successfully')
    } catch (err) {
      showToast(err.message || 'Failed to sync pricing rules', true)
    } finally {
      setSyncing(false)
    }
  }

  const [productDiscountModalOpen, setProductDiscountModalOpen] = useState(false)
  /** Open the linked Shopify discount page in a new tab so admin can edit "Applies to" products manually */
  const openDiscountPageInNewTab = () => {
    if (!editingRule?.shopifyDiscountId || !shop) return
    const idStr = String(editingRule.shopifyDiscountId).trim()
    const numericId = idStr.match(/\/(\d+)$/)?.[1] || idStr
    const storeHandle = shop.replace(/\.myshopify\.com$/i, '')
    const url = `https://admin.shopify.com/store/${storeHandle}/discounts/${numericId}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  const openProductDiscountModal = () => {
    if (editingRule?.shopifyDiscountId) setProductDiscountModalOpen(true)
  }
  // Variant selection/edit — commented out for now (specific products only)
  // const openVariantEditModal = async (product) => {
  //   setVariantEditProduct(product)
  //   setVariantEditLoading(true)
  //   setVariantEditModalOpen(true)
  //   setVariantEditVariants([])
  //   setVariantEditSelectedIds(product.variantIds || [])
  //   try {
  //     const response = await searchProducts(product.title || product.id)
  //     const found = response.products?.find((p) => String(p.id) === String(product.id))
  //     if (found?.variants?.length) {
  //       setVariantEditVariants(found.variants)
  //       if (!Array.isArray(product.variantIds) || product.variantIds.length === 0) {
  //         setVariantEditSelectedIds(found.variants.map((v) => v.id))
  //       }
  //     }
  //   } catch (e) {
  //     console.error('Error loading variants:', e)
  //   } finally {
  //     setVariantEditLoading(false)
  //   }
  // }
  // const toggleVariantEditSelection = (variantId) => {
  //   setVariantEditSelectedIds((prev) =>
  //     prev.includes(variantId) ? prev.filter((id) => id !== variantId) : [...prev, variantId]
  //   )
  // }
  // const handleVariantEditConfirm = () => {
  //   if (!variantEditProduct) return
  //   setSpecificProducts((prev) =>
  //     prev.map((p) =>
  //       p.id === variantEditProduct.id
  //         ? { ...p, variantIds: variantEditSelectedIds.length > 0 ? variantEditSelectedIds : undefined }
  //         : p
  //     )
  //   )
  //   setVariantEditModalOpen(false)
  //   setVariantEditProduct(null)
  //   setVariantEditVariants([])
  //   setVariantEditSelectedIds([])
  //   showToast(
  //     variantEditSelectedIds.length > 0
  //       ? `Variants updated (${variantEditSelectedIds.length} selected). Save the rule to sync to the store.`
  //       : 'All variants selected. Save the rule to sync.'
  //   )
  // }
  const handleProductDiscountConfirm = (selectedProducts, applyTo) => {
    console.log('[App] Product discount confirm: applied in app and store', { count: (selectedProducts || []).length, applyTo })
    setSpecificProducts(selectedProducts || [])
    setApplyToProducts(applyTo === 'all' ? 'all' : 'specific_products')
    showToast('Applies to updated and discount synced.')
  }

  const showToast = (message, isError = false) => {
    setToastMessage(message)
    setToastError(isError)
    setToastActive(true)
  }

  const resetForm = () => {
    setRuleName('')
    setRuleStatus('active')
    setDiscountTitle('')
    setApplyToCustomers('all')
    setCustomerTags([])
    setCustomerTagInput('')
    setSpecificCustomers([])
    setApplyToProducts('all')
    setSpecificProducts([])
    setCollections([])
    setProductTags([])
    setProductTagInput('')
    setPriceType('percent_off')
    setDiscountValue('')
  }

  // const handleCreateRule = () => {
  //   setEditingRule(null)
  //   resetForm()
  //   setView('editor')
  // }

  const handleCreateRule = () => {
    setEditingRule(null)
    resetForm()
    setView('editor')
  }

  const handleSegmentAssigned = async () => {
    try {
      if (currentRuleId) {
        const verifyResponse = await getShopifyDiscountByRuleId(currentRuleId);
        
        if (verifyResponse.success && verifyResponse.segmentAssigned) {
          showToast('Segment assigned successfully! Discount is now active.')
        } else {
          showToast('Setup marked as complete. Please verify segment assignment in Shopify Admin.')
        }
      } else {
        showToast('Segment information updated. Please save the rule to apply changes.')
      }
  
      setShowSegmentModal(false)
      await fetchPricingRules()
      
      // Only return to list if we have a saved rule
      if (currentRuleId) {
        setView('list')
      }
      
    } catch (error) {
      console.error('Error verifying segment assignment:', error)
      setShowSegmentModal(false)
      showToast('Please verify segment assignment in Shopify Admin')
      await fetchPricingRules()
      if (currentRuleId) {
        setView('list')
      }
    }
  }

  const handleModalClose = () => {
    setShowSegmentModal(false);
  };

  // const handleOpenSegmentModal = (rule) => {
  //   const id = rule?.shopifyDiscountId;
  //   // Allow opening modal even without shopifyDiscountId for new rules
  //   setModalDiscountId(id || null);
  //   setModalDiscountTitle(rule?.discountTitle || rule?.name || discountTitle || ruleName || 'Discount');
  //   setModalSegmentName(rule?.customerTags?.[0] || customerTags?.[0] || 'Customer Segment');
  //   setCurrentRuleId(rule?.id || null);
  //   setShowSegmentModal(true);
  // };
  const handleOpenSegmentModal = (rule) => {
    // ❌ DON'T use shopifyDiscountId as rule id
    // const id = rule?.shopifyDiscountId
  
    // ✅ MongoDB rule ID
    setCurrentRuleId(rule?.id || null)
  
    // ✅ Shopify ID (separate)
    setModalDiscountId(rule.shopifyDiscountId)
  
    setModalDiscountTitle(
      rule.discountTitle || rule.name || 'Discount'
    )
  
    setModalSegmentName(
      rule.customerTags?.[0] || 'Customer Segment'
    )
  
    setShowSegmentModal(true)
  }
  


  const handleEditRule = (rule) => {
    setEditingRule(rule)
    setRuleName(rule.name || '')
    setRuleStatus(rule.status || 'active')
    setDiscountTitle(rule.discountTitle || '')
    setApplyToCustomers(rule.applyToCustomers || 'all')
    setCustomerTags(rule.customerTags || [])
    setSpecificCustomers(rule.specificCustomers || [])
    // Legacy "Specific Variants" is no longer a separate option; treat as Specific Products (user can add products + Edit variants)
    const productMode = rule.applyToProducts === 'specific_variants' ? 'specific_products' : (rule.applyToProducts || 'all')
    setApplyToProducts(productMode)
    setSpecificProducts(rule.applyToProducts === 'specific_variants' ? [] : (rule.specificProducts || []))
    setCollections(rule.collections || [])
    setProductTags(rule.productTags || [])
    setPriceType(rule.priceType || 'percent_off')
    setDiscountValue(rule.discountValue ? String(rule.discountValue) : '')
    setView('editor')
  }

  // const handleSaveRule = async () => {
  //   if (!ruleName.trim()) {
  //     showToast('Rule name is required', true)
  //     return
  //   }
  //   if (!discountValue || isNaN(parseFloat(discountValue))) {
  //     showToast('Valid discount value is required', true)
  //     return
  //   }

  //   try {
  //     setSaving(true)
  //     const ruleData = {
  //       name: ruleName.trim(),
  //       status: ruleStatus,
  //       discountTitle: discountTitle.trim(),
  //       applyToCustomers,
  //       customerTags,
  //       specificCustomers,
  //       applyToProducts,
  //       specificProducts,
  //       specificVariants,
  //       collections,
  //       productTags,
  //       priceType,
  //       discountValue: parseFloat(discountValue)
  //     }

  //     if (editingRule) {
  //       await updatePricingRule(editingRule.id, ruleData)
  //       showToast('Pricing rule updated successfully')
  //     } else {
  //       await createPricingRule(ruleData)
  //       showToast('Pricing rule created successfully')
  //     }

  //     await fetchPricingRules()
  //     setView('list')
  //   } catch (err) {
  //     showToast(err.message || 'Failed to save pricing rule', true)
  //   } finally {
  //     setSaving(false)
  //   }
  // }
  // const handleSaveRule = async () => {
  //   if (!ruleName.trim()) {
  //     showToast('Rule name is required', true)
  //     return
  //   }
  //   if (!discountValue || isNaN(parseFloat(discountValue))) {
  //     showToast('Valid discount value is required', true)
  //     return
  //   }
  
  //   try {
  //     setSaving(true)
  //     const ruleData = {
  //       name: ruleName.trim(),
  //       status: ruleStatus,
  //       discountTitle: discountTitle.trim(),
  //       applyToCustomers,
  //       customerTags,
  //       specificCustomers,
  //       applyToProducts,
  //       specificProducts,
  //       specificVariants,
  //       collections,
  //       productTags,
  //       priceType,
  //       discountValue: parseFloat(discountValue)
  //     }
  
  //     let response;
  //     let ruleId

  //     if (editingRule) {
  //       response = await updatePricingRule(editingRule.id, ruleData)
  //       ruleId = editingRule.id
  //       showToast('Pricing rule updated successfully')
  //       const id = response?.shopifyDiscountId ?? response?.rule?.shopifyDiscountId
  //       if (id) {
  //         setModalDiscountId(id)
  //         setModalDiscountTitle((response.discountTitle ?? discountTitle.trim()) || ruleName.trim())
  //         setModalSegmentName(response.segmentName || 'Customer Segment')
  //         setCurrentRuleId(editingRule.id)
  //         setShowSegmentModal(true)
  //         return
  //       }
  //     } else {
  //       response = await createPricingRule(ruleData)
  //       ruleId = response.ruleId || response.rule?.id
  //       showToast('Pricing rule created successfully')
  //       const id = response?.shopifyDiscountId ?? response?.rule?.shopifyDiscountId
  //       if (id) {
  //         setModalDiscountId(id)
  //         setModalDiscountTitle((response.discountTitle ?? discountTitle.trim()) || ruleName.trim())
  //         setModalSegmentName(response.segmentName || response.setupInstructions?.segmentName || 'Customer Segment')
  //         setCurrentRuleId(response.ruleId ?? response.rule?.id ?? response.rule?._id)
  //         setShowSegmentModal(true)
  //         await fetchPricingRules()
  //         return
  //       }
  //     }

  //     await fetchPricingRules()
  //     setView('list')
      
  //   } catch (err) {
  //     console.error('Save error:', err) // 🔥 NEW: Better error logging
  //     showToast(err.message || 'Failed to save pricing rule', true)
  //   } finally {
  //     setSaving(false)
  //   }
  // }
  const handleSaveRule = async () => {
    if (!ruleName.trim()) {
      showToast('Rule name is required', true)
      return
    }
  
    try {
      setSaving(true)
  
      const ruleData = {
        name: ruleName.trim(),
        status: ruleStatus,
        discountTitle: discountTitle.trim(),
        applyToCustomers,
        customerTags,
        specificCustomers,
        applyToProducts,
        specificProducts,
        collections,
        productTags,
        priceType,
        discountValue: parseFloat(discountValue),
      }
  
      let response
      let ruleId
  
      if (editingRule) {
        response = await updatePricingRule(editingRule.id, ruleData)
  
        // ✅ MongoDB rule ID (ALWAYS this)
        ruleId = editingRule.id
        showToast('Pricing rule updated successfully')
  
      } else {
        response = await createPricingRule(ruleData)
  
        // ✅ MongoDB rule ID from backend
        ruleId = response.ruleId || response.rule?.id
        showToast('Pricing rule created successfully')
      }
  
      // ✅ Store ruleId for later API calls
      setCurrentRuleId(ruleId)
  
      // ✅ Shopify discount ID (different thing)
      const shopifyDiscountId =
        response.shopifyDiscountId || response.rule?.shopifyDiscountId
  
      if (shopifyDiscountId) {
        setModalDiscountId(shopifyDiscountId)
        setModalDiscountTitle(discountTitle || ruleName)
        setModalSegmentName(customerTags?.[0] || 'Customer Segment')
  
        setShowSegmentModal(true)
        return
      }
  
      await fetchPricingRules()
      setView('list')
  
    } catch (err) {
      console.error('Save error:', err)
      showToast(err.message || 'Failed to save pricing rule', true)
    } finally {
      setSaving(false)
    }
  }
  

  const handleDeleteClick = (rule) => {
    setRuleToDelete(rule)
    setDeleteModalActive(true)
  }

  const handleDeleteConfirm = async () => {
    try {
      await deletePricingRule(ruleToDelete.id)
      showToast('Pricing rule deleted successfully')
      setDeleteModalActive(false)
      setRuleToDelete(null)
      await fetchPricingRules()
      if (view === 'editor') {
        setView('list')
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete pricing rule', true)
    }
  }

  // Customer tag handlers
  const handleAddCustomerTag = () => {
    if (customerTagInput.trim() && !customerTags.includes(customerTagInput.trim())) {
      setCustomerTags([...customerTags, customerTagInput.trim()])
      setCustomerTagInput('')
    }
  }

  const handleRemoveCustomerTag = (tagToRemove) => {
    setCustomerTags(customerTags.filter(tag => tag !== tagToRemove))
  }

  const updateCustomerTagSuggestions = useCallback((value) => {
    setCustomerTagInput(value)
    if (value === '') {
      setCustomerTagSuggestions([])
      return
    }
    const filtered = availableCustomerTags
      .filter(tag => tag.toLowerCase().includes(value.toLowerCase()))
      .filter(tag => !customerTags.includes(tag))
      .slice(0, 10)
    setCustomerTagSuggestions(filtered)
  }, [availableCustomerTags, customerTags])

  // Product tag handlers
  const handleAddProductTag = () => {
    if (productTagInput.trim() && !productTags.includes(productTagInput.trim())) {
      setProductTags([...productTags, productTagInput.trim()])
      setProductTagInput('')
    }
  }

  const handleRemoveProductTag = (tagToRemove) => {
    setProductTags(productTags.filter(tag => tag !== tagToRemove))
  }

  const updateProductTagSuggestions = useCallback((value) => {
    setProductTagInput(value)
    if (value === '') {
      setProductTagSuggestions([])
      return
    }
    const filtered = availableProductTags
      .filter(tag => tag.toLowerCase().includes(value.toLowerCase()))
      .filter(tag => !productTags.includes(tag))
      .slice(0, 10)
    setProductTagSuggestions(filtered)
  }, [availableProductTags, productTags])

  // Product search
  const handleProductSearch = async (query) => {
    setProductSearchQuery(query)
    if (!query.trim()) {
      setProductSearchResults([])
      return
    }
    try {
      setProductSearchLoading(true)
      const response = await searchProducts(query)
      setProductSearchResults(response.products || [])
    } catch (err) {
      console.error('Product search error:', err)
    } finally {
      setProductSearchLoading(false)
    }
  }

  const openProductSearchModal = () => {
    setSelectedProductsTemp([...specificProducts])
    setProductSearchQuery('')
    setProductSearchResults([])
    setProductSearchModal(true)
  }

  const confirmProductSelection = () => {
    setSpecificProducts(selectedProductsTemp)
    setProductSearchModal(false)
  }

  const toggleProductSelection = (product) => {
    const exists = selectedProductsTemp.find(p => p.id === product.id)
    if (exists) {
      setSelectedProductsTemp(selectedProductsTemp.filter(p => p.id !== product.id))
    } else {
      setSelectedProductsTemp([...selectedProductsTemp, {
        id: product.id,
        title: product.title,
        handle: product.handle,
        image: product.image
      }])
    }
  }

  // Customer search
  const handleCustomerSearch = async (query) => {
    setCustomerSearchQuery(query)
    if (!query.trim()) {
      setCustomerSearchResults([])
      return
    }
    try {
      setCustomerSearchLoading(true)
      const response = await searchCustomers(query)
      setCustomerSearchResults(response.customers || [])
    } catch (err) {
      console.error('Customer search error:', err)
    } finally {
      setCustomerSearchLoading(false)
    }
  }

  const openCustomerSearchModal = () => {
    setSelectedCustomersTemp([...specificCustomers])
    setCustomerSearchQuery('')
    setCustomerSearchResults([])
    setCustomerSearchModal(true)
  }

  const confirmCustomerSelection = () => {
    setSpecificCustomers(selectedCustomersTemp)
    setCustomerSearchModal(false)
  }

  const toggleCustomerSelection = (customer) => {
    const exists = selectedCustomersTemp.find(c => c.id === customer.id)
    if (exists) {
      setSelectedCustomersTemp(selectedCustomersTemp.filter(c => c.id !== customer.id))
    } else {
      setSelectedCustomersTemp([...selectedCustomersTemp, {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        displayName: customer.displayName
      }])
    }
  }

  // Collection search
  const handleCollectionSearch = async (query) => {
    setCollectionSearchQuery(query)
    if (!query.trim()) {
      setCollectionSearchResults([])
      return
    }
    try {
      setCollectionSearchLoading(true)
      const response = await searchCollections(query)
      setCollectionSearchResults(response.collections || [])
    } catch (err) {
      console.error('Collection search error:', err)
    } finally {
      setCollectionSearchLoading(false)
    }
  }

  const openCollectionSearchModal = () => {
    setSelectedCollectionsTemp([...collections])
    setCollectionSearchQuery('')
    setCollectionSearchResults([])
    setCollectionSearchModal(true)
  }

  const confirmCollectionSelection = () => {
    setCollections(selectedCollectionsTemp)
    setCollectionSearchModal(false)
  }

  const toggleCollectionSelection = (collection) => {
    const exists = selectedCollectionsTemp.find(c => c.id === collection.id)
    if (exists) {
      setSelectedCollectionsTemp(selectedCollectionsTemp.filter(c => c.id !== collection.id))
    } else {
      setSelectedCollectionsTemp([...selectedCollectionsTemp, {
        id: collection.id,
        title: collection.title,
        handle: collection.handle,
        image: collection.image
      }])
    }
  }

  // Tabs configuration
  const tabs = [
    { id: 'all', content: 'All', badge: pricingRules.length.toString() },
    { id: 'active', content: 'Active', badge: pricingRules.filter(r => r.status === 'active').length.toString() },
    { id: 'inactive', content: 'Inactive', badge: pricingRules.filter(r => r.status === 'inactive').length.toString() },
  ]

  const handleTabChange = useCallback((selectedTabIndex) => {
    setSelectedTab(selectedTabIndex)
    setCurrentPage(1)
  }, [])

  const handleSearchChange = useCallback((value) => {
    setSearchValue(value)
    setCurrentPage(1)
  }, [])

  // Filter rules based on tab and search
  const filteredRules = pricingRules.filter(rule => {
    const matchesTab = selectedTab === 0 || 
      (selectedTab === 1 && rule.status === 'active') ||
      (selectedTab === 2 && rule.status === 'inactive')
    
    const matchesSearch = rule.name.toLowerCase().includes(searchValue.toLowerCase())
    
    return matchesTab && matchesSearch
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredRules.length / rulesPerPage)
  const startIndex = (currentPage - 1) * rulesPerPage
  const endIndex = startIndex + rulesPerPage
  const paginatedRules = filteredRules.slice(startIndex, endIndex)

  const statusOptions = [
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ]

  const resourceName = {
    singular: 'pricing rule',
    plural: 'pricing rules',
  }

  const formatDiscount = (rule) => {
    if (rule.priceType === 'percent_off') return `${rule.discountValue}% off`
    if (rule.priceType === 'amount_off') return `$${rule.discountValue} off`
    return `Fixed: $${rule.discountValue}`
  }

  const getCustomerLabel = (rule) => {
    switch (rule.applyToCustomers) {
      case 'all': return 'All Customers'
      case 'logged_in': return 'Logged In'
      case 'non_logged_in': return 'Non Logged In'
      case 'specific': return `${rule.specificCustomers?.length || 0} Customers`
      case 'customer_tags': return `Tags: ${rule.customerTags?.join(', ') || 'None'}`
      default: return rule.applyToCustomers
    }
  }

  const getProductLabel = (rule) => {
    switch (rule.applyToProducts) {
      case 'all': return 'All Products'
      case 'specific_products': return `${rule.specificProducts?.length || 0} Products`
      case 'specific_variants': return `${rule.specificVariants?.length || 0} Variants`
      case 'collections': return `${rule.collections?.length || 0} Collections`
      case 'product_tags': return `Tags: ${rule.productTags?.join(', ') || 'None'}`
      default: return rule.applyToProducts
    }
  }

  // Get summary text for editor
  const getCustomerSummary = () => {
    switch (applyToCustomers) {
      case 'all': return 'All customers'
      case 'logged_in': return 'Logged in customers only'
      case 'non_logged_in': return 'Guest customers only'
      case 'specific': return `${specificCustomers.length} specific customer(s)`
      case 'customer_tags': return customerTags.length > 0 ? `Tags: ${customerTags.join(', ')}` : 'No tags selected'
      default: return 'Not configured'
    }
  }

  const getProductSummary = () => {
    switch (applyToProducts) {
      case 'all': return 'All products'
      case 'specific_products': return `${specificProducts.length} specific product(s)`
      case 'collections': return `${collections.length} collection(s)`
      case 'product_tags': return productTags.length > 0 ? `Tags: ${productTags.join(', ')}` : 'No tags selected'
      default: return 'Not configured'
    }
  }

  const getPriceSummary = () => {
    if (!discountValue) return 'Not configured'
    switch (priceType) {
      case 'percent_off': return `${discountValue}% off original price`
      case 'amount_off': return `$${discountValue} off original price`
      case 'new_price': return `Fixed price: $${discountValue}`
      default: return 'Not configured'
    }
  }

  const rowMarkup = paginatedRules.map((rule, index) => (
    <IndexTable.Row id={rule.id} key={rule.id} position={index}>
      <IndexTable.Cell>
        <Tooltip content={rule.name} active={rule.name.length > 25 ? undefined : false}>
          <Text variant="bodyMd" fontWeight="semibold">
            <span style={{
              display: 'inline-block',
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              verticalAlign: 'middle'
            }}>
              {rule.name}
            </span>
          </Text>
        </Tooltip>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={rule.priceType === 'percent_off' ? 'info' : rule.priceType === 'amount_off' ? 'attention' : 'success'}>
          {formatDiscount(rule)}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm" tone="subdued">
          {getCustomerLabel(rule)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm" tone="subdued">
          {getProductLabel(rule)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={rule.status === 'active' ? 'success' : 'info'}>
          {rule.status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm" tone="subdued">
          {rule.createdAt ? new Date(rule.createdAt).toLocaleDateString() : '-'}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="100">
          {rule.shopifyDiscountId && (
            <Tooltip content="Assign segment">
              <Button
                size="slim"
                icon={DiscountIcon}
                onClick={() => handleOpenSegmentModal(rule)}
                accessibilityLabel={`Assign segment for ${rule.name}`}
              />
            </Tooltip>
          )}
          <Tooltip content="Edit rule">
            <Button
              size="slim"
              icon={EditIcon}
              onClick={() => handleEditRule(rule)}
              accessibilityLabel={`Edit ${rule.name}`}
            />
          </Tooltip>
          <Tooltip content="Delete rule">
            <Button
              size="slim"
              icon={DeleteIcon}
              tone="critical"
              onClick={() => handleDeleteClick(rule)}
              accessibilityLabel={`Delete ${rule.name}`}
            />
          </Tooltip>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ))

  // Loading state
  if (loading) {
    return (
      <Frame>
        <NavBar />
        <Page title="Custom Pricing">
          <Layout>
            <Layout.Section>
              <Card>
                <Box padding="800">
                  <InlineStack align="center" blockAlign="center">
                    <Spinner size="large" />
                  </InlineStack>
                </Box>
              </Card>
            </Layout.Section>
          </Layout>
        </Page>
      </Frame>
    )
  }

  // Editor View - Redesigned
  if (view === 'editor') {
    return (
      <Frame>
        <NavBar />
        <div style={{ paddingBottom: '100px' }}>
          <Page
            backAction={{ content: 'Pricing Rules', onAction: () => setView('list') }}
            title={editingRule ? 'Edit Pricing Rule' : 'Create Pricing Rule'}
            titleMetadata={
              <Badge tone={ruleStatus === 'active' ? 'success' : 'subdued'}>
                {ruleStatus === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            }
          >
            <Layout>
              {/* Main Content - Left Column */}
              <Layout.Section>
                <BlockStack gap="500">
                  {/* Step 1: Basic Information */}
                  <Card>
                    <Box padding="500">
                      <BlockStack gap="400">
                        <SectionHeader number="1" title="Basic Information" subtitle="Name and status of your pricing rule" />
                        <Divider />
                        <InlineGrid columns={['twoThirds', 'oneThird']} gap="400">
                          <TextField
                            label="Rule Name"
                            value={ruleName}
                            onChange={setRuleName}
                            placeholder="e.g., Practitioner Discount"
                            autoComplete="off"
                            helpText="Internal name to identify this rule"
                          />
                          <Select
                            label="Status"
                            options={statusOptions}
                            value={ruleStatus}
                            onChange={setRuleStatus}
                            helpText="Only active rules apply"
                          />
                        </InlineGrid>
                        <TextField
                          label="Discount Title (Optional)"
                          value={discountTitle}
                          onChange={setDiscountTitle}
                          placeholder="e.g., Practitioner Discount"
                          autoComplete="off"
                          helpText="Shown to customers at checkout"
                        />
                      </BlockStack>
                    </Box>
                  </Card>

                  {/* Step 2: Customer Conditions */}
                  <Card>
                    <Box padding="500">
                      <BlockStack gap="400">
                        <SectionHeader number="2" title="Customer Conditions" subtitle="Who should this discount apply to?" />
                        <Divider />
                        {/* <SelectionCard
                          title="All Customers"
                          description="Everyone visiting your store"
                          icon={PersonIcon}
                          selected={applyToCustomers === 'all'}
                          onClick={() => setApplyToCustomers('all')}
                        /> */}
                        {/* <InlineGrid columns={2} gap="300">
                          <SelectionCard
                            title="Logged In Customers"
                            description="Customers with an account"
                            icon={PersonIcon}
                            selected={applyToCustomers === 'logged_in'}
                            onClick={() => setApplyToCustomers('logged_in')}
                          />
                          <SelectionCard
                            title="Guest Customers"
                            description="Visitors not logged in"
                            icon={PersonIcon}
                            selected={applyToCustomers === 'non_logged_in'}
                            onClick={() => setApplyToCustomers('non_logged_in')}
                          />
                          <SelectionCard
                            title="Specific Customers"
                            description="Select individual customers"
                            icon={PersonIcon}
                            selected={applyToCustomers === 'specific'}
                            onClick={() => setApplyToCustomers('specific')}
                            badge={specificCustomers.length > 0 ? `${specificCustomers.length}` : null}
                          >
                            <BlockStack gap="300">
                              <Button variant="secondary" icon={PersonIcon} onClick={openCustomerSearchModal} fullWidth>
                                Select Customers
                              </Button>
                              {specificCustomers.length > 0 && (
                                <InlineStack gap="100" wrap>
                                  {specificCustomers.map(customer => (
                                    <Tag key={customer.id} onRemove={() => setSpecificCustomers(specificCustomers.filter(c => c.id !== customer.id))}>
                                      {customer.displayName || customer.email}
                                    </Tag>
                                  ))}
                                </InlineStack>
                              )}
                            </BlockStack>
                          </SelectionCard>
                        </InlineGrid> */}
                        <SelectionCard
                          title="Customer Tags"
                          description="Customers with specific tags (e.g., practitioner, wholesale)"
                          icon={HashtagIcon}
                          selected={applyToCustomers === 'customer_tags'}
                          onClick={() => setApplyToCustomers('customer_tags')}
                          badge={customerTags.length > 0 ? `${customerTags.length}` : null}
                        >
                          <BlockStack gap="300">
                            <Autocomplete
                              options={customerTagSuggestions.map(tag => ({ value: tag, label: tag }))}
                              selected={[]}
                              onSelect={(selected) => {
                                const tag = selected[0]
                                if (tag && !customerTags.includes(tag)) {
                                  setCustomerTags([...customerTags, tag])
                                  setCustomerTagInput('')
                                  setCustomerTagSuggestions([])
                                }
                              }}
                              textField={
                                <Autocomplete.TextField
                                  value={customerTagInput}
                                  onChange={updateCustomerTagSuggestions}
                                  placeholder="Type to search or add tags"
                                  autoComplete="off"
                                  onBlur={() => {
                                    if (customerTagInput.trim()) {
                                      handleAddCustomerTag()
                                    }
                                  }}
                                />
                              }
                            />
                            {customerTags.length > 0 && (
                              <InlineStack gap="100" wrap>
                                {customerTags.map(tag => (
                                  <Tag key={tag} onRemove={() => handleRemoveCustomerTag(tag)}>
                                    {tag}
                                  </Tag>
                                ))}
                              </InlineStack>
                            )}
                          </BlockStack>
                        </SelectionCard>
                        {/* {editingRule && (
                          <BlockStack gap="200">
                            <Button
                              icon={DiscountIcon}
                              onClick={() => handleOpenSegmentModal(editingRule)}
                            >
                              Assign segment
                            </Button>
                            <Text as="p" variant="bodySm" tone="subdued">
                              Assign a customer segment to the discount in Shopify (save the rule first if you just created it).
                            </Text>
                          </BlockStack>
                        )} */}
                      </BlockStack>
                    </Box>
                  </Card>

                  {/* Step 3: Product Conditions */}
                  <Card>
                    <Box padding="500">
                      <BlockStack gap="400">
                        <SectionHeader number="3" title="Product Conditions" subtitle="Which products should have this pricing?" />
                        {/* Full-width layout to match Customer Conditions card (no InlineGrid) */}
                          {/* <SelectionCard
                            title="All Products"
                            description="Apply to your entire catalog"
                            icon={ProductIcon}
                            selected={applyToProducts === 'all'}
                            onClick={() => setApplyToProducts('all')}
                          /> */}
                          <SelectionCard
                            title="Specific Products"
                            description="Select individual products"
                            icon={ProductIcon}
                            selected={applyToProducts === 'specific_products'}
                            onClick={() => setApplyToProducts('specific_products')}
                            badge={specificProducts.length > 0 ? `${specificProducts.length}` : null}
                          >
                            <BlockStack gap="300">
                              {editingRule?.shopifyDiscountId ? (
                                <BlockStack gap="100">
                                  <Button variant="secondary" icon={ProductIcon} onClick={openProductDiscountModal} fullWidth>
                                    Select or remove products
                                  </Button>
                                  <Text variant="bodySm" tone="subdued">
                                    Add or remove products; changes sync to the store discount when you save.
                                  </Text>
                                </BlockStack>
                              ) : (
                                <Button variant="secondary" icon={ProductIcon} onClick={openProductSearchModal} fullWidth>
                                  Select Products
                                </Button>
                              )}
                              {specificProducts.length > 0 && (
                                <BlockStack gap="200">
                                  <InlineStack gap="100" wrap>
                                    {specificProducts.map((product) => (
                                      <InlineStack key={product.id} gap="100" blockAlign="center" wrap={false}>
                                        <Tag onRemove={() => setSpecificProducts(specificProducts.filter((p) => p.id !== product.id))}>
                                          <Box as="span" minWidth={0} maxWidth="280px" style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                            {product.title}
                                            {/* Variant count — commented out with variant edit
                                            {Array.isArray(product.variantIds) && product.variantIds.length > 0
                                              ? ` (${product.variantIds.length} variant${product.variantIds.length !== 1 ? 's' : ''})`
                                              : ''}
                                            */}
                                          </Box>
                                        </Tag>
                                        {/* Edit variants — commented out for now
                                        <Button
                                          size="slim"
                                          variant="plain"
                                          onClick={() => openVariantEditModal(product)}
                                        >
                                          Edit variants
                                        </Button>
                                        */}
                                      </InlineStack>
                                    ))}
                                  </InlineStack>
                                  {/* <Text variant="bodySm" tone="subdued">
                                    Use &quot;Edit variants&quot; to include only certain variants of a product; syncs to the store when you save.
                                  </Text> */}
                                </BlockStack>
                              )}
                            </BlockStack>
                          </SelectionCard>

                          {/* <SelectionCard
                            title="Collections"
                            description="All products in selected collections"
                            icon={CollectionIcon}
                            selected={applyToProducts === 'collections'}
                            onClick={() => setApplyToProducts('collections')}
                            badge={collections.length > 0 ? `${collections.length}` : null}
                          >
                            <BlockStack gap="300">
                              <Button variant="secondary" icon={SearchIcon} onClick={openCollectionSearchModal} fullWidth>
                                Select Collections
                              </Button>
                              {collections.length > 0 && (
                                <InlineStack gap="100" wrap>
                                  {collections.map(collection => (
                                    <Tag key={collection.id} onRemove={() => setCollections(collections.filter(c => c.id !== collection.id))}>
                                      {collection.title}
                                    </Tag>
                                  ))}
                                </InlineStack>
                              )}
                            </BlockStack>
                          </SelectionCard> */}
                        {/* <SelectionCard
                          title="Product Tags"
                          description="Products with specific tags"
                          icon={HashtagIcon}
                          selected={applyToProducts === 'product_tags'}
                          onClick={() => setApplyToProducts('product_tags')}
                          badge={productTags.length > 0 ? `${productTags.length}` : null}
                        >
                          <BlockStack gap="300">
                            <Autocomplete
                              options={productTagSuggestions.map(tag => ({ value: tag, label: tag }))}
                              selected={[]}
                              onSelect={(selected) => {
                                const tag = selected[0]
                                if (tag && !productTags.includes(tag)) {
                                  setProductTags([...productTags, tag])
                                  setProductTagInput('')
                                  setProductTagSuggestions([])
                                }
                              }}
                              textField={
                                <Autocomplete.TextField
                                  value={productTagInput}
                                  onChange={updateProductTagSuggestions}
                                  placeholder="Type to search or add tags"
                                  autoComplete="off"
                                  onBlur={() => {
                                    if (productTagInput.trim()) {
                                      handleAddProductTag()
                                    }
                                  }}
                                />
                              }
                            />
                            {productTags.length > 0 && (
                              <InlineStack gap="100" wrap>
                                {productTags.map(tag => (
                                  <Tag key={tag} onRemove={() => handleRemoveProductTag(tag)}>
                                    {tag}
                                  </Tag>
                                ))}
                              </InlineStack>
                            )}
                          </BlockStack>
                        </SelectionCard> */}
                      </BlockStack>
                    </Box>
                  </Card>

                  {/* Step 4: Pricing */}
                  <Card>
                    <Box padding="500">
                      <BlockStack gap="400">
                        <SectionHeader number="4" title="Custom Pricing" subtitle="How should the price be modified?" />
                        <Divider />
                        <InlineGrid columns={2} gap="300">
                          <SelectionCard
                            title="Percentage Off"
                            description="Reduce by %"
                            icon={DiscountIcon}
                            selected={priceType === 'percent_off'}
                            onClick={() => setPriceType('percent_off')}
                          />
                          <SelectionCard
                            title="Amount Off"
                            description="Fixed $ discount"
                            icon={CashDollarIcon}
                            selected={priceType === 'amount_off'}
                            onClick={() => setPriceType('amount_off')}
                          />
                          {/* <SelectionCard
                            title="New Price"
                            description="Set fixed price"
                            icon={CashDollarIcon}
                            selected={priceType === 'new_price'}
                            onClick={() => setPriceType('new_price')}
                          /> */}
                        </InlineGrid>
                        {/* <Box paddingBlockStart="200">
                          <TextField
                            label={
                              priceType === 'percent_off' ? 'Discount Percentage' :
                              priceType === 'amount_off' ? 'Discount Amount' :
                              'New Price'
                            }
                            value={discountValue}
                            onChange={setDiscountValue}
                            type="number"
                            prefix={priceType !== 'percent_off' ? '$' : ''}
                            suffix={priceType === 'percent_off' ? '%' : ''}
                            autoComplete="off"
                            min="0"
                            helpText={
                              priceType === 'percent_off' ? 'Enter a value between 1-100' :
                              priceType === 'amount_off' ? 'Amount to subtract from original price' :
                              'The new fixed price for selected products'
                            }
                          />
                        </Box> */}
                        <Box paddingBlockStart="200">
                          <TextField
                            label={
                              priceType === 'percent_off'
                                ? 'Discount Percentage'
                                : priceType === 'amount_off'
                                ? 'Discount Amount'
                                : 'New Price'
                            }
                            value={discountValue}
                            type="number"
                            min={0}
                            step="any"
                            onChange={(value) => {
                              const numericValue = Number(value);
                              if (numericValue < 0 || isNaN(numericValue)) {
                                return;
                              }
                              if (priceType === 'percent_off' && numericValue > 100) {
                                return;
                              }
                              setDiscountValue(value);
                            }}
                            prefix={priceType !== 'percent_off' ? '$' : ''}
                            suffix={priceType === 'percent_off' ? '%' : ''}
                            autoComplete="off"
                            helpText={
                              priceType === 'percent_off'
                                ? 'Enter a value between 1–100'
                                : priceType === 'amount_off'
                                ? 'Amount to subtract from original price (must be positive)'
                                : 'The new fixed price for selected products'
                            }
                          />
                          </Box>
                        
                        {/* Price Validation Warning */}
                        {priceValidationWarning && (
                          <Box paddingBlockStart="300">
                            <Banner tone="warning" onDismiss={() => setPriceValidationWarning(null)}>
                              <BlockStack gap="200">
                                <Text variant="bodyMd" fontWeight="semibold">
                                  {priceValidationWarning.message}
                                </Text>
                                {priceValidationWarning.products && priceValidationWarning.products.length > 0 && (
                                  <BlockStack gap="100">
                                    <Text variant="bodySm" tone="subdued">Affected products:</Text>
                                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                      {priceValidationWarning.products.map((product, idx) => (
                                        <li key={idx}>
                                          <Text variant="bodySm">
                                            <strong>{product.name}</strong>: Original ${product.originalPrice.toFixed(2)} → New ${product.newPrice.toFixed(2)}
                                          </Text>
                                        </li>
                                      ))}
                                    </ul>
                                  </BlockStack>
                                )}
                              </BlockStack>
                            </Banner>
                          </Box>
                        )}
                      </BlockStack>
                    </Box>
                  </Card>
                </BlockStack>
              </Layout.Section>

              {/* Summary Sidebar - Right Column */}
              <Layout.Section variant="oneThird">
                <div style={{ position: 'sticky', top: '20px' }}>
                  <Card>
                    <Box padding="500">
                      <BlockStack gap="400">
                        <Text variant="headingMd" as="h3">Rule Summary</Text>
                        <Divider />
                        
                        <BlockStack gap="300">
                          <BlockStack gap="100">
                            <Text variant="bodySm" fontWeight="semibold" tone="subdued">RULE NAME</Text>
                            <Text variant="bodyMd">{ruleName || 'Not set'}</Text>
                          </BlockStack>

                          <BlockStack gap="100">
                            <Text variant="bodySm" fontWeight="semibold" tone="subdued">STATUS</Text>
                            <Text variant="bodyMd" tone={ruleStatus === 'active' ? 'success' : 'subdued'}>
                              {ruleStatus === 'active' ? 'Active' : 'Inactive'}
                            </Text>
                          </BlockStack>

                          <Divider />

                          <BlockStack gap="100">
                            <Text variant="bodySm" fontWeight="semibold" tone="subdued">CUSTOMERS</Text>
                            <Text variant="bodyMd">{getCustomerSummary()}</Text>
                          </BlockStack>

                          <BlockStack gap="100">
                            <Text variant="bodySm" fontWeight="semibold" tone="subdued">PRODUCTS</Text>
                            <Text variant="bodyMd">{getProductSummary()}</Text>
                          </BlockStack>

                          <Divider />

                          <BlockStack gap="100">
                            <Text variant="bodySm" fontWeight="semibold" tone="subdued">PRICING</Text>
                            <Text variant="bodyMd" fontWeight="semibold" tone={discountValue ? 'success' : 'subdued'}>
                              {getPriceSummary()}
                            </Text>
                          </BlockStack>
                        </BlockStack>

                        {discountValue && (
                          <>
                            <Divider />
                            <Box background="bg-surface-success" padding="300" borderRadius="200">
                              <BlockStack gap="200">
                                <Text variant="bodySm" fontWeight="semibold">Example</Text>
                                <Text variant="bodySm" tone="subdued">
                                  Original: $100.00
                                </Text>
                                <Text variant="bodyMd" fontWeight="bold" tone="success">
                                  {priceType === 'percent_off' && `New: $${(100 * (1 - parseFloat(discountValue) / 100)).toFixed(2)}`}
                                  {priceType === 'amount_off' && `New: $${Math.max(0, 100 - parseFloat(discountValue)).toFixed(2)}`}
                                  {priceType === 'new_price' && `New: $${parseFloat(discountValue).toFixed(2)}`}
                                </Text>
                              </BlockStack>
                            </Box>
                          </>
                        )}
                      </BlockStack>
                    </Box>
                  </Card>
                </div>
              </Layout.Section>
            </Layout>
          </Page>
        </div>

        {/* Sticky Bottom Action Bar */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '1px solid #e1e3e5',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          zIndex: 100,
          boxShadow: '0 -4px 12px rgba(0,0,0,0.08)'
        }}>
          <InlineStack gap="300">
            <Button onClick={() => setView('list')}>
              Cancel
            </Button>
            {/* {editingRule && (
              <Button
                onClick={() => handleOpenSegmentModal(editingRule)}
              >
                Assign segment
              </Button>
            )} */}
            <Button
              variant="primary"
              onClick={handleSaveRule}
              loading={saving}
            >
              {editingRule ? 'Save Changes' : 'Create Rule'}
            </Button>
          </InlineStack>
        </div>

        {/* Modals */}
        {/* Product Search Modal */}
        <Modal
        limitHeight
          open={productSearchModal}
          onClose={() => setProductSearchModal(false)}
          title="Select Products"
          primaryAction={{
            content: `Confirm (${selectedProductsTemp.length})`,
            onAction: confirmProductSelection,
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => setProductSearchModal(false),
            },
          ]}
          large
        >
          <Modal.Section>
            <BlockStack gap="400">
              <TextField
                prefix={<Icon source={SearchIcon} />}
                placeholder="Search products..."
                value={productSearchQuery}
                onChange={handleProductSearch}
                autoComplete="off"
              />
              {productSearchLoading && (
                <InlineStack align="center">
                  <Spinner size="small" />
                </InlineStack>
              )}
              {selectedProductsTemp.length > 0 && (
                <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                  <BlockStack gap="200">
                    <Text variant="bodySm" fontWeight="semibold">{selectedProductsTemp.length} selected</Text>
                    <InlineStack gap="100" wrap>
                      {selectedProductsTemp.map(p => (
                        <Tag key={p.id} onRemove={() => toggleProductSelection(p)}>{p.title}</Tag>
                      ))}
                    </InlineStack>
                  </BlockStack>
                </Box>
              )}
              {productSearchResults.length > 0 && (
                <ResourceList
                  resourceName={{ singular: 'product', plural: 'products' }}
                  items={productSearchResults}
                  renderItem={(product) => {
                    const isSelected = selectedProductsTemp.some(p => p.id === product.id)
                    return (
                      <ResourceItem
                        id={product.id}
                        onClick={() => toggleProductSelection(product)}
                        media={
                          <Thumbnail
                            source={product.image || 'https://cdn.shopify.com/s/files/1/0757/9955/files/placeholder-image.png'}
                            alt={product.title}
                            size="small"
                          />
                        }
                      >
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="100">
                            <Text variant="bodyMd" fontWeight="semibold">{product.title}</Text>
                            <Text variant="bodySm" tone="subdued">
                              {product.variants?.length || 0} variant(s)
                            </Text>
                          </BlockStack>
                          <Checkbox checked={isSelected} onChange={() => {}} />
                        </InlineStack>
                      </ResourceItem>
                    )
                  }}
                />
              )}
              {!productSearchLoading && productSearchQuery && productSearchResults.length === 0 && (
                <Text variant="bodySm" tone="subdued" alignment="center">No products found</Text>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Edit Variants Modal — commented out for now (specific products only)
        <Modal
          open={variantEditModalOpen}
          onClose={() => {
            setVariantEditModalOpen(false)
            setVariantEditProduct(null)
            setVariantEditVariants([])
            setVariantEditSelectedIds([])
          }}
          title={variantEditProduct ? `Edit variants — ${variantEditProduct.title}` : 'Edit variants'}
          primaryAction={{
            content: 'Apply',
            onAction: handleVariantEditConfirm,
            disabled: variantEditLoading,
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => {
                setVariantEditModalOpen(false)
                setVariantEditProduct(null)
                setVariantEditVariants([])
                setVariantEditSelectedIds([])
              },
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              {variantEditLoading && (
                <InlineStack align="center" blockAlign="center" gap="200">
                  <Spinner size="small" />
                  <Text variant="bodySm" tone="subdued">Loading variants…</Text>
                </InlineStack>
              )}
              {!variantEditLoading && variantEditVariants.length === 0 && variantEditProduct && (
                <Text variant="bodySm" tone="subdued">No variants found for this product.</Text>
              )}
              {!variantEditLoading && variantEditVariants.length > 0 && (
                <>
                  <InlineStack gap="200" blockAlign="center">
                    <Button
                      size="slim"
                      variant="plain"
                      onClick={() => setVariantEditSelectedIds(variantEditVariants.map((v) => v.id))}
                    >
                      Select all
                    </Button>
                    <Button
                      size="slim"
                      variant="plain"
                      onClick={() => setVariantEditSelectedIds([])}
                    >
                      Deselect all
                    </Button>
                    <Text variant="bodySm" tone="subdued">
                      {variantEditSelectedIds.length} of {variantEditVariants.length} selected
                    </Text>
                  </InlineStack>
                  <BlockStack gap="200">
                    {variantEditVariants.map((variant) => (
                      <Checkbox
                        key={variant.id}
                        label={`${variant.title}${variant.sku ? ` (SKU: ${variant.sku})` : ''} — ${variant.price || ''}`}
                        checked={variantEditSelectedIds.includes(variant.id)}
                        onChange={() => toggleVariantEditSelection(variant.id)}
                      />
                    ))}
                  </BlockStack>
                </>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
        */}

        {/* Customer Search Modal */}
        <Modal
        limitHeight
          open={customerSearchModal}
          onClose={() => setCustomerSearchModal(false)}
          title="Select Customers"
          primaryAction={{
            content: `Confirm (${selectedCustomersTemp.length})`,
            onAction: confirmCustomerSelection,
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => setCustomerSearchModal(false),
            },
          ]}
          large
        >
          <Modal.Section>
            <BlockStack gap="400">
              <TextField
                prefix={<Icon source={SearchIcon} />}
                placeholder="Search customers by name or email..."
                value={customerSearchQuery}
                onChange={handleCustomerSearch}
                autoComplete="off"
              />
              {customerSearchLoading && (
                <InlineStack align="center">
                  <Spinner size="small" />
                </InlineStack>
              )}
              {selectedCustomersTemp.length > 0 && (
                <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                  <BlockStack gap="200">
                    <Text variant="bodySm" fontWeight="semibold">{selectedCustomersTemp.length} selected</Text>
                    <InlineStack gap="100" wrap>
                      {selectedCustomersTemp.map(c => (
                        <Tag key={c.id} onRemove={() => toggleCustomerSelection(c)}>
                          {c.displayName || c.email}
                        </Tag>
                      ))}
                    </InlineStack>
                  </BlockStack>
                </Box>
              )}
              {customerSearchResults.length > 0 && (
                <ResourceList
                  resourceName={{ singular: 'customer', plural: 'customers' }}
                  items={customerSearchResults}
                  renderItem={(customer) => {
                    const isSelected = selectedCustomersTemp.some(c => c.id === customer.id)
                    return (
                      <ResourceItem
                        id={customer.id}
                        onClick={() => toggleCustomerSelection(customer)}
                        media={
                          <Avatar customer size="md" name={customer.displayName || customer.email} />
                        }
                      >
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="100">
                            <Text variant="bodyMd" fontWeight="semibold">
                              {customer.displayName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'No name'}
                            </Text>
                            <Text variant="bodySm" tone="subdued">{customer.email}</Text>
                            {customer.tags && customer.tags.length > 0 && (
                              <InlineStack gap="100">
                                {customer.tags.slice(0, 3).map(tag => (
                                  <Badge key={tag} tone="info">{tag}</Badge>
                                ))}
                                {customer.tags.length > 3 && (
                                  <Text variant="bodySm" tone="subdued">+{customer.tags.length - 3} more</Text>
                                )}
                              </InlineStack>
                            )}
                          </BlockStack>
                          <Checkbox checked={isSelected} onChange={() => {}} />
                        </InlineStack>
                      </ResourceItem>
                    )
                  }}
                />
              )}
              {!customerSearchLoading && customerSearchQuery && customerSearchResults.length === 0 && (
                <Text variant="bodySm" tone="subdued" alignment="center">No customers found</Text>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Collection Search Modal */}
        <Modal
        limitHeight
          open={collectionSearchModal}
          onClose={() => setCollectionSearchModal(false)}
          title="Select Collections"
          primaryAction={{
            content: `Confirm (${selectedCollectionsTemp.length})`,
            onAction: confirmCollectionSelection,
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => setCollectionSearchModal(false),
            },
          ]}
          large
        >
          <Modal.Section>
            <BlockStack gap="400">
              <TextField
                prefix={<Icon source={SearchIcon} />}
                placeholder="Search collections..."
                value={collectionSearchQuery}
                onChange={handleCollectionSearch}
                autoComplete="off"
              />
              {collectionSearchLoading && (
                <InlineStack align="center">
                  <Spinner size="small" />
                </InlineStack>
              )}
              {selectedCollectionsTemp.length > 0 && (
                <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                  <BlockStack gap="200">
                    <Text variant="bodySm" fontWeight="semibold">{selectedCollectionsTemp.length} selected</Text>
                    <InlineStack gap="100" wrap>
                      {selectedCollectionsTemp.map(c => (
                        <Tag key={c.id} onRemove={() => toggleCollectionSelection(c)}>{c.title}</Tag>
                      ))}
                    </InlineStack>
                  </BlockStack>
                </Box>
              )}
              {collectionSearchResults.length > 0 && (
                <ResourceList
                  resourceName={{ singular: 'collection', plural: 'collections' }}
                  items={collectionSearchResults}
                  renderItem={(collection) => {
                    const isSelected = selectedCollectionsTemp.some(c => c.id === collection.id)
                    return (
                      <ResourceItem
                        id={collection.id}
                        onClick={() => toggleCollectionSelection(collection)}
                        media={
                          <Thumbnail
                            source={collection.image || 'https://cdn.shopify.com/s/files/1/0757/9955/files/placeholder-image.png'}
                            alt={collection.title}
                            size="small"
                          />
                        }
                      >
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="100">
                            <Text variant="bodyMd" fontWeight="semibold">{collection.title}</Text>
                            <Text variant="bodySm" tone="subdued">
                              {collection.productsCount || 0} product(s)
                            </Text>
                          </BlockStack>
                          <Checkbox checked={isSelected} onChange={() => {}} />
                        </InlineStack>
                      </ResourceItem>
                    )
                  }}
                />
              )}
              {!collectionSearchLoading && collectionSearchQuery && collectionSearchResults.length === 0 && (
                <Text variant="bodySm" tone="subdued" alignment="center">No collections found</Text>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
        limitHeight
          open={deleteModalActive}
          onClose={() => setDeleteModalActive(false)}
          title="Delete Pricing Rule?"
          primaryAction={{
            content: 'Delete',
            destructive: true,
            onAction: handleDeleteConfirm,
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => setDeleteModalActive(false),
            },
          ]}
        >
          <Modal.Section>
            <TextContainer>
              <p>
                Are you sure you want to delete this pricing rule? 
                This action cannot be undone.
              </p>
            </TextContainer>
          </Modal.Section>
        </Modal>



        {/* NEW: Segment Assignment Modal */}
        {showSegmentModal && (
          <DiscountSegmentModal
            isOpen={showSegmentModal}
            onClose={handleModalClose}
            shopifyDiscountId={modalDiscountId}
            discountTitle={modalDiscountTitle}
            discountId={modalDiscountId}  
            ruleId={currentRuleId}      
            segmentName={modalSegmentName}
            onSegmentAssigned={handleSegmentAssigned}
            shop={shop}
          />
        )}

        {/* Product selection modal (like segment) – check/uncheck products for discount */}
        {productDiscountModalOpen && editingRule?.shopifyDiscountId && (
          <DiscountProductModal
            isOpen={productDiscountModalOpen}
            onClose={() => setProductDiscountModalOpen(false)}
            ruleId={editingRule._id}
            discountTitle={editingRule.discountTitle || editingRule.name}
            currentProducts={specificProducts}
            currentApplyTo={applyToProducts}
            onConfirm={handleProductDiscountConfirm}
          />
        )}

        {/* Toast */}
        {toastActive && (
          <Toast
            content={toastMessage}
            error={toastError}
            onDismiss={() => setToastActive(false)}
            duration={3000}
          />
        )}
      </Frame>
    )
  }

  // Empty state markup
  const emptyStateMarkup = (
    <EmptyState
      heading="Create your first pricing rule"
      action={{ content: 'Create Pricing Rule', onAction: handleCreateRule }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>Create custom pricing rules for your practitioner or wholesale customers.</p>
    </EmptyState>
  )

  // List View
  return (
    <Frame>
      <NavBar />
      <Page
        title="Custom Pricing"
        primaryAction={{
          content: 'Create Pricing Rule',
          icon: PlusIcon,
          onAction: handleCreateRule
        }}
        secondaryActions={[
          {
            content: 'Refresh',
            icon: RefreshIcon,
            onAction: fetchPricingRules,
          },
          {
            content: syncing ? 'Syncing...' : 'Sync to Shopify',
            icon: RefreshIcon,
            onAction: handleSyncToShopify,
            loading: syncing,
            disabled: syncing || pricingRules.length === 0
          }
        ]}
      >
        <Layout>
          {error && (
            <Layout.Section>
              <Banner tone="critical" onDismiss={() => setError(null)}>
                <p>{error}</p>
              </Banner>
            </Layout.Section>
          )}

          <Layout.Section>
            <Card padding="0">
              <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
                <Box padding="400">
                  <TextField
                    placeholder="Search pricing rules..."
                    value={searchValue}
                    onChange={handleSearchChange}
                    clearButton
                    onClearButtonClick={() => setSearchValue('')}
                    autoComplete="off"
                    prefix={<Icon source={SearchIcon} />}
                  />
                </Box>

                {filteredRules.length === 0 ? (
                  <Box padding="400">
                    {pricingRules.length === 0 ? emptyStateMarkup : (
                      <EmptyState
                        heading="No pricing rules found"
                        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      >
                        <p>Try changing your search or filter criteria.</p>
                      </EmptyState>
                    )}
                  </Box>
                ) : (
                  <>
                    <IndexTable
                      resourceName={resourceName}
                      itemCount={paginatedRules.length}
                      headings={[
                        { title: 'Rule Name' },
                        { title: 'Discount' },
                        { title: 'Customers' },
                        { title: 'Products' },
                        { title: 'Status' },
                        { title: 'Created' },
                        { title: 'Actions' },
                      ]}
                      selectable={false}
                    >
                      {rowMarkup}
                    </IndexTable>

                    <Box padding="400">
                      <BlockStack gap="200">
                        {totalPages > 1 && (
                          <InlineStack align="center" blockAlign="center">
                            <Pagination
                              hasPrevious={currentPage > 1}
                              hasNext={currentPage < totalPages}
                              onPrevious={() => setCurrentPage(currentPage - 1)}
                              onNext={() => setCurrentPage(currentPage + 1)}
                            />
                          </InlineStack>
                        )}
                        <InlineStack align="center" blockAlign="center">
                          <Text as="span" tone="subdued">
                            {startIndex + 1} to {Math.min(endIndex, filteredRules.length)} of {filteredRules.length} rules
                          </Text>
                        </InlineStack>
                      </BlockStack>
                    </Box>
                  </>
                )}
              </Tabs>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Box paddingBlockStart="400">
              <InlineStack align="center">
                <Text as="p" tone="subdued">
                  ©Copyright 2026 KISCIENCE TECHNOLOGIES PVT. LTD.
                </Text>
              </InlineStack>
            </Box>
          </Layout.Section>
        </Layout>

        {/* Delete Confirmation Modal */}
        <Modal
        limitHeight
          open={deleteModalActive}
          onClose={() => setDeleteModalActive(false)}
          title="Delete Pricing Rule"
          primaryAction={{
            content: 'Delete',
            destructive: true,
            onAction: handleDeleteConfirm,
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => setDeleteModalActive(false),
            },
          ]}
        >
          <Modal.Section>
            <TextContainer>
              <p>
                Are you sure you want to delete "{ruleToDelete?.name}"? This action cannot be undone.
              </p>
            </TextContainer>
          </Modal.Section>
        </Modal>

        {/* Segment Assignment Modal (list view) */}
        {showSegmentModal && (
          <DiscountSegmentModal
            isOpen={showSegmentModal}
            onClose={handleModalClose}
            shopifyDiscountId={modalDiscountId}
            discountTitle={modalDiscountTitle}
            segmentName={modalSegmentName}
            onSegmentAssigned={handleSegmentAssigned}
            ruleId={currentRuleId}
            shop={shop}
          />
        )}

        {/* Toast */}
        {toastActive && (
          <Toast
            content={toastMessage}
            error={toastError}
            onDismiss={() => setToastActive(false)}
            duration={3000}
          />
        )}
      </Page>
    </Frame>
  )
}

export default CustomPricingPage
