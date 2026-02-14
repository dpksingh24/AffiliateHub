import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Frame,
  Page,
  LegacyCard,
  IndexTable,
  Badge,
  Text,
  Box,
  Spinner,
  Banner,
  Button,
  InlineStack,
  BlockStack,
  Modal,
  Select,
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

function getStatusBadgeTone(status) {
  const s = (status || '').toLowerCase();
  if (s === 'paid') return 'success';
  if (s === 'rejected') return 'critical';
  return 'attention';
}

function AffiliateReferralsDetailPage({ shop }) {
  const { affiliateId } = useParams();
  const navigate = useNavigate();
  const [referrals, setReferrals] = useState([]);
  const [affiliateName, setAffiliateName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmMarkAllPaidOpen, setConfirmMarkAllPaidOpen] = useState(false);
  const [markMonthPaidOpen, setMarkMonthPaidOpen] = useState(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);

  const shopParam = shop ? `?shop=${encodeURIComponent(shop)}` : '';

  const fetchReferrals = useCallback(async () => {
    if (!affiliateId || !shop) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ shop, affiliateId, limit: '500' });
      const res = await fetch(`/api/admin/referrals?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setReferrals(data.referrals || []);
        const first = (data.referrals || [])[0];
        setAffiliateName(first ? first.affiliateName : '');
      } else {
        setError(data.error || 'Failed to load referrals');
      }
    } catch (err) {
      setError(err.message || 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  }, [affiliateId, shop]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const handleBack = () => navigate(`/referrals${shopParam}`);

  const unpaidReferrals = referrals.filter((r) => (r.status || '').toLowerCase() !== 'paid' && (r.status || '').toLowerCase() !== 'rejected');
  const unpaidIds = unpaidReferrals.map((r) => r.id).filter(Boolean);

  function getMonthKey(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  const unpaidByMonth = React.useMemo(() => {
    const map = {};
    unpaidReferrals.forEach((r) => {
      const key = getMonthKey(r.date);
      if (!key) return;
      if (!map[key]) map[key] = { referrals: [], ids: [], total: 0, currency: r.currency || 'USD' };
      map[key].referrals.push(r);
      if (r.id) map[key].ids.push(r.id);
      map[key].total += Number(r.amount) || 0;
    });
    return map;
  }, [unpaidReferrals]);

  const monthOptions = React.useMemo(() => {
    const keys = Object.keys(unpaidByMonth).sort().reverse();
    return keys.map((key) => {
      const { total, ids, currency } = unpaidByMonth[key];
      const [y, m] = key.split('-');
      const monthName = new Date(parseInt(y, 10), parseInt(m, 10) - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      return {
        value: key,
        label: `${monthName} (${ids.length} referral${ids.length !== 1 ? 's' : ''} · ${formatCurrency(total, currency)})`,
      };
    });
  }, [unpaidByMonth]);

  const handleMarkAllAsPaidConfirm = async () => {
    if (!shop || unpaidIds.length === 0) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/referrals/bulk-status?${new URLSearchParams({ shop }).toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralIds: unpaidIds, status: 'paid' }),
      });
      const data = await res.json();
      if (data.success) {
        setConfirmMarkAllPaidOpen(false);
        await fetchReferrals();
      } else {
        setError(data.error || 'Failed to update status');
      }
    } catch (err) {
      setError(err.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkMonthAsPaidConfirm = async () => {
    if (!shop || !selectedMonthKey || !unpaidByMonth[selectedMonthKey]) return;
    const { ids } = unpaidByMonth[selectedMonthKey];
    if (ids.length === 0) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/referrals/bulk-status?${new URLSearchParams({ shop }).toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralIds: ids, status: 'paid' }),
      });
      const data = await res.json();
      if (data.success) {
        setMarkMonthPaidOpen(false);
        setSelectedMonthKey(monthOptions.length ? monthOptions[0].value : '');
        await fetchReferrals();
      } else {
        setError(data.error || 'Failed to update status');
      }
    } catch (err) {
      setError(err.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const viewSingleReferral = (ref, e) => {
    if (e) e.stopPropagation();
    navigate(`/referrals/${ref.id}${shopParam}`);
  };

  const handleRejectReferral = async (ref, e) => {
    if (e) e.stopPropagation();
    if (!shop || !ref.id) return;
    const status = (ref.status || '').toLowerCase();
    if (status === 'paid' || status === 'rejected') return;
    setRejectingId(ref.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/referrals/bulk-status?${new URLSearchParams({ shop }).toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralIds: [ref.id], status: 'rejected' }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchReferrals();
      } else {
        setError(data.error || 'Failed to reject referral');
      }
    } catch (err) {
      setError(err.message || 'Failed to reject referral');
    } finally {
      setRejectingId(null);
    }
  };

  if (loading) {
    return (
      <Frame>
        <NavBar />
        <Page title="Referral details" backAction={{ content: 'Referrals', onAction: handleBack }}>
          <LegacyCard>
            <Box padding="800">
              <Spinner size="large" />
              <Text as="span">Loading…</Text>
            </Box>
          </LegacyCard>
        </Page>
      </Frame>
    );
  }

  if (error && referrals.length === 0) {
    return (
      <Frame>
        <NavBar />
        <Page title="Referral details" backAction={{ content: 'Referrals', onAction: handleBack }}>
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        </Page>
      </Frame>
    );
  }

  const totalAmount = referrals.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const currency = referrals[0]?.currency || 'USD';

  return (
    <Frame>
      <NavBar />
      <Page
        title={affiliateName ? `Referrals – ${affiliateName}` : 'Referral details'}
        backAction={{ content: 'Referrals', onAction: handleBack }}
      >
        <BlockStack gap="400">
          {error && (
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          )}
          <LegacyCard>
            <Box padding="400">
              <InlineStack gap="300" blockAlign="center">
                <Text as="p" variant="bodyMd">
                  <Text as="span" fontWeight="semibold">Total: {formatCurrency(totalAmount, currency)}</Text>
                  <Text as="span" tone="subdued"> ({referrals.length} order{referrals.length !== 1 ? 's' : ''})</Text>
                </Text>
                {unpaidIds.length > 0 && (
                  <InlineStack gap="200" blockAlign="center">
                    <Button
                      variant="primary"
                      tone="success"
                      onClick={() => setConfirmMarkAllPaidOpen(true)}
                      disabled={actionLoading}
                    >
                      Mark all as paid ({unpaidIds.length})
                    </Button>
                    {monthOptions.length > 0 && (
                      <Button
                        variant="secondary"
                        tone="success"
                        onClick={() => {
                          setSelectedMonthKey(monthOptions[0]?.value || '');
                          setMarkMonthPaidOpen(true);
                        }}
                        disabled={actionLoading}
                      >
                        Mark month as paid
                      </Button>
                    )}
                  </InlineStack>
                )}
              </InlineStack>
            </Box>
          </LegacyCard>
          <LegacyCard>
            <IndexTable
              resourceName={{ singular: 'referral', plural: 'referrals' }}
              itemCount={referrals.length}
              selectable={false}
              headings={[
                { title: 'Reference' },
                { title: 'Amount', alignment: 'end' },
                { title: 'Date' },
                { title: 'Status' },
                { title: 'Actions' },
              ]}
            >
              {referrals.map((ref, index) => (
                <IndexTable.Row id={ref.id || index} key={ref.id || index} position={index}>
                  <IndexTable.Cell>
                    <Text variant="bodyMd" fontWeight="semibold" as="span">
                      {ref.reference || (ref.referralId ? `#${(ref.referralId || '').slice(-8)}` : '—')}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" alignment="end" numeric>
                      {formatCurrency(ref.amount, ref.currency)}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{formatDate(ref.date)}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone={getStatusBadgeTone(ref.status)}>{ref.status || 'Unpaid'}</Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="200" blockAlign="center" wrap>
                      <Button variant="plain" size="slim" onClick={(e) => viewSingleReferral(ref, e)}>
                        View details
                      </Button>
                      {ref.orderId && shop && (
                        <a
                          href={`https://admin.shopify.com/store/${(shop || '').replace(/\.myshopify\.com$/, '')}/orders/${String(ref.orderId).replace(/^#/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '14px', color: '#2B7BE5', textDecoration: 'none' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          View order
                        </a>
                      )}
                      {(ref.status || '').toLowerCase() !== 'paid' && (ref.status || '').toLowerCase() !== 'rejected' && (
                        <Button
                          variant="plain"
                          size="slim"
                          tone="critical"
                          onClick={(e) => handleRejectReferral(ref, e)}
                          loading={rejectingId === ref.id}
                          disabled={!!rejectingId}
                        >
                          Reject
                        </Button>
                      )}
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </LegacyCard>
        </BlockStack>

        <Modal
        limitHeight
          open={confirmMarkAllPaidOpen}
          onClose={() => !actionLoading && setConfirmMarkAllPaidOpen(false)}
          title="Mark all as paid"
          primaryAction={{
            content: 'Mark all as paid',
            loading: actionLoading,
            onAction: handleMarkAllAsPaidConfirm,
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setConfirmMarkAllPaidOpen(false), disabled: actionLoading }]}
        >
          <Modal.Section>
            <Text as="p">
              Mark all {unpaidIds.length} unpaid referral{unpaidIds.length !== 1 ? 's' : ''} as paid? Commissions will move to the affiliate’s paid balance.
            </Text>
          </Modal.Section>
        </Modal>

        <Modal
        limitHeight
          open={markMonthPaidOpen}
          onClose={() => !actionLoading && setMarkMonthPaidOpen(false)}
          title="Mark month as paid"
          primaryAction={{
            content: selectedMonthKey
              ? `Mark ${selectedMonthKey ? new Date(selectedMonthKey + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : ''} as paid`
              : 'Mark as paid',
            loading: actionLoading,
            onAction: handleMarkMonthAsPaidConfirm,
            disabled: !selectedMonthKey,
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setMarkMonthPaidOpen(false), disabled: actionLoading }]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Text as="p">
                Pay all unpaid referrals for one month in a single payment (e.g. via PayPal). Select the month below.
              </Text>
              <Select
                label="Month"
                options={[{ value: '', label: 'Select month' }, ...monthOptions]}
                value={selectedMonthKey}
                onChange={setSelectedMonthKey}
              />
            </BlockStack>
          </Modal.Section>
        </Modal>
      </Page>
    </Frame>
  );
}

export default AffiliateReferralsDetailPage;
