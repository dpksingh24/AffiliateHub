import React from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import logoIcon from '../assets/images/logo.png'

const NavBar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const navItems = [
    { label: 'Home', path: '/running' },
    { label: 'Form Builder', path: '/form-builder' },
    { label: 'Custom Pricing', path: '/custom-pricing' },
  ]

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
      zIndex: 100,
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
        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path === '/form-builder' && location.pathname.startsWith('/form-builder'))
            
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
                  if (!isActive) {
                    e.target.style.background = 'rgba(255, 255, 255, 0.1)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.target.style.background = 'transparent'
                  }
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
