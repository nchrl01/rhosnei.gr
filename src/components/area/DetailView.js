import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const DetailViewContainer = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  background: white;
  z-index: 999;
  overflow-y: auto;
  box-shadow: 0 0 20px rgba(0,0,0,0.1);
  width: 100%;
  will-change: transform;
  transform-origin: left center;
  -webkit-overflow-scrolling: touch;
  backface-visibility: hidden;

  @media (min-width: 769px) {
    width: 50%;
  }

  @media (max-width: 480px) {
    padding: 0 1rem;
  }
`;

const DetailContent = styled.div`
  padding: 2rem;
  padding-top: ${props => props.$headerOffset}px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  min-height: 100vh;

  @media (max-width: 480px) {
    padding: ${props => props.$headerOffset}px 0 1.5rem 0;
  }
`;

const BackButton = styled.button`
  font-family: 'BiancoSans', sans-serif;
  background: none;
  border: none;
  color: #d66c7a;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0;
  margin-bottom: 2rem;
  transition: all 0.2s ease-in-out;

  svg {
    transition: transform 0.2s ease-in-out;
  }

  &:hover {
    opacity: 0.8;
    svg {
      transform: translateX(-4px);
    }
  }
`;

const Title = styled.h2`
  font-family: 'BiancoSans', sans-serif;
  font-size: 2rem;
  color: #d66c7a;
  margin-bottom: 1.5rem;
`;

const Description = styled.p`
  font-family: 'BiancoSans', sans-serif;
  font-size: 1.1rem;
  line-height: 1.6;
  color: #666;
  margin-bottom: 2rem;
  white-space: pre-line;

  /* Style section headers */
  strong {
    display: block;
    font-size: 1.2rem;
    color: #d66c7a;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }

  /* Style bullet points and lists */
  ul, ol {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }

  li {
    margin-bottom: 0.5rem;
    padding-left: 0.5rem;
  }

  /* Style sections with bullet points (•) */
  & > p {
    margin-bottom: 0.75rem;
  }

  /* Format text that starts with • as a list */
  p:has(span[data-bullet="true"]) {
    padding-left: 1.5rem;
    position: relative;
    
    &::before {
      content: "•";
      position: absolute;
      left: 0.5rem;
      color: #d66c7a;
    }
  }

  /* Add spacing between major sections */
  p + p:not(:has(span[data-bullet="true"])) {
    margin-top: 1.25rem;
  }
`;

const Categories = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 2rem;
`;

const CategoryTag = styled.span`
  font-family: 'BiancoSans', sans-serif;
  font-size: clamp(0.65rem, 1.5vw, 0.75rem);
  font-weight: normal;
  padding: 3px 10px;
  background: rgba(214, 108, 122, 0.1);
  color: #d66c7a;
  border-radius: 12px;
`;

const PhoneLink = styled.a`
  color: #d66c7a;
  text-decoration: none;
  display: block;
  margin-top: 1rem;
  
  &:hover {
    text-decoration: underline;
  }
`;

const WebsiteLink = styled.a`
  color: #d66c7a;
  text-decoration: none;
  display: block;
  margin-top: 0.5rem;
  
  &:hover {
    text-decoration: underline;
  }
`;

const DetailView = ({ attraction, onClose, isOpen }) => {
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const updateHeaderHeight = () => {
      const header = document.querySelector('header');
      const areaHeader = document.querySelector('#area-header');
      const totalHeaderHeight = (header?.offsetHeight || 0) + (areaHeader?.offsetHeight || 0);
      setHeaderHeight(totalHeaderHeight);
    };

    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);
    const timeout = setTimeout(updateHeaderHeight, 100);

    return () => {
      window.removeEventListener('resize', updateHeaderHeight);
      clearTimeout(timeout);
    };
  }, []);

  const slideAnimation = {
    initial: { 
      x: '100%',
      opacity: 0
    },
    animate: { 
      x: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 25,
        mass: 1,
        duration: 0.4
      }
    },
    exit: { 
      x: '-100%',
      opacity: 0,
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 25,
        mass: 1,
        duration: 0.3
      }
    }
  };

  const handleContainerClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <DetailViewContainer
      {...slideAnimation}
      initial="initial"
      animate="animate"
      exit="exit"
      onClick={handleContainerClick}
    >
      <DetailContent $headerOffset={headerHeight}>
        <BackButton onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </BackButton>
        <Title>{attraction.title}</Title>
        <Description>{attraction.description}</Description>
        <Categories>
          {attraction.categories.map(category => (
            <CategoryTag key={category}>{category}</CategoryTag>
          ))}
        </Categories>
        {attraction.phoneNumber && (
          <PhoneLink href={`tel:${attraction.phoneNumber.replace(/\s/g, '')}`}>
            {attraction.phoneNumber}
          </PhoneLink>
        )}
        {attraction.website && (
          <WebsiteLink 
            href={`https://${attraction.website.replace(/^https?:\/\//, '')}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {attraction.website}
          </WebsiteLink>
        )}
        {attraction.googleMapsLink && (
          <WebsiteLink 
            href={attraction.googleMapsLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Google Maps
          </WebsiteLink>
        )}
      </DetailContent>
    </DetailViewContainer>
  );
};

export default DetailView; 