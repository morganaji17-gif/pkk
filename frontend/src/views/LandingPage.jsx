import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../api/client'
import BrandMark from '../components/BrandMark'
import { DEMO_ACCOUNTS, ROLE_LABELS, roleDestination } from '../demoAccounts'
import '../landing.css'

const NAV_LINKS = [
  { href: '#beranda', label: 'Beranda' },
  { href: '#tentang', label: 'Tentang' },
  { href: '#fitur', label: 'Fitur' },
  { href: '#cara-kerja', label: 'Cara Kerja' },
]

const MARQUEE_ITEMS = [
  'QR ordering',
  'Kitchen display',
  'Cashier',
  'Laporan',
  'Stok',
  'Audit',
]

const FEATURES = [
  {
    icon: 'qr',
    title: 'Pemesanan lewat QR meja',
    desc: 'Pelanggan membuka menu dari tautan meja, tanpa membuat akun.',
  },
  {
    icon: 'menu',
    title: 'Menu, kategori, dan opsi',
    desc: 'Kelola produk, kategori, serta opsi wajib dengan harga tambahan.',
  },
  {
    icon: 'cart',
    title: 'Keranjang dan checkout',
    desc: 'Ubah jumlah, tambah catatan, lalu checkout dalam satu alur.',
  },
  {
    icon: 'payment',
    title: 'Cash dan QRIS manual',
    desc: 'Pilih metode bayar; pelanggan dapat mengunggah bukti QRIS.',
  },
  {
    icon: 'tracking',
    title: 'Tracking pesanan',
    desc: 'Status pesanan diperbarui otomatis hingga pesanan selesai.',
  },
  {
    icon: 'kitchen',
    title: 'Kitchen Display System',
    desc: 'Papan NEW, PREPARING, dan READY untuk operasional dapur.',
  },
  {
    icon: 'dashboard',
    title: 'Dashboard admin dan kasir',
    desc: 'Pantau pendapatan, transaksi, pembayaran, dan status meja.',
  },
  {
    icon: 'table',
    title: 'Manajemen meja dan QR',
    desc: 'Buat meja, unduh kode QR, dan rotasi tautan bila diperlukan.',
  },
  {
    icon: 'report',
    title: 'Laporan, stok, dan audit',
    desc: 'Laporan PDF/CSV, stok otomatis, dan riwayat perubahan data.',
  },
]

const BENTO_LIST_INDEXES = [1, 2, 3, 4, 7, 8]

const STEPS = [
  {
    title: 'Scan QR meja',
    desc: 'Pelanggan membuka menu digital langsung dari meja.',
  },
  {
    title: 'Pilih produk dan opsi',
    desc: 'Atur jumlah, varian, dan catatan sesuai kebutuhan.',
  },
  {
    title: 'Checkout dan bayar',
    desc: 'Pilih cash atau QRIS, lalu kirim pesanan.',
  },
  {
    title: 'Kasir menerima pesanan',
    desc: 'Kasir mengonfirmasi pesanan dan menangani pembayaran.',
  },
  {
    title: 'Dapur memproses',
    desc: 'Pesanan masuk ke Kitchen Display System.',
  },
  {
    title: 'Pesanan selesai',
    desc: 'Status diperbarui hingga pesanan siap dan selesai.',
  },
]

const PHONE_PREVIEWS = [
  {
    src: '/landing/preview-menu.jpg',
    title: 'Menu pelanggan',
    desc: 'Pilih menu dan opsi dari tautan meja.',
    alt: 'Tangkapan layar menu pelanggan Pesanin',
  },
  {
    src: '/landing/preview-checkout.jpg',
    title: 'Checkout',
    desc: 'Cash atau QRIS dengan unggah bukti pembayaran.',
    alt: 'Tangkapan layar halaman checkout Pesanin',
  },
  {
    src: '/landing/preview-tracking.jpg',
    title: 'Tracking pesanan',
    desc: 'Pantau status pesanan secara berkala.',
    alt: 'Tangkapan layar tracking pesanan Pesanin',
  },
]

