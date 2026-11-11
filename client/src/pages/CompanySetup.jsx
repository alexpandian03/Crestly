import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Eye,
  Power,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useClientOptions } from '../components/shell/useClientOptions';
import { Button } from '../components/ui/button';
import PosterPreview from '../components/PosterPreview';
import api from '../services/api';

const DEFAULT_FRAME_TEMPLATE = {
  name: 'Standard poster',
  size: { width: 1080, height: 1350 },
};

function formatDate(dateValue) {
  if (!dateValue) return 'Never';
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return 'Never';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function CompanySetup() {
  const navigate = useNavigate();
  const { user, activeClientId, selectActiveClient } = useAuth();
  const org = useClientOptions(user?.role === 'superadmin');

  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState(null);
  const [brandKit, setBrandKit] = useState(null);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState(null);

  const selectedClientId =
    activeClientId ||
    (org.clients.length > 0 ? org.clients[0]._id || org.clients[0].id : '');

  const loadData = useCallback(async (clientId) => {
    if (!clientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [clientRes, brandKitRes] = await Promise.all([
        api.get(`/clients/${clientId}`).catch((err) => ({ error: err })),
        api
          .get('/brand-kit', { headers: { 'X-Client-Id': clientId } })
          .catch((err) => ({ error: err })),
      ]);

      setClientData(clientRes?.data?.data?.client || null);
      setBrandKit(brandKitRes?.data?.data?.brandKit || null);
    } catch (err) {
      setError(
        err?.response?.data?.error?.message ||
          'Failed to load company details.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      loadData(selectedClientId);
    } else {
      setLoading(false);
    }
  }, [selectedClientId, loadData]);

  const handleSelectClient = (clientId) => {
    selectActiveClient(clientId);
    loadData(clientId);
  };

  const handleToggleActivate = async () => {
    if (!clientData) return;
    setActivating(true);
    try {
      const newStatus = !clientData.isActive;
      const res = await api.patch(
        `/clients/${clientData._id || clientData.id}`,
        {
          isActive: newStatus,
        }
      );
      if (res?.data?.data?.client) {
        setClientData(res.data.data.client);
      } else {
        setClientData((prev) => ({ ...prev, isActive: newStatus }));
      }
    } catch (err) {
      setError(
        err?.response?.data?.error?.message ||
          'Failed to update activation status.'
      );
    } finally {
      setActivating(false);
    }
  };

  const headerImageUrl = brandKit?.header?.background?.imageUrl || '';
  const footerImageUrl = brandKit?.footer?.background?.imageUrl || '';
  const headerFooterReady = Boolean(headerImageUrl || footerImageUrl);
  const isCompanyActive = Boolean(clientData?.isActive);

  const lastChangedDate = useMemo(() => {
    const dates = [];
    if (clientData?.updatedAt) dates.push(new Date(clientData.updatedAt).getTime());
    if (brandKit?.updatedAt) dates.push(new Date(brandKit.updatedAt).getTime());
    if (dates.length === 0) return null;
    return new Date(Math.max(...dates));
  }, [clientData, brandKit]);

  if (loading) {
    return (
      <div className="container-page section-pad flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <RefreshCw className="w-8 h-8 text-[#2563EB] animate-spin" />
        <p className="text-sm text-[#6B7280]">Loading company setup details…</p>
      </div>
    );
  }

  return (
    <div className="container-page section-pad space-y-8 max-w-5xl mx-auto">
      {/* Top Banner & Switcher */}
      <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#E5E7EB]">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#2563EB]">
              <Building2 className="w-4 h-4" />
              <span>Super Admin Management</span>
            </div>
            <h1 className="text-2xl font-semibold text-[#111827] mt-1">
              Company Setup
            </h1>
            <p className="text-sm text-[#6B7280] mt-1">
              Configure each company once. The locked header and footer banners saved here wrap every poster generated for this organization.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[#6B7280] whitespace-nowrap">
              Switch company:
            </span>
            <select
              value={selectedClientId}
              onChange={(e) => handleSelectClient(e.target.value)}
              className="h-9 rounded-[6px] border border-[#E5E7EB] bg-white px-3 pr-8 text-xs font-medium text-[#111827] outline-none hover:border-[#D1D5DB] focus:border-[#2563EB]"
            >
              {org.clients.map((c) => {
                const id = c._id || c.id;
                return (
                  <option key={id} value={id}>
                    {c.name || 'Unnamed company'}{' '}
                    {c.isActive === false ? '(Inactive)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {error && (
          <div className="p-3 text-xs bg-red-50 text-red-700 rounded-[6px] border border-red-200">
            {error}
          </div>
        )}

        {clientData && (
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-semibold text-sm border border-[#DBEAFE]">
                {(clientData.name || 'C').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-[#111827]">
                    {clientData.name}
                  </h2>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-[4px] ${
                      isCompanyActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {isCompanyActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs text-[#6B7280]">
                  Contact: {clientData.contactEmail || 'No email set'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#6B7280]">
              <Calendar className="w-4 h-4 text-[#9CA3AF]" />
              <span>
                Last changed on:{' '}
                <strong className="text-[#111827] font-medium">
                  {formatDate(lastChangedDate)}
                </strong>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Step 1: Header and footer banners */}
        <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-[#F3F4F6] text-[#374151] flex items-center justify-center text-xs font-semibold">
                1
              </span>
              <h3 className="text-base font-semibold text-[#111827]">
                Header & footer banners
              </h3>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-[4px] ml-2 flex items-center gap-1 ${
                  headerFooterReady
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {headerFooterReady ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3" /> Banners needed
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-[#6B7280]">
              The permanently locked top and bottom banner images framing every poster. Team members cannot alter these bands.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-[#374151]">
              <span className="flex items-center gap-1.5">
                <span className="font-medium text-[#6B7280]">Header:</span>{' '}
                {headerImageUrl ? 'Uploaded' : 'Not uploaded'} ({brandKit?.header?.height || 140}px)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-medium text-[#6B7280]">Footer:</span>{' '}
                {footerImageUrl ? 'Uploaded' : 'Not uploaded'} ({brandKit?.footer?.height || 130}px)
              </span>
            </div>
          </div>

          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/brand-kit')}
              className="h-9 gap-1.5 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB]"
            >
              <Eye className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Edit header & footer</span>
              <ExternalLink className="w-3 h-3 text-[#9CA3AF]" />
            </Button>
          </div>
        </div>

        {/* Step 2: Live locked frame preview */}
        <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-[#F3F4F6] text-[#374151] flex items-center justify-center text-xs font-semibold">
                  2
                </span>
                <h3 className="text-base font-semibold text-[#111827]">
                  Preview poster frame
                </h3>
              </div>
              <p className="text-xs text-[#6B7280]">
                Live frame showing how the locked header banner and footer banner sit around the blank center canvas.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/create')}
              className="h-9 gap-1.5 rounded-[6px] border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB]"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Open Create studio</span>
            </Button>
          </div>

          <div className="rounded-[6px] border border-[#E5E7EB] bg-[#F9FAFB] p-6 flex flex-col items-center justify-center">
            <div className="w-full max-w-[420px] shadow-lg rounded-[8px] overflow-hidden border border-[#D1D5DB] bg-white">
              <PosterPreview
                eager
                brandKit={brandKit}
                template={DEFAULT_FRAME_TEMPLATE}
                content={{}}
              />
            </div>
          </div>
        </div>

        {/* Step 3: Activate company */}
        <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-[#F3F4F6] text-[#374151] flex items-center justify-center text-xs font-semibold">
                3
              </span>
              <h3 className="text-base font-semibold text-[#111827]">
                Activate company
              </h3>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-[4px] ml-2 flex items-center gap-1 ${
                  isCompanyActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                }`}
              >
                {isCompanyActive ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                  </>
                ) : (
                  <>
                    <Power className="w-3 h-3 text-zinc-500" /> Inactive
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-[#6B7280]">
              When active, organization admins and team members can sign in and generate new posters with the locked frame.
            </p>
          </div>

          <div>
            <Button
              type="button"
              disabled={activating}
              onClick={handleToggleActivate}
              className={`h-9 gap-1.5 rounded-[6px] text-xs font-medium shadow-none ${
                isCompanyActive
                  ? 'bg-white border border-[#E5E7EB] text-[#DC2626] hover:bg-red-50 hover:border-red-200'
                  : 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>
                {isCompanyActive ? 'Deactivate company' : 'Activate company'}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
