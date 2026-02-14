/**
 * DiscountSegmentModal Component
 * Directly assigns customer segments to discounts via Shopify API
 * No manual steps required!
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Text,
  BlockStack,
  InlineStack,
  Banner,
  Spinner,
  Select,
  Button,
  Box,
  Icon,
  ChoiceList,
  TextField,
  Checkbox,
  Tag,
} from '@shopify/polaris';
import {
  CheckCircleIcon,
} from '@shopify/polaris-icons';
import {
  getCustomerSegmentsByRuleId,
  getAssignedSegmentByRuleId,
  assignSegmentToDiscount,
  removeSegmentFromDiscount,
} from '../../services/pricingApi';


const DiscountSegmentModal = ({
  isOpen,
  onClose,
  shopifyDiscountId,
  discountTitle,
  segmentName = 'Customer Segment',
  onSegmentAssigned,
  ruleId,

  shop
}) => {
  const [isAssigning, setIsAssigning] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [segments, setSegments] = useState([]);
  const [assignedSegments, setAssignedSegments] = useState([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] = useState('');
  const [segmentsError, setSegmentsError] = useState(null);
  const [assignError, setAssignError] = useState(null);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [alreadyAssignedSegment, setAlreadyAssignedSegment] = useState(null);
  // Minimum purchase & combinations (match Shopify discount page)
  const [minimumType, setMinimumType] = useState('none');
  const [minimumQuantity, setMinimumQuantity] = useState('1');
  const [minimumAmount, setMinimumAmount] = useState('');
  const [minimumCurrency, setMinimumCurrency] = useState('GBP');
  const [combinesProduct, setCombinesProduct] = useState(true);
  const [combinesOrder, setCombinesOrder] = useState(false);
  const [combinesShipping, setCombinesShipping] = useState(false);

  useEffect(() => {
    if (!isOpen || !ruleId) return;
  
    const fetchSegmentsAndAssignment = async () => {
      setSegmentsLoading(true);
      setSegmentsError(null);
      setAlreadyAssignedSegment(null);
  
      try {
        const [segmentsRes, assignmentRes] = await Promise.all([
          getCustomerSegmentsByRuleId(ruleId),
          getAssignedSegmentByRuleId(ruleId),
        ]);
        const list = segmentsRes?.segments || [];
        setSegments(list);
  
        const assigned = assignmentRes?.assignedSegments || [];
        const segmentAssigned = assignmentRes?.segmentAssigned && assigned.length > 0;
        setAssignedSegments(assigned);
        if (segmentAssigned) {
          const firstAssigned = assigned[0];
          setAlreadyAssignedSegment(firstAssigned);
          const inList = list.some((s) => s.id === firstAssigned.id);
          if (inList) {
            setSelectedSegmentId(firstAssigned.id);
          } else if (list.length > 0) {
            setSelectedSegmentId(list[0].id);
          }
        } else if (list.length > 0) {
          setSelectedSegmentId(list[0].id);
        }
      } catch (err) {
        setSegmentsError(err.message || 'Could not load customer segments');
        setSegments([]);
      } finally {
        setSegmentsLoading(false);
      }
    };
  
    fetchSegmentsAndAssignment();
  }, [isOpen, ruleId]);
  
  

  const handleSegmentChange = (value) => {
    setSelectedSegmentId(value);
    setAssignError(null);
    setAssignSuccess(false);
  };

  const handleAssignSegment = async () => {
    if (!selectedSegmentId) {
      setAssignError('Please select a customer segment');
      return;
    }

    if (!shopifyDiscountId) {
      setAssignError('Discount ID is missing. Please save the pricing rule first.');
      return;
    }

    try {
      setIsAssigning(true);
      setAssignError(null);
      setAssignSuccess(false);

      const minimumRequirement =
        minimumType === 'quantity'
          ? { type: 'quantity', quantity: parseInt(minimumQuantity, 10) || 1 }
          : minimumType === 'subtotal' && minimumAmount
            ? { type: 'subtotal', amount: parseFloat(minimumAmount), currencyCode: minimumCurrency }
            : { type: 'none' };
      const combinesWith = {
        productDiscounts: combinesProduct,
        orderDiscounts: combinesOrder,
        shippingDiscounts: combinesShipping,
      };

      const response = await assignSegmentToDiscount({
        discountId: shopifyDiscountId,
        segmentId: selectedSegmentId,
        minimumRequirement,
        combinesWith,
      });

      if (response.success) {
        setAssignSuccess(true);
        
        // Wait a moment to show success message
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        // Callback to parent
        if (onSegmentAssigned) {
          await onSegmentAssigned();
        }
        
        // Close modal
        setTimeout(() => {
          onClose();
        }, 500);
      } else {
        throw new Error(response.error || 'Failed to assign segment');
      }

    } catch (error) {
      console.error('Error assigning segment:', error);
      setAssignError(error.message || 'Failed to assign segment to discount');
      setAssignSuccess(false);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const handleRemoveSegment = async (segmentIdToRemove) => {
    if (!shopifyDiscountId || !segmentIdToRemove) return;
    console.log('[App] Remove segment: request', { discountId: shopifyDiscountId, segmentId: segmentIdToRemove });
    setIsRemoving(true);
    setAssignError(null);
    try {
      const response = await removeSegmentFromDiscount({
        discountId: shopifyDiscountId,
        segmentId: segmentIdToRemove,
      });
      if (response.success) {
        console.log('[App] Remove segment: success — removed in app and store discount');
        setAssignedSegments((prev) => prev.filter((s) => s.id !== segmentIdToRemove));
        setAlreadyAssignedSegment((prev) => (prev?.id === segmentIdToRemove ? null : prev));
        if (onSegmentAssigned) await onSegmentAssigned();
      } else {
        throw new Error(response.error || 'Failed to remove segment');
      }
    } catch (err) {
      console.error('[App] Remove segment: error', err);
      setAssignError(err.message || 'Failed to remove segment from discount');
    } finally {
      setIsRemoving(false);
    }
  };

  const segmentOptions = [
    { label: '— Select a customer segment —', value: '' },
    ...segments.map((s) => ({ label: s.name, value: s.id }))
  ];

  const selectedSegmentName = segments.find(s => s.id === selectedSegmentId)?.name || segmentName;

  return (
    <Modal
      open={isOpen}
      onClose={handleCancel}
      limitHeight
      title={`Assign Customer Segment — ${discountTitle || 'Discount'}`}
      primaryAction={{ 
        content: assignSuccess ? 'Done' : 'Assign Segment', 
        onAction: assignSuccess ? onClose : handleAssignSegment, 
        loading: isAssigning,
        disabled: !selectedSegmentId || segmentsLoading || isRemoving
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: handleCancel,
          disabled: isAssigning,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Success Message */}
          {assignSuccess && (
            <Banner tone="success">
              <InlineStack gap="200" blockAlign="center">
                <Icon source={CheckCircleIcon} tone="success" />
                <Text variant="bodyMd" fontWeight="semibold">
                  Customer segment assigned successfully!
                </Text>
              </InlineStack>
            </Banner>
          )}

          {/* Error Banners */}
          {segmentsError && (
            <Banner tone="critical" onDismiss={() => setSegmentsError(null)}>
              <BlockStack gap="100">
                <Text variant="bodyMd" fontWeight="semibold">Error loading segments</Text>
                <Text variant="bodySm">{segmentsError}</Text>
              </BlockStack>
            </Banner>
          )}

          {assignError && (
            <Banner tone="critical" onDismiss={() => setAssignError(null)}>
              <BlockStack gap="100">
                <Text variant="bodyMd" fontWeight="semibold">Error assigning segment</Text>
                <Text variant="bodySm">{assignError}</Text>
              </BlockStack>
            </Banner>
          )}

          {/* Already assigned segment (single) - legacy banner */}
          {alreadyAssignedSegment && !assignSuccess && assignedSegments.length <= 1 && (
            <Banner tone="success" onDismiss={() => setAlreadyAssignedSegment(null)}>
              <Text variant="bodyMd" fontWeight="semibold">
                This discount is already assigned to: <strong>{alreadyAssignedSegment.name}</strong>. You can change the segment below or click Assign Segment to confirm.
              </Text>
            </Banner>
          )}

          {/* Assigned segments list with Remove */}
          {assignedSegments.length > 0 && !assignSuccess && (
            <BlockStack gap="200">
              <Text variant="headingMd">Assigned segments</Text>
              <Text variant="bodySm" tone="subdued">
                These segments are currently eligible for this discount. Remove any segment below to unlink it from the store discount.
              </Text>
              <InlineStack gap="200" wrap>
                {assignedSegments.map((seg) => (
                  <Tag
                    key={seg.id}
                    onRemove={isRemoving ? undefined : () => handleRemoveSegment(seg.id)}
                  >
                    {seg.name || seg.id}
                  </Tag>
                ))}
              </InlineStack>
            </BlockStack>
          )}

          {/* Info Banner */}
          {!assignSuccess && !alreadyAssignedSegment && (
            <Banner tone="info">
              <BlockStack gap="200">
                <Text variant="bodyMd" fontWeight="semibold">
                  Assign a customer segment to this discount
                </Text>
                <Text variant="bodySm">
                  Select which customer segment should be eligible for this discount. 
                  Only customers in the selected segment will see the discounted prices.
                </Text>
              </BlockStack>
            </Banner>
          )}

          {/* No segments warning */}
          {segments.length === 0 && !segmentsLoading && (
            <Banner tone="warning">
              <BlockStack gap="200">
                <Text variant="bodyMd" fontWeight="semibold">
                  No customer segments found
                </Text>
                <Text variant="bodySm">
                  You need to create customer segments in Shopify Admin first.
                  Go to Shopify Admin → Customers → Segments to create one.
                </Text>
              </BlockStack>
            </Banner>
          )}

          {/* Segment Selection */}
          {!assignSuccess && (
            <BlockStack gap="400">
              <Text variant="headingMd">Select Customer Segment</Text>
              
              {segmentsLoading ? (
                <Box padding="400">
                  <InlineStack align="center" blockAlign="center" gap="300">
                    <Spinner size="small" />
                    <Text variant="bodySm" tone="subdued">Loading customer segments...</Text>
                  </InlineStack>
                </Box>
              ) : (
                <BlockStack gap="300">
                  <Select
                    label="Customer segment"
                    options={segmentOptions}
                    value={selectedSegmentId}
                    onChange={handleSegmentChange}
                    disabled={segmentsLoading || segments.length === 0 || isAssigning}
                    placeholder="Select a customer segment"
                    helpText={
                      selectedSegmentId
                        ? `Selected: ${selectedSegmentName}`
                        : 'Choose a segment to assign'
                    }
                  />
                  <InlineStack align="start">
                    <Button
                      onClick={async () => {
                        if (!ruleId) return;
                        setSegmentsLoading(true);
                        setSegmentsError(null);
                        try {
                          const res = await getCustomerSegmentsByRuleId(ruleId);
                          setSegments(res?.segments || []);
                        } catch (err) {
                          setSegmentsError(err.message || 'Could not refresh customer segments');
                        } finally {
                          setSegmentsLoading(false);
                        }
                      }}
                      loading={segmentsLoading}
                      disabled={segmentsLoading || isAssigning}
                    >
                      Refresh Segments
                    </Button>
                  </InlineStack>
                </BlockStack>
              )}

              {/* Minimum purchase requirements */}
              <BlockStack gap="200">
                <Text variant="headingMd">Minimum purchase requirements</Text>
                <ChoiceList
                  title=""
                  titleHidden
                  choices={[
                    { label: 'No minimum requirements', value: 'none' },
                    { label: 'Minimum quantity of items', value: 'quantity' },
                    { label: 'Minimum purchase amount (£)', value: 'subtotal' },
                  ]}
                  selected={[minimumType]}
                  onChange={(v) => setMinimumType(v[0] || 'none')}
                />
                {minimumType === 'quantity' && (
                  <Box paddingBlockStart="200">
                    <TextField
                      label="Quantity"
                      type="number"
                      min={1}
                      value={minimumQuantity}
                      onChange={setMinimumQuantity}
                      autoComplete="off"
                    />
                  </Box>
                )}
                {minimumType === 'subtotal' && (
                  <InlineStack gap="300" blockAlign="end">
                    <Box minWidth="120px">
                      <TextField
                        label="Amount"
                        type="number"
                        min={0}
                        step={0.01}
                        value={minimumAmount}
                        onChange={setMinimumAmount}
                        prefix="£"
                        autoComplete="off"
                      />
                    </Box>
                    <Box minWidth="100px">
                      <TextField
                        label="Currency"
                        value={minimumCurrency}
                        onChange={setMinimumCurrency}
                        autoComplete="off"
                      />
                    </Box>
                  </InlineStack>
                )}
              </BlockStack>

              {/* Combinations */}
              <BlockStack gap="200">
                <Text variant="headingMd">Combinations</Text>
                <Text variant="bodySm" tone="subdued">
                  Each eligible item may receive up to one product discount. Choose which other discount types this discount can combine with at checkout.
                </Text>
                <BlockStack gap="100">
                  <Checkbox
                    label="Product discounts"
                    checked={combinesProduct}
                    onChange={setCombinesProduct}
                  />
                  <Checkbox
                    label="Order discounts"
                    checked={combinesOrder}
                    onChange={setCombinesOrder}
                  />
                  <Checkbox
                    label="Shipping discounts"
                    checked={combinesShipping}
                    onChange={setCombinesShipping}
                  />
                </BlockStack>
              </BlockStack>

              {/* Preview */}
              {selectedSegmentId && !assignSuccess && (
                <Box
                  background="bg-surface-secondary"
                  padding="400"
                  borderRadius="200"
                >
                  <BlockStack gap="200">
                    <Text variant="headingSm">Preview</Text>
                    <Text variant="bodySm">
                      Discount: <strong>{discountTitle}</strong>
                    </Text>
                    <Text variant="bodySm">
                      Will be available to: <strong>{selectedSegmentName}</strong>
                    </Text>
                  </BlockStack>
                </Box>
              )}
            </BlockStack>
          )}

          {/* Success state */}
          {assignSuccess && (
            <Box
              background="bg-surface-success"
              padding="400"
              borderRadius="200"
            >
              <BlockStack gap="300" inlineAlign="center">
                <Icon source={CheckCircleIcon} tone="success" />
                <BlockStack gap="100" inlineAlign="center">
                  <Text variant="headingMd" alignment="center">
                    Segment Assigned Successfully!
                  </Text>
                  <Text variant="bodySm" tone="subdued" alignment="center">
                    The discount "{discountTitle}" is now available to customers in the "{selectedSegmentName}" segment.
                  </Text>
                </BlockStack>
              </BlockStack>
            </Box>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
};

export default DiscountSegmentModal;