const DESKTOP_PREVIEWS = [
  {
    src: '/landing/preview-cashier.jpg',
    title: 'Dashboard kasir',
    desc: 'Terima pesanan dan verifikasi pembayaran.',
    alt: 'Tangkapan layar dashboard kasir Pesanin',
  },
  {
    src: '/landing/preview-kitchen.jpg',
    title: 'Kitchen Display',
    desc: 'Kelola antrean NEW, PREPARING, dan READY.',
    alt: 'Tangkapan layar Kitchen Display System Pesanin',
  },
  {
    src: '/landing/preview-admin.jpg',
    title: 'Dashboard admin',
    desc: 'Ringkasan operasional dan performa restoran.',
    alt: 'Tangkapan layar dashboard admin Pesanin',
  },
]

const DEMO_ROLES = [
  {
    id: 'customer',
    title: 'Customer',
    desc: 'Coba pengalaman pemesanan makanan melalui QR meja.',
    button: 'Coba sebagai Customer',
    meta: 'Tanpa login',
  },
  {
    id: 'admin',
    title: 'Admin',
    desc: 'Jelajahi dashboard dan fitur pengelolaan restoran.',
    button: 'Coba sebagai Admin',
    meta: 'Login otomatis',
  },
  {
    id: 'cashier',
    title: 'Cashier',
    desc: 'Pelajari proses penerimaan pesanan dan konfirmasi pembayaran.',
    button: 'Coba sebagai Cashier',
    meta: 'Login otomatis',
  },
  {
    id: 'kitchen',
    title: 'Kitchen',
    desc: 'Pantau dan kelola proses persiapan pesanan.',
    button: 'Coba sebagai Kitchen',
    meta: 'Login otomatis',
  },
]

const ICONS = {
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" />
    </>
  ),
  menu: (
    <>
      <path d="M4 4h16v16H4z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
      <path d="M2 3h3l2.2 11.2a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21 7H6" />
    </>
  ),
  payment: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19M6 15h4" />
    </>
  ),
  tracking: (
    <>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  kitchen: (
    <>
      <path d="M6 13a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v6H6z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3M6 19h12" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="5" rx="1" />
      <rect x="13" y="10" width="8" height="11" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
    </>
  ),
  table: (
    <>
      <path d="M3 9h18M5 9v11M19 9v11M8 9V5h8v4" />
    </>
  ),
  report: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  customer: (
    <>
      <path d="M6 7h12l1 13H5z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </>
  ),
  admin: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.4 7.6-8 9-4.6-1.4-8-4.5-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  cashier: (
    <>
      <path d="M6 3h12v18H6z" />
      <path d="M9 7h6M9 11h6M9 15h3" />
    </>
  ),
}

function Icon({ name, size = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  )
}

function Arrow({ size = 18 }) {
  return (
    <svg
      className="lp-arrow"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function useScrollReveal() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('[data-reveal]'))
    if (!elements.length) return undefined

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      elements.forEach((element) => element.classList.add('is-visible'))
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )

    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])
}

function demoErrorMessage(error) {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return 'Terlalu banyak percobaan masuk. Tunggu sekitar satu menit, lalu coba lagi.'
    }
    if (error.status === 401) {
      return 'Akun demo tidak dapat masuk. Kredensial demo mungkin sudah berubah. Silakan hubungi pengelola demo.'
    }
    if (error.status === null) {
      return 'Tidak dapat terhubung ke server demo. Periksa koneksi internet lalu coba lagi.'
    }
  }
  return 'Tidak dapat masuk ke akun demo saat ini. Silakan coba lagi beberapa saat lagi.'
}

