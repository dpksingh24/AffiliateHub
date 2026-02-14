import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Frame,
  Page,
  LegacyCard,
  IndexTable,
  IndexFilters,
  useSetIndexFiltersMode,
  useBreakpoints,
  Spinner,
  EmptyState,
  InlineStack,
  BlockStack,
  Text,
  ChoiceList,
  Box,
  Button,
  TextField,
} from '@shopify/polaris';
import NavBar from './NavBar';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit' });
}

function formatCurrency(amount, currency = 'USD') {
  if (amount == null) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(Number(amount));
}

function disambiguateLabel(key, value) {
  switch (key) {
    case 'status':
      return (Array.isArray(value) ? value : [value]).map((v) => v.charAt(0).toUpperCase() + (v || '').slice(1)).join(', ');
    default:
      return Array.isArray(value) ? value.join(', ') : String(value ?? '');
  }
}

const STATUS_CHOICES = [
  { label: 'Unpaid', value: 'unpaid' },
  { label: 'Paid', value: 'paid' },
  { label: 'Rejected', value: 'rejected' },
];

function ReferralsPage({ shop }) {
  const navigate = useNavigate();
  const breakpoints = useBreakpoints();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [queryValue, setQueryValue] = useState('');
  const { mode, setMode } = useSetIndexFiltersMode();
  const shopParam = shop ? `?shop=${encodeURIComponent(shop)}` : '';

  const tabs = [
    { content: 'All', index: 0, onAction: () => {}, id: 'all', isLocked: true, actions: [] },
    { content: 'Unpaid', index: 1, onAction: () => {}, id: 'unpaid', isLocked: false, actions: [] },
    { content: 'Paid', index: 2, onAction: () => {}, id: 'paid', isLocked: false, actions: [] },
    { content: 'Rejected', index: 3, onAction: () => {}, id: 'rejected', isLocked: false, actions: [] },
  ];

  const effectiveStatusForApi = selectedTab === 0 ? statusFilter : [tabs[selectedTab].id];

  const fetchReferrals = useCallback(async () => {
    if (!shop) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ shop });
      if (effectiveStatusForApi.length === 1) params.set('status', effectiveStatusForApi[0]);
      const response = await fetch(`/api/admin/referrals/by-affiliate?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setGroups(data.groups || []);
      } else {
        setError(data.error || 'Failed to load referrals');
      }
    } catch (err) {
      setError(err.message || 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  }, [shop, selectedTab, statusFilter]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const handleStatusChange = useCallback((value) => setStatusFilter(value), []);
  const handleStatusRemove = useCallback(() => setStatusFilter([]), []);
  const handleQueryChange = useCallback((value) => setQueryValue(value), []);
  const handleQueryClear = useCallback(() => setQueryValue(''), []);
  const handleClearAll = useCallback(() => {
    setStatusFilter([]);
    setQueryValue('');
  }, []);

  const searchQuery = (queryValue || '').trim().toLowerCase();
  const filteredGroups = searchQuery
    ? groups.filter((g) => (g.affiliateName || '').toLowerCase().includes(searchQuery) || (g.affiliateEmail || '').toLowerCase().includes(searchQuery))
    : groups;

  const appliedFilters = [];
  if (statusFilter.length > 0) {
    appliedFilters.push({
      key: 'status',
      label: disambiguateLabel('status', statusFilter),
      onRemove: handleStatusRemove,
    });
  }

  const filters = [
    {
      key: 'status',
      label: 'Status',
      pinned: true,
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          choices={STATUS_CHOICES}
          selected={statusFilter}
          onChange={handleStatusChange}
          allowMultiple
        />
      ),
      shortcut: true,
    },
  ];

  const resourceName = { singular: 'affiliate', plural: 'affiliates' };

  const viewAffiliateReferrals = (group, e) => {
    if (e) e.stopPropagation();
    navigate(`/referrals/affiliate/${group.affiliateId}${shopParam}`);
  };

  const getStatusSummary = (group) => {
    const { unpaidCount, paidCount, rejectedCount } = group;
    const parts = [];
    if (unpaidCount > 0) parts.push(`${unpaidCount} Unpaid`);
    if (paidCount > 0) parts.push(`${paidCount} Paid`);
    if (rejectedCount > 0) parts.push(`${rejectedCount} Rejected`);
    return parts.length ? parts.join(', ') : '—';
  };

  return (
    <Frame>
      <NavBar />
      <Page
        title="Referrals"
        subtitle="Earnings grouped by affiliate. Click an affiliate row or “View referral details” to see orders and mark as paid."
      >
        <BlockStack gap="400">
          <Box paddingBlockEnd="200">
            <TextField
              label="Search referrals"
              labelHidden
              value={queryValue}
              onChange={handleQueryChange}
              placeholder="Search by affiliate name or email"
              clearButton
              onClearButtonClick={handleQueryClear}
              autoComplete="off"
            />
          </Box>
          <LegacyCard>
            <IndexFilters
              queryValue={queryValue}
              queryPlaceholder="Search by affiliate name or email"
              onQueryChange={handleQueryChange}
              onQueryClear={handleQueryClear}
              hideQueryField
              hideFilters
              tabs={tabs}
              selected={selectedTab}
              onSelect={setSelectedTab}
              canCreateNewView={false}
              filters={filters}
              appliedFilters={appliedFilters}
              onClearAll={handleClearAll}
              mode={mode}
              setMode={setMode}
            />
            {error && (
              <Box padding="400">
                <Text as="p" tone="critical">{error}</Text>
              </Box>
            )}
            {loading ? (
              <Box padding="800">
                <InlineStack align="center" blockAlign="center" gap="400">
                  <Spinner size="large" />
                  <Text as="span">Loading referrals…</Text>
                </InlineStack>
              </Box>
            ) : groups.length === 0 ? (
              <Box padding="800">
                <EmptyState
                  heading="No referrals yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Referrals will appear here when customers place orders through affiliate links.</p>
                </EmptyState>
              </Box>
            ) : filteredGroups.length === 0 ? (
              <Box padding="800">
                <EmptyState
                  heading="No results for your search"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Try a different search term or clear the search.</p>
                </EmptyState>
              </Box>
            ) : (
              <IndexTable
                condensed={breakpoints.smDown}
                resourceName={resourceName}
                itemCount={filteredGroups.length}
                headings={[
                  { title: 'Affiliate' },
                  { title: 'Total amount', alignment: 'end' },
                  { title: 'Orders', alignment: 'end' },
                  { title: 'Status' },
                  { title: 'Actions' },
                ]}
              >
                {filteredGroups.map((group, index) => (
                  <IndexTable.Row
                    id={group.affiliateId || index}
                    key={group.affiliateId || index}
                    position={index}
                    onClick={(e) => viewAffiliateReferrals(group, e)}
                    selectable={false}
                  >
                    <IndexTable.Cell>
                      <Button
                        variant="plain"
                        onClick={(e) => { e.stopPropagation(); navigate(`/affiliates/${group.affiliateId}${shopParam}`); }}
                        style={{ color: '#2B7BE5', fontWeight: 600, padding: 0, minHeight: 'unset' }}
                      >
                        {group.affiliateName || '—'}
                      </Button>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" alignment="end" numeric>
                        {formatCurrency(group.totalAmount, group.currency)}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" numeric>{group.referralCount}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" variant="bodySm" tone="subdued">{getStatusSummary(group)}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Button
                        variant="primary"
                        size="slim"
                        onClick={(e) => viewAffiliateReferrals(group, e)}
                      >
                        View referral details
                      </Button>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            )}
          </LegacyCard>
        </BlockStack>
      </Page>
    </Frame>
  );
}

export default ReferralsPage;
