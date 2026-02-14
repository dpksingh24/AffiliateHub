import React, { useState, useEffect } from 'react';
import {
  Frame,
  Page,
  Card,
  IndexTable,
  useIndexResourceState,
  Spinner,
  EmptyState,
  InlineStack,
  BlockStack,
  Badge,
  Text,
  Pagination,
  Select,
  Box,
} from '@shopify/polaris';
import NavBar from './NavBar';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(amount, currency = 'USD') {
  if (amount == null) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(Number(amount));
}

function PayoutsPage({ shop }) {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchPayouts = async () => {
    if (!shop) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ shop, page: String(page), limit: String(limit) });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      const response = await fetch(`/api/admin/payouts?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setPayouts(data.payouts || []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 0);
      } else {
        setError(data.error || 'Failed to load payouts');
      }
    } catch (err) {
      setError(err.message || 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, [shop, page, statusFilter]);

  const statusOptions = [
    { label: 'All', value: 'all' },
    { label: 'Paid', value: 'paid' },
    { label: 'Processing', value: 'processing' },
    { label: 'Failed', value: 'failed' },
  ];

  const resourceName = { singular: 'payout', plural: 'payouts' };
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(payouts);

  const rowMarkup = payouts.map((payout, index) => (
    <IndexTable.Row
      id={payout.id || index}
      key={payout.id || index}
      selected={selectedResources.includes(payout.id)}
      position={index}
    >
      <IndexTable.Cell>{payout.payoutId ? payout.payoutId.slice(-8) : '—'}</IndexTable.Cell>
      <IndexTable.Cell>{formatCurrency(payout.amount, payout.currency)}</IndexTable.Cell>
      <IndexTable.Cell>{payout.affiliateName || '—'}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {Array.isArray(payout.referralIds) && payout.referralIds.length
            ? payout.referralIds.slice(0, 3).join(', ') + (payout.referralIds.length > 3 ? '…' : '')
            : '—'}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{payout.method || '—'}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={payout.status === 'paid' ? 'success' : payout.status === 'failed' ? 'critical' : 'attention'}>
          {payout.status || 'processing'}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>{formatDate(payout.paidAt || payout.createdAt)}</IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Frame>
      <NavBar />
      <Page
        title="Payouts"
        subtitle="Affiliate payout history. Use Pay Affiliates to create new payouts."
      >
        <BlockStack gap="400">
          <Card>
            <InlineStack align="start" blockAlign="center" gap="400" wrap={false}>
              <Select
                label="Status"
                options={statusOptions}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </InlineStack>
            <Box paddingBlockStart="400">
              {error && (
                <Box paddingBlockEnd="400">
                  <Text as="p" tone="critical">{error}</Text>
                </Box>
              )}
              {loading ? (
                <InlineStack align="center" blockAlign="center" gap="400">
                  <Spinner size="large" />
                  <Text as="span">Loading payouts…</Text>
                </InlineStack>
              ) : payouts.length === 0 ? (
                <EmptyState
                  heading="No payouts yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Payout records will appear here when you pay affiliates. Use Pay Affiliates to create a payout.</p>
                </EmptyState>
              ) : (
                <>
                  <IndexTable
                    resourceName={resourceName}
                    itemCount={payouts.length}
                    selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
                    onSelectionChange={handleSelectionChange}
                    headings={[
                      { title: 'Payout ID' },
                      { title: 'Amount' },
                      { title: 'Affiliate' },
                      { title: 'Referrals' },
                      { title: 'Method' },
                      { title: 'Status' },
                      { title: 'Date' },
                    ]}
                  >
                    {rowMarkup}
                  </IndexTable>
                  {totalPages > 1 && (
                    <Box paddingBlockStart="400">
                      <InlineStack align="center" blockAlign="center" gap="400">
                        <Text as="span" variant="bodySm" tone="subdued">
                          {total} item{total !== 1 ? 's' : ''}
                        </Text>
                        <Pagination
                          hasPrevious={page > 1}
                          onPrevious={() => setPage((p) => p - 1)}
                          hasNext={page < totalPages}
                          onNext={() => setPage((p) => p + 1)}
                          label={`Page ${page} of ${totalPages}`}
                        />
                      </InlineStack>
                    </Box>
                  )}
                </>
              )}
            </Box>
          </Card>
        </BlockStack>
      </Page>
    </Frame>
  );
}

export default PayoutsPage;
