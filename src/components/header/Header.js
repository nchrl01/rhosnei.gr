import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../../torodilogo.svg';
import './Header.css';

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [scrollTimeout, setScrollTimeout] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const [showLinks, setShowLinks] = useState(true);
  const [language, setLanguage] = useState('en');
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    if (currentScrollY > lastScrollY && currentScrollY > 50) {
      setIsHidden(true);
      if (isOpen) {
        setIsClosing(true);
        setShowLinks(false);
        setTimeout(() => {
          setIsOpen(false);
          setIsClosing(false);
        }, 300);
      }
    } else {
      setIsHidden(false);
    }

    setIsScrolled(currentScrollY > 50);
    setLastScrollY(currentScrollY);

    const timeout = setTimeout(() => {
      setIsHidden(false);
    }, 1000);

    setScrollTimeout(timeout);
  }, [lastScrollY, scrollTimeout, isOpen]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [handleScroll, scrollTimeout]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768 && isOpen) {
        setShowLinks(true);
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  const handleMenuToggle = () => {
    if (!isOpen) {
      setIsOpen(true);
      setTimeout(() => {
        setShowLinks(true);
      }, 10);
    } else {
      setShowLinks(false);
      setIsClosing(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsClosing(false);
      }, 300);
    }
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'gr' : 'en');
  };

  const closeMenu = () => {
    if (isOpen) {
      setShowLinks(false);
      setIsClosing(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsClosing(false);
      }, 300);
    }
  };

  return (
    <header className={`header 
      ${isScrolled ? 'header--scrolled' : ''} 
      ${isHidden ? 'header--hidden' : ''} 
      ${!isHomePage ? 'header--colored' : ''}
      ${isOpen ? 'header--menu-open' : ''}`}>
      <Link to="/" className="header__logo" onClick={closeMenu}>
        <img src={logo} alt="To Rodi" className="header__logo-img" />
      </Link>
      <button
        className={`header__hamburger ${isOpen ? 'header__hamburger--open' : ''}`}
        onClick={handleMenuToggle}
        aria-label="Toggle menu"
      >
        <div />
        <div />
        <div />
      </button>
      <nav className={`header__nav ${isOpen ? 'header__nav--open' : ''} ${isClosing ? 'header__nav--closing' : ''}`}>
        <Link 
          to="/" 
          onClick={closeMenu} 
          className={`header__link ${showLinks ? 'header__link--visible' : ''} ${location.pathname === '/' ? 'header__link--bold' : ''}`}
        >
          Home
        </Link>
        <Link 
          to="/THEHOTEL" 
          onClick={closeMenu} 
          className={`header__link header__link--book ${showLinks ? 'header__link--visible' : ''} ${location.pathname === '/THEHOTEL' ? 'header__link--bold' : ''}`}
        >
          The Hotel
        </Link>
        <Link 
          to="/rooms" 
          onClick={closeMenu} 
          className={`header__link ${showLinks ? 'header__link--visible' : ''} ${location.pathname === '/rooms' ? 'header__link--bold' : ''}`}
        >
          Rooms
        </Link>
        <Link 
          to="/area" 
          onClick={closeMenu} 
          className={`header__link ${showLinks ? 'header__link--visible' : ''} ${location.pathname === '/area' ? 'header__link--bold' : ''}`}
        >
          Area
        </Link>
        <Link 
          to="/gallery" 
          onClick={closeMenu} 
          className={`header__link ${showLinks ? 'header__link--visible' : ''} ${location.pathname === '/gallery' ? 'header__link--bold' : ''}`}
        >
          Gallery
        </Link>
        <Link 
          to="/contact" 
          onClick={closeMenu} 
          className={`header__link header__link--book ${showLinks ? 'header__link--visible' : ''} ${location.pathname === '/contact' ? 'header__link--bold' : ''}`}
        >
          Contact
        </Link>
        <button 
          onClick={toggleLanguage}
          className={`header__link header__link--lang ${showLinks ? 'header__link--visible' : ''}`}
        >
          <span className={language === 'en' ? 'bold' : ''}>EN</span>
          {' / '}
          <span className={language === 'gr' ? 'bold' : ''}>ΕΛ</span>
        </button>
      </nav>
      <style jsx>{`
        .header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 60px;
          padding: 0 clamp(1rem, 4vw, 2rem);
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.3s ease;
          z-index: 1001;
          font-family: 'BiancoSans-Regular', sans-serif;
          background-color: transparent;
          transform: translateY(0);
        }

        .header--hidden {
          transform: translateY(-100%);
        }

        .header--scrolled {
          background: rgba(255, 255, 255, 1);
          color: #CD5D67;
        }

        .header--colored {
          background-color: #CD5D67;
        }

        .header--menu-open {
          background: transparent !important;
        }

        .header--menu-open .header__logo-img {
          filter: brightness(0) invert(1) !important;
        }

        .header--menu-open .header__hamburger div {
          background-color: #fff !important;
        }

        .header--menu-open .header__link {
          color: #fff !important;
        }

        .header--menu-open .header__link:hover {
          color: rgba(255, 255, 255, 0.8) !important;
        }

        .header__logo {
          text-decoration: none;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          height: 32px;
          position: relative;
          transition: all 0.3s ease;
          margin-left: calc(clamp(0.75rem, 2vw, 1.5rem));
          z-index: 1001;
        }

        .header__logo-img {
          height: 100%;
          width: auto;
          transition: all 0.3s ease;
          transform-origin: center;
          filter: brightness(0) invert(1);
        }

        .header__logo:hover .header__logo-img {
          transform: scale(1.1);
        }

        .header--scrolled .header__logo-img {
          filter: none;
        }

        .header--scrolled .header__logo:hover .header__logo-img {
          filter: none;
        }

        .header__hamburger {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.4rem;
          z-index: 1001;
          height: 32px;
          width: 32px;
          position: relative;
          transition: all 0.3s ease;
          margin-right: calc(clamp(0.75rem, 2vw, 1.5rem));
        }

        .header__hamburger div {
          position: absolute;
          left: 50%;
          width: 20px;
          height: 2px;
          background-color: #fff;
          transform-origin: center;
          transition: all 0.3s ease;
          margin-left: -10px;
        }

        .header__hamburger div:nth-child(1) {
          top: 10px;
        }

        .header__hamburger div:nth-child(2) {
          top: 16px;
        }

        .header__hamburger div:nth-child(3) {
          top: 22px;
        }

        .header--scrolled .header__hamburger div {
          background-color: #CD5D67;
        }

        .header__hamburger--open div:nth-child(1) {
          transform: translateY(6px) rotate(45deg);
        }

        .header__hamburger--open div:nth-child(2) {
          transform: scaleX(0);
        }

        .header__hamburger--open div:nth-child(3) {
          transform: translateY(-6px) rotate(-45deg);
        }

        .header__nav {
          display: flex;
          gap: clamp(0.75rem, 2vw, 2rem);
          align-items: center;
          transition: all 0.3s ease;
          flex-wrap: nowrap;
          justify-content: center;
          height: 100%;
          flex: 1;
          margin: 0 clamp(0.75rem, 2vw, 2rem);
        }

        .header__nav--open {
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100vh;
          background: #CD5D67;
          padding: 0;
          gap: 0.75rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          animation: slideDown 0.25s ease forwards;
          align-items: center;
          justify-content: center;
          transform-origin: top;
          z-index: 1000;
        }

        .header__nav--closing {
          animation: slideUp 0.25s ease forwards;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-100%);
          }
        }

        .header__link {
          color: #fff;
          text-decoration: none;
          transition: all 0.25s ease;
          padding: 0.5rem 0.75rem;
          letter-spacing: 0.3px;
          font-family: 'BiancoSans-Regular', sans-serif;
          font-weight: normal;
          text-align: center;
          font-size: clamp(0.85rem, 0.9vw, 0.95rem);
          white-space: nowrap;
          opacity: 1;
          transform: translateY(0);
        }

        .header__link--bold {
          font-family: 'BiancoSans-Bold', sans-serif;
          font-weight: bold;
        }

        .header__link--visible {
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.25s ease, transform 0.25s ease;
          transition-delay: calc(var(--link-index, 0) * 0.03s);
        }

        .header--scrolled .header__link {
          color: #CD5D67;
        }

        .header__link:hover {
          color: rgba(255, 255, 255, 0.8);
          transform: scale(1.05);
        }

        .header--scrolled .header__link:hover {
          color: rgba(205, 93, 103, 0.8);
        }

        .header__link--book {
          font-family: 'BiancoSans-Regular', sans-serif;
        }

        .header__link--lang {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem 0.75rem;
          font-family: 'BiancoSans-Regular', sans-serif;
          font-weight: normal;
        }

        .header__link--lang span {
          font-family: 'BiancoSans-Regular', sans-serif;
          font-weight: normal;
          transition: font-weight 0.25s ease;
        }

        .header__link--lang span.bold {
          font-family: 'BiancoSans-Bold', sans-serif;
          font-weight: bold;
        }

        @media (max-width: 1024px) {
          .header__nav {
            gap: clamp(0.5rem, 1.25vw, 1.25rem);
            transition: all 0.3s ease;
          }
          
          .header__link {
            padding: 0.4rem 0.6rem;
            font-size: clamp(0.85rem, 1vw, 0.95rem);
            transition: all 0.3s ease;
          }
        }

        @media (max-width: 768px) {
          .header {
            padding: 0 clamp(0.75rem, 3vw, 1.25rem);
            transition: all 0.3s ease;
          }

          .header__hamburger {
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
          }

          .header__nav {
            display: none;
            transition: all 0.3s ease;
            margin: 0;
          }

          .header__nav--open {
            display: flex;
            padding: 0;
            width: 100%;
            transition: all 0.3s ease;
            gap: 0.75rem;
          }

          .header__link {
            padding: 0.6rem;
            font-size: clamp(0.9rem, 2.5vw, 1rem);
            color: #fff;
            width: 100%;
            text-align: center;
            transition: all 0.3s ease;
            border: none;
            display: block;
            line-height: 1.2;
          }

          .header__link:hover {
            transform: scale(1.05);
            padding: 0.6rem;
          }

          .header__link--lang {
            padding: 0.6rem;
            width: 100%;
          }
        }

        @media (max-width: 480px) {
          .header {
            height: 50px;
            transition: all 0.3s ease;
          }

          .header__logo-img {
            height: 28px;
            transition: all 0.3s ease;
          }

          .header__nav--open {
            padding: 0;
            gap: 0.5rem;
          }

          .header__link {
            font-size: clamp(0.85rem, 2.25vw, 0.95rem);
            padding: 0.5rem;
          }
        }
      `}</style>
    </header>
  );
};

export default Header;
