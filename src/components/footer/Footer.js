import React from 'react';
import styled from 'styled-components';
import logo from '../../torodilogo.svg';
import './Footer.css';

const FooterContainer = styled.footer`
  background-color: #CD5D67;
  color: #f5f5f5;
  padding: 3rem 1.5rem 1.5rem;
  font-family: 'BiancoSans', sans-serif;
`;

const FooterContent = styled.div`
  max-width: 48rem;
  margin: 0 auto;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3rem;
  align-items: start;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
`;

const LogoSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-top: 0.5rem;

  img {
    filter: brightness(0) invert(1); // Keep logo white, remove width
  }

  @media (max-width: 768px) {
    align-items: center;
    padding-top: 0;
  }
`;

const TextGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  color: #f5f5f5;

  .footer__label {
    margin-bottom: 0.5rem;
    color: #f5f5f5;
  }

  .footer__text {
    a {
      color: #f5f5f5;
      text-decoration: none;
      transition: opacity 0.2s ease;

      &:hover {
        opacity: 0.8;
      }
    }
  }

  @media (max-width: 768px) {
    text-align: center;
  }
`;

const Copyright = styled.div`
  text-align: center;
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 0.8rem;
  color: #f5f5f5;

  @media (max-width: 768px) {
    margin-top: 2rem;
  }
`;

const Footer = () => {
  return (
    <FooterContainer className="footer">
      <FooterContent>
        <LogoSection>
          <img src={logo} alt="To Rodi Logo" className="footer__logo" />
        </LogoSection>
        <TextGrid>
          <div className="footer__info-block">
            <p className="footer__label">Address:</p>
            <div className="footer__text">
              <a
                href="https://www.google.gr/maps/place/To+Rodi+Boutique+Hotel/@38.8090449,23.2284044,114m/data=!3m1!1e3!4m21!1m11!3m10!1s0x14a0d1859be3359f:0x8f005492f0956966!2sTo+Rodi+Boutique+Hotel!5m2!4m1!1i2!8m2!3d38.8090242!4d23.2286358!10e1!16s%2Fg%2F11c2pklmgc!3m8!1s0x14a0d1859be3359f:0x8f005492f0956966!5m2!4m1!1i2!8m2!3d38.8090242!4d23.2286358!16s%2Fg%2F11c2pklmgc?entry=ttu"
                target="_blank"
                rel="noopener noreferrer"
              >
                To Rodi - Boutique Hotel<br />
                Rovies, Euboea, 34005<br />
                Greece
              </a>
            </div>
          </div>
          <div className="footer__info-block">
            <p className="footer__label">Phone:</p>
            <div className="footer__text">
              <a href="tel:+302227071666">Tel: (+30) 22270 71666</a><br />
              <a href="tel:+306942840550">Mob: (+30) 694 2840 550</a>
            </div>
          </div>
          <div className="footer__info-block">
            <p className="footer__label">Email:</p>
            <div className="footer__text">
              <a href="mailto:torodihotel@gmail.com">
                torodihotel@gmail.com
              </a>
            </div>
          </div>
          <div className="footer__info-block">
            <p className="footer__label">Social:</p>
            <div className="footer__text">
              <a 
                href="https://www.facebook.com/p/To-Rodi-Hotel-100043865844742/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Facebook
              </a>
            </div>
          </div>
        </TextGrid>
      </FooterContent>

      <Copyright>
        <p>© 2025 To Rodi - Boutique Hotel. All rights reserved.</p>
      </Copyright>
    </FooterContainer>
  );
};

export default Footer;
