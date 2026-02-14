import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Frame,
  Page,
  LegacyCard,
  IndexTable,
  IndexFilters,
  useSetIndexFiltersMode,
  useIndexResourceState,
  useBreakpoints,
  Spinner,
  EmptyState,
  InlineStack,
  BlockStack,
  Badge,
  Text,
  ChoiceList,
  Box,
  Button,
  Pagination,
} from '@shopify/polaris';
import { ViewIcon } from '@shopify/polaris-icons';
import NavBar from './NavBar';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(amount, currency = 'USD') {
  if (amount == null) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(Number(amount));
}

function isEmpty(value) {
  if (Array.isArray(value)) return value.length === 0;
  return value === '' || value == null;
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
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

function AffiliatesPage({ shop }) {
  const navigate = useNavigate();
  const breakpoints = useBreakpoints();
  const [affiliates, setAffiliates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [queryValue, setQueryValue] = useState('');
  const [searchParam, setSearchParam] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [sortSelected] = useState(['joined desc']);
  const [selectedTab, setSelectedTab] = useState(0);
  const { mode, setMode } = useSetIndexFiltersMode();

  const tabs = [
    { content: 'All', index: 0, onAction: () => {}, id: 'all', isLocked: true, actions: [] },
    { content: 'Active', index: 1, onAction: () => {}, id: 'active', isLocked: false, actions: [] },
    { content: 'Inactive', index: 2, onAction: () => {}, id: 'inactive', isLocked: false, actions: [] },
  ];

  useEffect(() => {
    const t = setTimeout(() => setSearchParam(queryValue), 300);
    return () => clearTimeout(t);
  }, [queryValue]);

  const effectiveStatusForApi = selectedTab === 0 ? statusFilter : [tabs[selectedTab].id];

  const fetchAffiliates = useCallback(async () => {
    if (!shop) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ shop, page: String(page), limit: String(limit) });
      if (searchParam.trim()) params.set('search', searchParam.trim());
      if (effectiveStatusForApi.length === 1) params.set('status', effectiveStatusForApi[0]);
      if (sortSelected.length) params.set('sort', sortSelected[0]);
      const response = await fetch(`/api/admin/affiliates?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setAffiliates(data.affiliates || []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 0);
      } else {
        setError(data.error || 'Failed to load affiliates');
      }
    } catch (err) {
      setError(err.message || 'Failed to load affiliates');
    } finally {
      setLoading(false);
    }
  }, [shop, page, limit, searchParam, selectedTab, statusFilter, sortSelected]);

  useEffect(() => {
    fetchAffiliates();
  }, [fetchAffiliates]);

  const handleStatusChange = useCallback((value) => setStatusFilter(value), []);
  const handleStatusRemove = useCallback(() => setStatusFilter([]), []);
  const handleQueryChange = useCallback((value) => setQueryValue(value), []);
  const handleQueryClear = useCallback(() => {
    setQueryValue('');
    setSearchParam('');
  }, []);
  const handleClearAll = useCallback(() => {
    setStatusFilter([]);
    setQueryValue('');
    setSearchParam('');
  }, []);

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
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(affiliates);

  const viewAffiliate = (aff, e) => {
    if (e) e.stopPropagation();
    const shopParam = shop ? `?shop=${encodeURIComponent(shop)}` : '';
    navigate(`/affiliates/${aff.id}${shopParam}`);
  };

  const displayStatus = (status) => ((status || '').toLowerCase() === 'active' ? 'Active' : 'Inactive');
  const getStatusBadgeTone = (status) => ((status || '').toLowerCase() === 'active' ? 'success' : 'critical');

  const rowMarkup = affiliates.map((aff, index) => (
    <IndexTable.Row
      id={aff.id || index}
      key={aff.id || index}
      selected={selectedResources.includes(aff.id)}
      position={index}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {aff.fullName || '—'}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{aff.email || '—'}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={getStatusBadgeTone(aff.status)}>{displayStatus(aff.status)}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" alignment="end" numeric>
          {formatCurrency(aff.earningsPaid, aff.currency)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" alignment="end" numeric>
          {formatCurrency(aff.earningsPending, aff.currency)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" alignment="end" numeric>
          {aff.paidReferralCount ?? 0}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" alignment="end" numeric>
          {aff.visitsCount ?? 0}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button
          variant="plain"
          icon={ViewIcon}
          accessibilityLabel="View full details"
          onClick={(e) => viewAffiliate(aff, e)}
        />
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Frame>
      <NavBar />
      <Page
        title="Affiliates"
        subtitle="All affiliate users with earnings, referral links, and visit stats."
      >
        <BlockStack gap="400">
          <LegacyCard>
            <IndexFilters
              queryValue={queryValue}
              queryPlaceholder="Search affiliates by name or email"
              onQueryChange={handleQueryChange}
              onQueryClear={handleQueryClear}
              hideQueryField /* search bar commented out */
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
                  <Text as="span">Loading affiliates…</Text>
                </InlineStack>
              </Box>
            ) : affiliates.length === 0 ? (
              <Box padding="800">
                <EmptyState
                  heading="No affiliates yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Affiliates will appear here after they apply and are approved via the affiliate form.</p>
                </EmptyState>
              </Box>
            ) : (
              <>
                <IndexTable
                  condensed={breakpoints.smDown}
                  resourceName={resourceName}
                  itemCount={affiliates.length}
                  selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
                  onSelectionChange={handleSelectionChange}
                  headings={[
                    { title: 'Full Name' },
                    { title: 'Email' },
                    { title: 'Status' },
                    { title: 'Paid Earnings', alignment: 'end' },
                    { title: 'Unpaid Earnings', alignment: 'end' },
                    { title: 'Paid Referrals', alignment: 'end' },
                    { title: 'Visits', alignment: 'end' },
                    { title: 'Actions' },
                  ]}
                >
                  {rowMarkup}
                </IndexTable>
                {totalPages > 1 && (
                  <Box paddingBlockStart="400" paddingBlockEnd="400">
                    <InlineStack align="center" blockAlign="center" gap="400">
                      <Text as="span" variant="bodySm" tone="subdued">
                        {total} affiliate{total !== 1 ? 's' : ''}
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
          </LegacyCard>
        </BlockStack>
      </Page>
    </Frame>
  );
}

export default AffiliatesPage;
