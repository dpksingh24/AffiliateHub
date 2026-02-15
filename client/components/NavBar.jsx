import React, { useState } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import logoIcon from '../assets/images/logo.png'

const NavBar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [openDropdown, setOpenDropdown] = useState(null)

  const navItems = [
    { label: 'Home', path: '/running' },
    { label: 'Affiliate Form', path: '/affiliate-form' },
    {
      key: 'referrals-payouts',
      label: 'Affiliate Area',
      path: '/referrals',
      subitems: [
        { label: 'Referrals', path: '/referrals' },
        { label: 'Affiliates', path: '/affiliates' },
        { label: 'Visits', path: '/visits' },
        // { label: 'Payouts', path: '/payouts' }
      ]
    },
    { label: 'Admin Settings', path: '/admin/settings' }
  ]

  const isDropdownChildActive = (subitems) =>
    subitems?.some(
      (s) => location.pathname === s.path || location.pathname.startsWith(s.path + '/')
    ) ?? false

  // Preserve shop parameter when navigating
  const navigateWithShop = (path) => {
    const shop = searchParams.get('shop') || localStorage.getItem('kiscience_shop') || ''
    if (shop) {
      navigate(`${path}?shop=${shop}`)
    } else {
      navigate(path)
    }
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      padding: '0 24px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: '1200px',
        margin: '0 auto',
        height: '60px',
      }}>
        {/* Logo Section */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            cursor: 'pointer',
          }}
          onClick={() => navigateWithShop('/running')}
        >
          <img src={logoIcon} alt="Logo" style={{ width: '36px', height: '36px' }} />
          <span style={{
            fontSize: '20px',
            fontWeight: '700',
            background: 'linear-gradient(to right, #ff6b6b, #feca57)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            KiScience
          </span>
        </div>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          {navItems.map((item) => {
            const hasSubitems = item.subitems && item.subitems.length > 0
            const itemKey = item.key || item.path
            const isActive = hasSubitems
              ? isDropdownChildActive(item.subitems)
              : (location.pathname === item.path ||
                  (item.path === '/admin/settings' && location.pathname.startsWith('/admin/settings')))

            if (hasSubitems) {
              const openOnClickOnly = item.openOnClickOnly === true
              return (
                <div
                  key={itemKey}
                  style={{ position: 'relative' }}
                  onMouseEnter={() => { if (!openOnClickOnly) setOpenDropdown(itemKey) }}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button
                    onClick={() => {
                      setOpenDropdown(openDropdown === itemKey ? null : itemKey)
                      if (!openOnClickOnly) navigateWithShop(item.path)
                    }}
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)'
                        : 'transparent',
                      border: isActive ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#fff',
                      padding: '8px 20px',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: isActive ? '600' : '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.target.style.background = 'rgba(255, 255, 255, 0.1)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.target.style.background = 'transparent'
                    }}
                  >
                    {item.label}
                    <span style={{ fontSize: '10px', opacity: 0.9 }}>▾</span>
                  </button>
                  {openDropdown === itemKey && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '4px',
                        minWidth: '180px',
                        background: 'rgba(26, 26, 46, 0.98)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                        padding: '6px 0',
                        zIndex: 1100,
                      }}
                    >
                      {item.subitems.map((sub) => {
                        const subActive =
                          location.pathname === sub.path || location.pathname.startsWith(sub.path + '/')
                        return (
                          <button
                            key={sub.path + sub.label}
                            onClick={() => {
                              setOpenDropdown(null)
                              navigateWithShop(sub.path)
                            }}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '10px 16px',
                              background: subActive ? 'rgba(255, 107, 107, 0.2)' : 'transparent',
                              border: 'none',
                              color: '#fff',
                              fontSize: '14px',
                              cursor: 'pointer',
                            }}
                          >
                            {sub.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <button
                key={item.path}
                onClick={() => navigateWithShop(item.path)}
                style={{
                  background: isActive
                    ? 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)'
                    : 'transparent',
                  border: isActive ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  padding: '8px 20px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: isActive ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.target.style.background = 'rgba(255, 255, 255, 0.1)'
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.target.style.background = 'transparent'
                }}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export default NavBar
