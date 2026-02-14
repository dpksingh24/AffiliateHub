import React, { useState, useEffect, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Frame,
  Page,
  LegacyCard,
  IndexTable,
  useBreakpoints,
  Spinner,
  EmptyState,
  InlineStack,
  BlockStack,
  Badge,
  Text,
  Box,
  Pagination,
  Button,
  Modal,
  Divider,
} from '@shopify/polaris';
import { ViewIcon } from '@shopify/polaris-icons';
import NavBar from './NavBar';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit' });
}

function formatProductsPurchased(str, maxProducts = 2) {
  if (!str || typeof str !== 'string') return '—';
  const trimmed = str.trim();
  if (!trimmed) return '—';
  const parts = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length <= maxProducts) return trimmed;
  return parts.slice(0, maxProducts).join(', ') + ' …';
}

function VisitsPage({ shop }) {
  const breakpoints = useBreakpoints();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [modalVisit, setModalVisit] = useState(null);
  const shopParam = shop ? `?shop=${encodeURIComponent(shop)}` : '';

  const fetchVisits = useCallback(async () => {
    if (!shop) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ shop, page: String(page), limit: String(limit) });
      const response = await fetch(`/api/admin/visits?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setVisits(data.visits || []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 0);
      } else {
        setError(data.error || 'Failed to load visits');
      }
    } catch (err) {
      setError(err.message || 'Failed to load visits');
    } finally {
      setLoading(false);
    }
  }, [shop, page, limit]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  const rowMarkup = visits.map((visit, index) => (
    <IndexTable.Row id={visit.visitId || index} key={visit.visitId || index} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span" title={visit.visitId || ''}>
          {visit.visitId || '—'}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" title={visit.productPurchased || ''}>
          {formatProductsPurchased(visit.productPurchased)}
        </Text>
      </IndexTable.Cell>
      {/* <IndexTable.Cell>
        <Text as="span" variant="bodyMd" breakWord>
          {visit.referringUrl && visit.referringUrl.length > 50
            ? `${visit.referringUrl.slice(0, 47)}…`
            : visit.referringUrl || '—'}
        </Text>
      </IndexTable.Cell> */}
      <IndexTable.Cell>
        <Badge tone={visit.converted ? 'success' : 'default'}>
          {visit.converted ? 'Yes' : 'No'}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {formatDate(visit.date)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button
          variant="plain"
          icon={ViewIcon}
          accessibilityLabel="View visit details"
          onClick={() => setModalVisit(visit)}
        />
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Frame>
      <NavBar />
      <Page
        title="Visits"
        subtitle="All referral link clicks. Use the view action to see full details (IP, referral, affiliate)."
      >
        <BlockStack gap="400">
          <LegacyCard>
            {error && (
              <Box padding="400">
                <Text as="p" tone="critical">{error}</Text>
              </Box>
            )}
            {loading ? (
              <Box padding="800">
                <InlineStack align="center" blockAlign="center" gap="400">
                  <Spinner size="large" />
                  <Text as="span">Loading visits…</Text>
                </InlineStack>
              </Box>
            ) : visits.length === 0 ? (
              <Box padding="800">
                <EmptyState
                  heading="No visits yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Visits (referral link clicks) will appear here when customers use affiliate links.</p>
                </EmptyState>
              </Box>
            ) : (
              <>
                <IndexTable
                  condensed={breakpoints.smDown}
                  resourceName={{ singular: 'visit', plural: 'visits' }}
                  itemCount={visits.length}
                  headings={[
                    { title: 'Visit ID' },
                    { title: 'Product(s) purchased' },
                    // { title: 'Referring URL' },
                    { title: 'Converted' },
                    { title: 'Date' },
                    { title: 'Actions' },
                  ]}
                  selectable={false}
                >
                  {rowMarkup}
                </IndexTable>
                {totalPages > 1 && (
                  <Box paddingBlockStart="400" paddingBlockEnd="400">
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
          </LegacyCard>

          {modalVisit && (
            <Modal
              open={!!modalVisit}
              onClose={() => setModalVisit(null)}
              title="Visit details"
              limitHeight
              primaryAction={{
                content: 'Close',
                onAction: () => setModalVisit(null),
              }}
            >
              <Modal.Section>
                <BlockStack gap="400">
                  {/* Visit info */}
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingSm">Visit</Text>
                    <Box paddingBlockStart="100">
                      <BlockStack gap="200">
                        <InlineStack gap="400" blockAlign="start" wrap={false}>
                          <Box minWidth="120px">
                            <Text as="span" variant="bodySm" fontWeight="medium" tone="subdued">Visit ID</Text>
                          </Box>
                          <Text as="span" variant="bodyMd" breakWord>{modalVisit.visitId || '—'}</Text>
                        </InlineStack>
                        <InlineStack gap="400" blockAlign="start" wrap={false}>
                          <Box minWidth="120px">
                            <Text as="span" variant="bodySm" fontWeight="medium" tone="subdued">Date</Text>
                          </Box>
                          <Text as="span" variant="bodyMd">{formatDate(modalVisit.date)}</Text>
                        </InlineStack>
                        <InlineStack gap="400" blockAlign="start" wrap={false}>
                          <Box minWidth="120px">
                            <Text as="span" variant="bodySm" fontWeight="medium" tone="subdued">Referring URL</Text>
                          </Box>
                          <Text as="span" variant="bodyMd" breakWord>{modalVisit.referringUrl || '—'}</Text>
                        </InlineStack>
                        <InlineStack gap="400" blockAlign="start" wrap={false}>
                          <Box minWidth="120px">
                            <Text as="span" variant="bodySm" fontWeight="medium" tone="subdued">IP address</Text>
                          </Box>
                          <Text as="span" variant="bodyMd">{modalVisit.ipAddress || '—'}</Text>
                        </InlineStack>
                      </BlockStack>
                    </Box>
                  </BlockStack>

                  <Divider />

                  {/* Conversion */}
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingSm">Conversion</Text>
                    <Box paddingBlockStart="100">
                      <BlockStack gap="200">
                        <InlineStack gap="400" blockAlign="start" wrap={false}>
                          <Box minWidth="120px">
                            <Text as="span" variant="bodySm" fontWeight="medium" tone="subdued">Status</Text>
                          </Box>
                          <Badge tone={modalVisit.converted ? 'success' : 'default'}>
                            {modalVisit.converted ? 'Yes' : 'No'}
                          </Badge>
                        </InlineStack>
                        <InlineStack gap="400" blockAlign="start" wrap={false}>
                          <Box minWidth="120px">
                            <Text as="span" variant="bodySm" fontWeight="medium" tone="subdued">Product(s) purchased</Text>
                          </Box>
                          <Text as="span" variant="bodyMd" breakWord>{modalVisit.productPurchased || '—'}</Text>
                        </InlineStack>
                      </BlockStack>
                    </Box>
                  </BlockStack>

                  <Divider />

                  {/* Attribution */}
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingSm">Attribution</Text>
                    <Box paddingBlockStart="100">
                      <BlockStack gap="200">
                        <InlineStack gap="400" blockAlign="start" wrap={false}>
                          <Box minWidth="120px">
                            <Text as="span" variant="bodySm" fontWeight="medium" tone="subdued">Short code</Text>
                          </Box>
                          <Text as="span" variant="bodyMd">{modalVisit.shortCode || '—'}</Text>
                        </InlineStack>
                        <InlineStack gap="400" blockAlign="start" wrap={false}>
                          <Box minWidth="120px">
                            <Text as="span" variant="bodySm" fontWeight="medium" tone="subdued">Referral</Text>
                          </Box>
                          {modalVisit.referralId ? (
                            <RouterLink
                              to={`/referrals/${modalVisit.referralId}${shopParam}`}
                              style={{ color: '#2B7BE5', textDecoration: 'none' }}
                              onClick={() => setModalVisit(null)}
                            >
                              {modalVisit.referralId}
                            </RouterLink>
                          ) : (
                            <Text as="span" variant="bodyMd" tone="subdued">—</Text>
                          )}
                        </InlineStack>
                        <InlineStack gap="400" blockAlign="start" wrap={false}>
                          <Box minWidth="120px">
                            <Text as="span" variant="bodySm" fontWeight="medium" tone="subdued">Affiliate</Text>
                          </Box>
                          {modalVisit.affiliateId ? (
                            <RouterLink
                              to={`/affiliates/${modalVisit.affiliateId}${shopParam}`}
                              style={{ color: '#2B7BE5', textDecoration: 'none' }}
                              onClick={() => setModalVisit(null)}
                            >
                              {modalVisit.affiliateName || '—'}
                            </RouterLink>
                          ) : (
                            <Text as="span" variant="bodyMd" tone="subdued">{modalVisit.affiliateName || '—'}</Text>
                          )}
                        </InlineStack>
                      </BlockStack>
                    </Box>
                  </BlockStack>

                  <Divider />

                  {/* Full JSON */}
                  {/* <BlockStack gap="200">
                    <Text as="h2" variant="headingSm">Raw data (JSON)</Text>
                    <Box padding="200">
                      <div
                        style={{
                          maxHeight: '280px',
                          overflow: 'auto',
                          padding: '12px',
                          backgroundColor: 'var(--p-color-bg-surface-secondary, #f6f6f7)',
                          borderRadius: '8px',
                        }}
                      >
                        <pre
                          style={{
                            margin: 0,
                            fontSize: '12px',
                            lineHeight: 1.4,
                            fontFamily: 'ui-monospace, monospace',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {JSON.stringify(modalVisit, null, 2)}
                        </pre>
                      </div>
                    </Box>
                  </BlockStack> */}

                </BlockStack>
              </Modal.Section>
            </Modal>
          )}
        </BlockStack>
      </Page>
    </Frame>
  );
}

export default VisitsPage;
