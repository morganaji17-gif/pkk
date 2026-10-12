/* eslint-disable react-hooks/set-state-in-effect -- SWR */
import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader'
import ErrorState from '../../../components/ErrorState'
import ProgressBar from '../../../components/ProgressBar'
import { SkeletonCards } from '../../../components/Skeleton'
import { getSettings, updateQris, updateBilling, peekCached } from '../../../api/client'
import { resolveImageUrl } from '../../../utils/format'
import { toastError, toastSuccess } from '../../../utils/swal'

export default function SettingsPage() {
  const initialSettings = peekCached('/settings')
  const [loading, setLoading] = useState(!initialSettings)
  const [loadError, setLoadError] = useState(null)
  const [image, setImage] = useState(null)
  const [currentImage, setCurrentImage] = useState(
    initialSettings?.qris_image ? resolveImageUrl(initialSettings.qris_image) : null
  )
  const [preview, setPreview] = useState(null)
  const [instruction, setInstruction] = useState(initialSettings?.qris_instruction || '')
  const [saving, setSaving] = useState(false)
  const [serviceChargePercent, setServiceChargePercent] = useState(
    String(initialSettings?.service_charge_percent ?? 0)
  )
  const [taxPercent, setTaxPercent] = useState(String(initialSettings?.tax_percent ?? 0))
  const [savingBilling, setSavingBilling] = useState(false)
  const [fileInputKey, setFileInputKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const cached = peekCached('/settings')
    if (cached) {
      setCurrentImage(cached.qris_image ? resolveImageUrl(cached.qris_image) : null)
      setInstruction(cached.qris_instruction || '')
      setServiceChargePercent(String(cached.service_charge_percent ?? 0))
      setTaxPercent(String(cached.tax_percent ?? 0))
    }
    getSettings()
      .then((data) => {
        if (cancelled) return
        setCurrentImage(data.qris_image ? resolveImageUrl(data.qris_image) : null)
        setInstruction(data.qris_instruction || '')
        setServiceChargePercent(String(data.service_charge_percent ?? 0))
        setTaxPercent(String(data.tax_percent ?? 0))
      })
      .catch((err) => {
        if (!cancelled && !cached) setLoadError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(file)
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const formData = new FormData()
      if (image) formData.append('image', image)
      formData.append('instruction', instruction)
      const data = await updateQris(formData)
      setCurrentImage(data.qris_image ? resolveImageUrl(data.qris_image) : null)
      if (preview) URL.revokeObjectURL(preview)
      setPreview(null)
      setImage(null)
      setFileInputKey((n) => n + 1)
      toastSuccess('Pengaturan QRIS berhasil disimpan.')
    } catch (err) {
      toastError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveBilling = async (e) => {
    e.preventDefault()
    setSavingBilling(true)
    try {
      await updateBilling({
        service_charge_percent: Number(serviceChargePercent),
        tax_percent: Number(taxPercent),
      })
      toastSuccess('Pengaturan biaya layanan dan pajak berhasil disimpan.')
    } catch (err) {
      toastError(err.message)
    } finally {
      setSavingBilling(false)
    }
  }

  return (
    <div className="staff-dashboard">
      <PageHeader
        title="Pengaturan"
        subtitle="Kelola pengaturan restoran, termasuk pembayaran QRIS dan biaya layanan."
      />

      {loading ? (
        <SkeletonCards count={2} />
      ) : loadError ? (
        <ErrorState message={loadError} />
      ) : (
        <>
        <form className="staff-settings" onSubmit={handleSave}>
          <ProgressBar loading={saving} />
          <section className="staff-settings__card">
            <h2 className="staff-settings__title">Pembayaran QRIS</h2>
            <p className="staff-settings__desc">
              Unggah gambar QRIS statis milik restoran Anda. Gambar ini akan ditampilkan
              kepada pelanggan saat memilih metode pembayaran QRIS.
            </p>

            <label className="field" htmlFor="qris-image">
              <span className="field__label">Gambar QRIS</span>
              <input
                key={fileInputKey}
                id="qris-image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFile}
              />
              <span className="field__hint">Format PNG/JPG/WebP, maksimal 2 MB.</span>
            </label>

            <div className="staff-settings__preview">
              {preview ? (
                <img src={preview} alt="Pratinjau QRIS baru" className="staff-settings__img" />
              ) : currentImage ? (
                <img src={currentImage} alt="Gambar QRIS saat ini" className="staff-settings__img" />
              ) : (
                <span className="staff-settings__empty">Belum ada gambar QRIS</span>
              )}
            </div>

            <label className="field" htmlFor="qris-instruction">
              <span className="field__label">Instruksi Pembayaran</span>
              <textarea
                id="qris-instruction"
                className="field__input"
                rows={3}
                maxLength={1000}
                placeholder="Contoh: Scan QRIS di atas, lalu tunjukkan bukti pembayaran ke kasir."
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
              />
              <span className="field__hint">Panduan singkat untuk pelanggan saat membayar.</span>
            </label>

            <div className="staff-settings__actions">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={saving || (!image && instruction === '')}
              >
                {saving ? 'Menyimpan…' : 'Simpan Pengaturan'}
              </button>
            </div>
          </section>
        </form>

        <form className="staff-settings" onSubmit={handleSaveBilling}>
          <ProgressBar loading={savingBilling} />
          <section className="staff-settings__card">
            <h2 className="staff-settings__title">Biaya Layanan &amp; Pajak</h2>
            <p className="staff-settings__desc">
              Biaya ini otomatis ditambahkan ke setiap pesanan baru di kasir dan ditampilkan pada
              halaman tracking pelanggan.
            </p>

            <label className="field" htmlFor="service-charge-percent">
              <span className="field__label">Service Charge (%)</span>
              <input
                id="service-charge-percent"
                type="number"
                className="field__input"
                min="0"
                max="100"
                step="0.1"
                value={serviceChargePercent}
                onChange={(e) => setServiceChargePercent(e.target.value)}
              />
              <span className="field__hint">Contoh: 5 berarti biaya layanan 5% dari subtotal.</span>
            </label>

            <label className="field" htmlFor="tax-percent">
              <span className="field__label">PPN (%)</span>
              <input
                id="tax-percent"
                type="number"
                className="field__input"
                min="0"
                max="100"
                step="0.1"
                value={taxPercent}
                onChange={(e) => setTaxPercent(e.target.value)}
              />
              <span className="field__hint">Contoh: 11 berarti pajak 11% dari subtotal.</span>
            </label>

            <div className="staff-settings__actions">
              <button type="submit" className="btn btn--primary" disabled={savingBilling}>
                {savingBilling ? 'Menyimpan…' : 'Simpan Pengaturan Biaya'}
              </button>
            </div>
          </section>
        </form>
        </>
      )}
    </div>
  )
}