import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Frame,
  Page,
  LegacyCard,
  DataTable,
  Badge,
  Text,
  Box,
  Spinner,
  Banner,
  Button,
  InlineStack,
  Modal,
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

function ReferralDetailPage({ shop }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [referral, setReferral] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmUnpaidOpen, setConfirmUnpaidOpen] = useState(false);
  const [confirmPaidOpen, setConfirmPaidOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!id || !shop) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ shop });
    fetch(`/api/admin/referrals/${id}?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.referral) {
          setReferral(data.referral);
        } else {
          setError(data.error || 'Referral not found');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load referral');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, shop]);

  const handleBack = () => {
    const shopParam = shop ? `?shop=${encodeURIComponent(shop)}` : '';
    navigate(`/referrals${shopParam}`);
  };

  const fetchReferral = useCallback(async () => {
    if (!id || !shop) return;
    const params = new URLSearchParams({ shop });
    const res = await fetch(`/api/admin/referrals/${id}?${params.toString()}`);
    const data = await res.json();
    if (data.success && data.referral) setReferral(data.referral);
    else setError(data.error || 'Failed to load referral');
  }, [id, shop]);

  const handleMarkAsUnpaidConfirm = async () => {
    if (!id || !shop) return;
    setActionLoading(true);
    try {
      const params = new URLSearchParams({ shop });
      const res = await fetch(`/api/admin/referrals/${id}/status?${params.toString()}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' }),
      });
      const data = await res.json();
      if (data.success) {
        setConfirmUnpaidOpen(false);
        await fetchReferral();
      } else {
        setError(data.error || 'Failed to update status');
      }
    } catch (err) {
      setError(err.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAsPaidConfirm = async () => {
    if (!id || !shop) return;
    setActionLoading(true);
    try {
      const params = new URLSearchParams({ shop });
      const res = await fetch(`/api/admin/referrals/${id}/status?${params.toString()}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      });
      const data = await res.json();
      if (data.success) {
        setConfirmPaidOpen(false);
        await fetchReferral();
      } else {
        setError(data.error || 'Failed to update status');
      }
    } catch (err) {
      setError(err.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!id || !shop) return;
    setActionLoading(true);
    try {
      const params = new URLSearchParams({ shop });
      const res = await fetch(`/api/admin/referrals/${id}?${params.toString()}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setConfirmDeleteOpen(false);
        handleBack();
      } else {
        setError(data.error || 'Failed to delete referral');
      }
    } catch (err) {
      setError(err.message || 'Failed to delete referral');
    } finally {
      setActionLoading(false);
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

  if (error || !referral) {
    return (
      <Frame>
        <NavBar />
        <Page title="Referral details" backAction={{ content: 'Referrals', onAction: handleBack }}>
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error || 'Referral not found'}
          </Banner>
        </Page>
      </Frame>
    );
  }

  const shopParam = shop ? `?shop=${encodeURIComponent(shop)}` : '';
  const affiliatePath = referral.affiliateId ? `/affiliates/${referral.affiliateId}${shopParam}` : null;
  const orderUrl = referral.orderId && shop
    ? `https://admin.shopify.com/store/${(shop || '').replace(/\.myshopify\.com$/, '')}/orders/${String(referral.orderId).replace(/^#/, '')}`
    : null;

  const rows = [
    ['Referral ID', referral.referralId || referral.id || '—'],
    ['Amount', formatCurrency(referral.amount, referral.currency)],
    ['Affiliate ID', referral.affiliateId || '—'],
    [
      'Affiliate',
      affiliatePath ? (
        <RouterLink key="affiliate" to={affiliatePath} style={{ color: '#2B7BE5', textDecoration: 'none' }}>
          {referral.affiliateName || '—'}
        </RouterLink>
      ) : (referral.affiliateName || '—')
    ],
    ['Reference', referral.reference || '—'],
    ['Order ID', referral.orderId || '—'],
    ['Date', formatDate(referral.date)],
    ['Status', <Badge key="status" tone={getStatusBadgeTone(referral.status)}>{referral.status || 'Unpaid'}</Badge>],
    ['Type', referral.type || 'Order'],
    ['Product description', referral.description || '—'],
  ];

  const isPaid = (referral.status || '').toLowerCase() === 'paid';

  return (
    <Frame>
      <NavBar />
      <Page title="Referral details" backAction={{ content: 'Referrals', onAction: handleBack }}>
        <Box paddingBlockEnd="400">
          <InlineStack gap="300">
            {!isPaid && (
              <Button
                variant="primary"
                tone="success"
                onClick={() => setConfirmPaidOpen(true)}
                disabled={actionLoading}
              >
                Mark as Paid
              </Button>
            )}
            {isPaid && (
              <Button
                variant="primary"
                tone="critical"
                onClick={() => setConfirmUnpaidOpen(true)}
                disabled={actionLoading}
              >
                Mark as Unpaid
              </Button>
            )}
            <Button
              variant="primary"
              tone="critical"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={actionLoading}
            >
              Delete
            </Button>
          </InlineStack>
        </Box>
        <LegacyCard>
          <DataTable
            columnContentTypes={['text', 'text']}
            headings={['Field', 'Value']}
            rows={rows}
            footerContent={orderUrl ? (
              <a href={orderUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2B7BE5' }}>
                Open order in Shopify
              </a>
            ) : null}
          />
        </LegacyCard>

        <Modal
        limitHeight
          open={confirmPaidOpen}
          onClose={() => !actionLoading && setConfirmPaidOpen(false)}
          title="Mark as Paid"
          primaryAction={{
            content: 'Mark as Paid',
            loading: actionLoading,
            onAction: handleMarkAsPaidConfirm,
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setConfirmPaidOpen(false), disabled: actionLoading }]}
        >
          <Modal.Section>
            <Text as="p">Mark this referral as paid? The commission will move from the affiliate's pending balance to paid.</Text>
          </Modal.Section>
        </Modal>

        <Modal
        limitHeight
          open={confirmUnpaidOpen}
          onClose={() => !actionLoading && setConfirmUnpaidOpen(false)}
          title="Mark as Unpaid"
          primaryAction={{
            content: 'Mark as Unpaid',
            destructive: true,
            loading: actionLoading,
            onAction: handleMarkAsUnpaidConfirm,
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setConfirmUnpaidOpen(false), disabled: actionLoading }]}
        >
          <Modal.Section>
            <Text as="p">Are you sure you want to mark this referral as unpaid? The commission will move back to the affiliate’s pending balance.</Text>
          </Modal.Section>
        </Modal>

        <Modal
        limitHeight
          open={confirmDeleteOpen}
          onClose={() => !actionLoading && setConfirmDeleteOpen(false)}
          title="Delete referral"
          primaryAction={{
            content: 'Delete',
            destructive: true,
            loading: actionLoading,
            onAction: handleDeleteConfirm,
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setConfirmDeleteOpen(false), disabled: actionLoading }]}
        >
          <Modal.Section>
            <Text as="p">Are you sure you want to delete this referral? This will remove the conversion and reverse the affiliate’s stats and earnings. This action cannot be undone.</Text>
          </Modal.Section>
        </Modal>
      </Page>
    </Frame>
  );
}

export default ReferralDetailPage;