export default function LandingPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeRole, setActiveRole] = useState(null)
  const [error, setError] = useState(null)

  useScrollReveal()

  const closeMenu = () => setMenuOpen(false)

  const handleDemoLogin = async (role) => {
    if (activeRole) return

    const account = DEMO_ACCOUNTS[role]
    if (!account) return

    setActiveRole(role)
    setError(null)

    try {
      const loggedInUser = await login(account.email, account.password)
      navigate(roleDestination(loggedInUser.role), { replace: true })
    } catch (err) {
      setError(demoErrorMessage(err))
      setActiveRole(null)
    }
  }

  const handleOpenDashboard = () => {
    navigate(roleDestination(user?.role), { replace: true })
  }

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-container lp-nav__inner">
          <a className="lp-brand" href="#beranda" aria-label="Pesanin, kembali ke atas">
            <span className="lp-brand__mark" aria-hidden="true">
              <BrandMark size={24} />
            </span>
            <span className="lp-brand__name">Pesanin</span>
          </a>

          <nav
            id="lp-nav-links"
            className={`lp-nav__links${menuOpen ? ' is-open' : ''}`}
            aria-label="Navigasi utama"
          >
            {NAV_LINKS.map((item) => (
              <a key={item.href} href={item.href} onClick={closeMenu}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="lp-nav__end">
            <Link className="lp-nav__login" to="/login">
              Masuk
            </Link>
            <a
              className="lp-btn lp-btn--primary lp-btn--sm"
              href="#demo"
              onClick={closeMenu}
            >
              Coba Demo
            </a>
            <button
              type="button"
              className="lp-nav__toggle"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
              aria-expanded={menuOpen}
              aria-controls="lp-nav-links"
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                {menuOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero" id="beranda">
          <span className="lp-hero__watermark" aria-hidden="true">
            PESANIN
          </span>

          <div className="lp-container lp-hero__inner">
            <div className="lp-hero__copy">
              <span className="lp-tag">
                <span className="lp-tag__dot" aria-hidden="true" />
                Demo interaktif · tanpa daftar
              </span>
              <h1>
                Kelola Restoran <span className="lp-hero__accent">Lebih Mudah</span>{' '}
                dengan <span className="lp-hero__brand">Pesanin.</span>
              </h1>
              <p className="lp-hero__lead">
                Satu sistem untuk pemesanan pelanggan, pengelolaan kasir, antrean
                dapur, dan laporan restoran. Dibangun untuk alur kerja nyata.
              </p>
              <div className="lp-hero__actions">
                <a className="lp-btn lp-btn--primary lp-btn--lg" href="#demo">
                  Coba Demo
                  <Arrow />
                </a>
                <a className="lp-btn lp-btn--outline lp-btn--lg" href="#fitur">
                  Jelajahi Fitur
                </a>
              </div>
              <ul className="lp-hero__points">
                <li>
                  <span className="lp-check" aria-hidden="true">
                    ✓
                  </span>
                  Pelanggan tanpa akun
                </li>
                <li>
                  <span className="lp-check" aria-hidden="true">
                    ✓
                  </span>
                  Tiga peran staf
                </li>
                <li>
                  <span className="lp-check" aria-hidden="true">
                    ✓
                  </span>
                  Langsung coba tanpa daftar
                </li>
              </ul>
            </div>

            <div className="lp-hero__visual">
              <div className="lp-stage">
                <span className="lp-stage__halo" aria-hidden="true" />

                <div className="lp-browser lp-browser--hero">
                  <div className="lp-browser__bar" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <em>dashboard · admin</em>
                  </div>
                  <img
                    src="/landing/hero-dashboard.jpg"
                    alt="Tangkapan layar asli dashboard admin Pesanin"
                    width="1600"
                    height="1000"
                    fetchPriority="high"
                  />
                </div>

                <div className="lp-phone lp-phone--hero" aria-hidden="true">
                  <img
                    src="/landing/hero-menu.jpg"
                    alt=""
                    width="540"
                    height="1170"
                    loading="eager"
                  />
                </div>

                <div className="lp-chip lp-chip--order">
                  <span className="lp-chip__dot" aria-hidden="true" />
                  <span>
                    <strong>Pesanan siap</strong>
                    <em>Meja 01 · ORD-2026</em>
                  </span>
                </div>

                <div className="lp-chip lp-chip--qr">
                  <span className="lp-chip__icon" aria-hidden="true">
                    <Icon name="qr" size={16} />
                  </span>
                  <span>
                    <strong>Scan meja</strong>
                    <em>Menu langsung terbuka</em>
                  </span>
                </div>
              </div>
              <p className="lp-hero__caption">
                Screenshot asli aplikasi Pesanin — bukan mockup.
              </p>
            </div>
          </div>
        </section>

        <div className="lp-marquee" aria-hidden="true">
          <div className="lp-marquee__track">
            {[0, 1].map((copy) => (
              <div className="lp-marquee__group" key={copy}>
                {MARQUEE_ITEMS.map((item) => (
                  <span className="lp-marquee__item" key={`${copy}-${item}`}>
                    {item}
                    <i />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <section className="lp-about-section" id="tentang">
          <span className="lp-about-section__word" aria-hidden="true">
            PESANIN
          </span>
          <div className="lp-container lp-about">
            <div className="lp-about__head" data-reveal>
              <span className="lp-eyebrow lp-eyebrow--light">Tentang Pesanin</span>
              <h2>
                Satu alur untuk pelanggan, kasir, dapur, dan admin.
              </h2>
            </div>

            <div className="lp-about__body" data-reveal data-reveal-delay="1">
              <p>
                Pesanin membantu menyederhanakan proses pemesanan dan pengelolaan
                operasional restoran. Pelanggan memesan langsung dari meja, kasir
                menangani pesanan dan pembayaran, dapur memproses antrean, dan admin
                memantau seluruh aktivitas dalam satu dashboard.
              </p>
              <p>
                Semua data operasional tersaji dalam satu tempat: produk, meja, stok,
                laporan penjualan, hingga riwayat perubahan. Tidak perlu berpindah
                aplikasi untuk menjalankan alur harian restoran.
              </p>
              <a className="lp-textlink" href="#cara-kerja">
                Lihat cara kerjanya
                <Arrow size={16} />
              </a>
            </div>

            <div className="lp-about__stats" data-reveal data-reveal-delay="2">
              <div>
                <strong>4</strong>
                <span>peran dalam satu sistem</span>
              </div>
              <div>
                <strong>9</strong>
                <span>fitur operasional</span>
              </div>
              <div>
                <strong>QR</strong>
                <span>pesan langsung dari meja</span>
              </div>
              <div>
                <strong>1</strong>
                <span>alur pesanan terpadu</span>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-features-section" id="fitur">
          <div className="lp-container">
            <div className="lp-section-head">
              <div data-reveal>
                <span className="lp-eyebrow">Fitur utama</span>
                <h2>Bukan sekadar menu digital.</h2>
              </div>
              <div className="lp-section-head__aside" data-reveal data-reveal-delay="1">
                <p>
                  Dari QR meja sampai laporan penjualan, semua modul bekerja pada
                  data dan alur yang sama.
                </p>
                <span className="lp-count">09 fitur</span>
              </div>
            </div>

            <div className="lp-bento">
              <article className="lp-bento__card lp-bento__card--qr" data-reveal>
                <div className="lp-bento__copy">
                  <span className="lp-bento__label">Pemesanan</span>
                  <h3>{FEATURES[0].title}</h3>
                  <p>{FEATURES[0].desc}</p>
                  <span className="lp-bento__note">
                    <Icon name="qr" size={16} />
                    Tanpa unduh aplikasi
                  </span>
                  <ol className="lp-bento__flow" aria-label="Alur pemesanan QR">
                    <li>
                      <span>01</span>
                      Scan QR
                    </li>
                    <li>
                      <span>02</span>
                      Pilih menu
                    </li>
                    <li>
                      <span>03</span>
                      Checkout
                    </li>
                  </ol>
                </div>
                <div className="lp-bento__media lp-bento__media--phone" aria-hidden="true">
                  <img
                    src="/landing/preview-menu.jpg"
                    alt=""
                    width="540"
                    height="1170"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </article>

              <article
                className="lp-bento__card lp-bento__card--kitchen"
                data-reveal
                data-reveal-delay="1"
              >
                <div className="lp-bento__copy">
                  <span className="lp-bento__label">Dapur</span>
                  <h3>{FEATURES[5].title}</h3>
                  <p>{FEATURES[5].desc}</p>
                </div>
                <div className="lp-bento__media lp-bento__media--wide">
                  <img
                    src="/landing/preview-kitchen.jpg"
                    alt="Tangkapan layar Kitchen Display System Pesanin"
                    width="1440"
                    height="900"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </article>

              <article className="lp-bento__card lp-bento__card--dashboard" data-reveal>
                <div className="lp-bento__copy">
                  <span className="lp-bento__label">Operasional</span>
                  <h3>{FEATURES[6].title}</h3>
                  <p>{FEATURES[6].desc}</p>
                </div>
                <div className="lp-bento__media lp-bento__media--browser">
                  <img
                    src="/landing/preview-admin.jpg"
                    alt="Tangkapan layar dashboard admin Pesanin"
                    width="1440"
                    height="900"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </article>

              <article
                className="lp-bento__card lp-bento__card--list"
                data-reveal
                data-reveal-delay="1"
              >
                <span className="lp-bento__label">Modul pendukung</span>
                <ul className="lp-bento__list">
                  {BENTO_LIST_INDEXES.map((index) => {
                    const feature = FEATURES[index]
                    return (
                      <li key={feature.title}>
                        <span className="lp-bento__icon" aria-hidden="true">
                          <Icon name={feature.icon} size={18} />
                        </span>
                        <div>
                          <h4>{feature.title}</h4>
                          <p>{feature.desc}</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className="lp-work" id="cara-kerja">
          <div className="lp-container lp-work__inner">
            <div className="lp-work__head" data-reveal>
              <span className="lp-eyebrow lp-eyebrow--invert">Cara kerja</span>
              <h2>Dari scan meja sampai pesanan selesai.</h2>
              <p>
                Alur yang sama dipakai oleh pelanggan, kasir, dan dapur — tanpa
                perpindahan aplikasi.
              </p>
              <a className="lp-btn lp-btn--light" href="#demo">
                Coba alurnya
                <Arrow />
              </a>
            </div>

            <ol className="lp-work__steps">
              {STEPS.map((step, index) => (
                <li
                  className="lp-work__step"
                  key={step.title}
                  data-reveal
                  data-reveal-delay={String(index % 3)}
                >
                  <span className="lp-work__num" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-showcase" id="preview">
          <div className="lp-container">
            <div className="lp-section-head lp-section-head--showcase">
              <div data-reveal>
                <span className="lp-eyebrow">Preview aplikasi</span>
                <h2>Tampilan asli. Bukan mockup.</h2>
              </div>
              <p data-reveal data-reveal-delay="1">
                Cuplikan antarmuka yang digunakan pelanggan dan staf setiap hari,
                diambil langsung dari aplikasi Pesanin.
              </p>
            </div>

            <div className="lp-phone-stage">
              <span className="lp-phone-stage__ring" aria-hidden="true" />
              {PHONE_PREVIEWS.map((item, index) => (
                <figure
                  className={`lp-phone-item lp-phone-item--${index + 1}`}
                  key={item.src}
                  data-reveal
                  data-reveal-delay={String(index)}
                >
                  <div className="lp-phone-shape">
                    <img
                      src={item.src}
                      alt={item.alt}
                      width="540"
                      height="1170"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <figcaption>
                    <strong>{item.title}</strong>
                    <span>{item.desc}</span>
                  </figcaption>
                </figure>
              ))}
            </div>

            <div className="lp-screens">
              <figure className="lp-screen lp-screen--main" data-reveal>
                <div className="lp-frame">
                  <div className="lp-frame__bar" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <span>{DESKTOP_PREVIEWS[0].title}</span>
                  </div>
                  <img
                    src={DESKTOP_PREVIEWS[0].src}
                    alt={DESKTOP_PREVIEWS[0].alt}
                    width="1440"
                    height="900"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <figcaption>
                  <strong>{DESKTOP_PREVIEWS[0].title}</strong>
                  <span>{DESKTOP_PREVIEWS[0].desc}</span>
                </figcaption>
              </figure>

              <div className="lp-screens__side">
                {[DESKTOP_PREVIEWS[1], DESKTOP_PREVIEWS[2]].map((item, index) => (
                  <figure
                    className="lp-screen"
                    key={item.src}
                    data-reveal
                    data-reveal-delay={String(index + 1)}
                  >
                    <div className="lp-frame lp-frame--small">
                      <div className="lp-frame__bar" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <span>{item.title}</span>
                      </div>
                      <img
                        src={item.src}
                        alt={item.alt}
                        width="1440"
                        height="900"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <figcaption>
                      <strong>{item.title}</strong>
                      <span>{item.desc}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="lp-demo" id="demo">
          <div className="lp-container">
            <div className="lp-demo__head">
              <div data-reveal>
                <span className="lp-eyebrow lp-eyebrow--light">Akses demo</span>
                <h2>Coba Langsung Pesanin</h2>
              </div>
              <p data-reveal data-reveal-delay="1">
                Jelajahi pengalaman pengelolaan restoran melalui berbagai peran
                operasional. Tanpa instalasi, tanpa pendaftaran.
              </p>
            </div>

            {user && (
              <div className="lp-session">
                <div>
                  <span className="lp-session__label">Sesi aktif</span>
                  <p>
                    Anda masuk sebagai{' '}
                    <strong>{ROLE_LABELS[user.role] || user.role}</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  className="lp-btn lp-btn--primary lp-btn--sm"
                  onClick={handleOpenDashboard}
                >
                  Buka Dashboard
                </button>
              </div>
            )}

            {error && (
              <div className="lp-alert" role="alert">
                {error}
              </div>
            )}

            <div className="lp-demo__grid">
              {DEMO_ROLES.map((role) => {
                const isLoading = activeRole === role.id
                const isDisabled = role.id !== 'customer' && Boolean(activeRole)

                if (role.id === 'customer') {
                  return (
                    <article className="lp-demo-card lp-demo-card--customer" key={role.id}>
                      <div className="lp-demo-card__top">
                        <span className="lp-demo-card__icon" aria-hidden="true">
                          <Icon name={role.id} size={22} />
                        </span>
                        <em className="lp-demo-card__meta">{role.meta}</em>
                      </div>
                      <h3>{role.title}</h3>
                      <p>{role.desc}</p>
                      <a
                        className="lp-btn lp-btn--light lp-btn--block"
                        href="/menu?table=1"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {role.button}
                        <Arrow />
                      </a>
                    </article>
                  )
                }

                return (
                  <article
                    className={`lp-demo-card lp-demo-card--row lp-demo-card--${role.id}`}
                    key={role.id}
                  >
                    <span className="lp-demo-card__icon" aria-hidden="true">
                      <Icon name={role.id} size={20} />
                    </span>
                    <div className="lp-demo-card__rowcopy">
                      <div className="lp-demo-card__rowhead">
                        <h3>{role.title}</h3>
                        <em className="lp-demo-card__meta">{role.meta}</em>
                      </div>
                      <p>{role.desc}</p>
                    </div>
                    <button
                      type="button"
                      className="lp-btn lp-btn--primary lp-btn--sm lp-demo-card__action"
                      onClick={() => handleDemoLogin(role.id)}
                      disabled={isDisabled}
                      aria-busy={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <span className="lp-spinner" aria-hidden="true" />
                          Memproses…
                        </>
                      ) : (
                        role.button
                      )}
                    </button>
                  </article>
                )
              })}
            </div>

            <p className="lp-demo__note">
              Demo publik memakai data contoh. Jangan mengunggah data pribadi atau
              dokumen rahasia. Gunakan satu peran per jendela agar sesi tidak saling
              menimpa.
            </p>

            <details className="lp-credentials">
              <summary>Lihat kredensial akun demo</summary>
              <div className="lp-credentials__grid">
                {Object.entries(DEMO_ACCOUNTS).map(([role, account]) => (
                  <div className="lp-credentials__item" key={role}>
                    <span>{ROLE_LABELS[role] || role}</span>
                    <code>{account.email}</code>
                    <code>{account.password}</code>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer__top">
            <div className="lp-footer__brand">
              <span className="lp-brand__mark" aria-hidden="true">
                <BrandMark size={22} />
              </span>
              <span>Pesanin</span>
            </div>
            <p>
              Sistem pemesanan dan manajemen restoran.
              <br />
              Demo produk dengan data contoh.
            </p>
            <div className="lp-footer__links">
              <a href="#beranda">Kembali ke atas</a>
              <Link to="/login">Masuk staf</Link>
            </div>
          </div>
          <div className="lp-footer__bottom">
            <span>© 2026 Pesanin</span>
            <span>Dibangun untuk operasional restoran nyata.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
